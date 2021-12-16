import { Provider, BN, utils } from '@project-serum/anchor'
import { u64 } from '@solana/spl-token'
import {
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmRawTransaction,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js'
import { calculate_price_sqrt, fromInteger, Pair } from '.'
import { Market } from '.'
import { Decimal, FeeTier, FEE_TIER, PoolStructure, Tickmap, Tick, Position } from './market'
import { calculatePriceAfterSlippage, calculateSwapStep, SwapResult } from './math'
import { getTickFromPrice } from './tick'
import { getNextTick, getPreviousTick, getSearchLimit } from './tickmap'
import { struct, u32, u8 } from '@solana/buffer-layout'

export const SEED = 'Invariant'
export const DECIMAL = 12
export const FEE_DECIMAL = 5
export const DENOMINATOR = new BN(10).pow(new BN(DECIMAL))
export const FEE_OFFSET = new BN(10).pow(new BN(DECIMAL - FEE_DECIMAL))
export const FEE_DENOMINATOR = 10 ** FEE_DECIMAL

export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xa4',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers',
  CONSTRAINT_RAW = '0x8f',
  CONSTRAINT_SEEDS = '0x92'
}

export enum INVARIANT_ERRORS {
  ZERO_AMOUNT = '0x12c',
  ZERO_OUTPUT = '0x12d',
  WRONG_TICK = '0x12e',
  WRONG_LIMIT = '0x12f',
  INVALID_TICK_INDEX = '0x130',
  INVALID_TICK_INTERVAL = '0x131',
  NO_MORE_TICKS = '0x132',
  TICK_NOT_FOUND = '0x133',
  PRICE_LIMIT_REACHED = '0x134',
  INVALID_TICK_LIQUIDITY = '0x135',
  EMPTY_POSITION_POKES = '0x136',
  INVALID_POSITION_LIQUIDITY = '0x137',
  INVALID_POOL_LIQUIDITY = '0x138',
  INVALID_POSITION_INDEX = '0x139',
  POSITION_WITHOUT_LIQUIDITY = '0x13a',
  INVALID_POOL_TOKEN_ADDRESSES = '0x13b'
}

export interface SimulateSwapPrice {
  xToY: boolean
  byAmountIn: boolean
  swapAmount: BN
  currentPrice: Decimal
  slippage: Decimal
  tickmap: Tickmap
  pool: PoolStructure
  market: Market
  pair: Pair
}

export interface SimulateClaim {
  position: Position
  tickLower: Tick
  tickUpper: Tick
  tickCurrent: number
  feeGrowthGlobalX: Decimal
  feeGrowthGlobalY: Decimal
}
export const ComputeUnitsInstruction = (units: number, wallet: PublicKey) => {
  const program = new PublicKey('ComputeBudget111111111111111111111111111111')
  let params = { instruction: 0, units: units }
  let layout = struct([u8('instruction'), u32('units')])
  let data = Buffer.alloc(layout.span)
  layout.encode(params, data)
  let keys = [{ pubkey: wallet, isSigner: false, isWritable: false }]
  const unitsIx = new TransactionInstruction({
    keys,
    programId: program,
    data
  })
  return unitsIx
}
export async function assertThrowsAsync(fn: Promise<any>, word?: string) {
  try {
    await fn
  } catch (e: any) {
    let err
    if (e.code) {
      err = '0x' + e.code.toString(16)
    } else {
      err = e.toString()
    }
    if (word) {
      const regex = new RegExp(`${word}$`)
      if (!regex.test(err)) {
        console.log(err)
        throw new Error('Invalid Error message')
      }
    }
    return
  }
  throw new Error('Function did not throw error')
}

export const signAndSend = async (
  tx: Transaction,
  signers: Array<Keypair>,
  connection: Connection,
  opts?: ConfirmOptions
) => {
  tx.setSigners(...signers.map((s) => s.publicKey))
  const blockhash = await connection.getRecentBlockhash(
    opts?.commitment || Provider.defaultOptions().commitment
  )
  tx.recentBlockhash = blockhash.blockhash
  tx.partialSign(...signers)
  const rawTx = tx.serialize()
  return await sendAndConfirmRawTransaction(connection, rawTx, opts || Provider.defaultOptions())
}

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const tou64 = (amount) => {
  // eslint-disable-next-line new-cap
  return new u64(amount.toString())
}

export const fromFee = (fee: BN): BN => {
  // e.g fee - BN(1) -> 0.001%
  return fee.mul(FEE_OFFSET)
}

export const feeToTickSpacing = (fee: BN): number => {
  // linear relationship between fee and tickSpacing
  // tickSpacing = fee * 10^4
  const FEE_TO_SPACING_OFFSET = new BN(10).pow(new BN(DECIMAL - 4))
  return fee.muln(2).div(FEE_TO_SPACING_OFFSET).toNumber()
}

export const FEE_TIERS: Array<FeeTier> = [
  { fee: fromFee(new BN(20)) },
  { fee: fromFee(new BN(40)) },
  { fee: fromFee(new BN(100)) },
  { fee: fromFee(new BN(300)) },
  { fee: fromFee(new BN(1000)) }
]

export const generateTicksArray = (start: number, stop: number, step: number) => {
  const validDir = (start > stop && step < 0) || (start < stop && step > 0)
  const validMod = start % step === 0 && stop % step === 0

  if (!validDir || !validMod) {
    throw new Error('Invalid parameters')
  }

  const ticks: Array<number> = []
  for (let i = start; i <= stop; i += step) {
    ticks.push(i)
  }
  return ticks
}

export const getFeeTierAddress = async ({ fee, tickSpacing }: FeeTier, programId: PublicKey) => {
  const ts = tickSpacing ?? feeToTickSpacing(fee)

  const [address, bump] = await PublicKey.findProgramAddress(
    [
      Buffer.from(utils.bytes.utf8.encode(FEE_TIER)),
      programId.toBuffer(),
      bigNumberToBuffer(fee, 128),
      bigNumberToBuffer(new BN(ts), 16)
    ],
    programId
  )

  return {
    address,
    bump
  }
}

export const toDecimal = (x: number, decimals: number = 0): Decimal => {
  return { v: DENOMINATOR.muln(x).div(new BN(10).pow(new BN(decimals))) }
}

export const calculateAveragePrice = (swapParameters: SimulateSwapPrice): Decimal => {
  const { xToY, byAmountIn, swapAmount, slippage, tickmap, pool, market, pair } = swapParameters
  let { currentTickIndex, tickSpacing, liquidity, fee } = pool
  let currentSqrtPrice = pool.sqrtPrice

  const priceLimit = calculatePriceAfterSlippage(currentSqrtPrice, slippage, !xToY)
  if (xToY) {
    if (pool.sqrtPrice.v.lt(priceLimit.v)) {
      throw new Error('Price limit is on the wrong side of price')
    }
  } else {
    if (pool.sqrtPrice.v.gt(priceLimit.v)) {
      throw new Error('Price limit is on the wrong side of price')
    }
  }
  let remainingAmount: Decimal = { v: swapAmount.mul(DENOMINATOR) }
  let totalAmountIn: Decimal = { v: new BN(0) }
  let totalAmountOut: Decimal = { v: new BN(0) }
  let totalFee: Decimal = { v: new BN(0) }

  while (!remainingAmount.v.lte(new BN(0))) {
    let closestTickIndex: number
    if (xToY) {
      closestTickIndex = getPreviousTick(tickmap, currentTickIndex, tickSpacing).valueOf()
    } else {
      closestTickIndex = getNextTick(tickmap, currentTickIndex, tickSpacing).valueOf()
    }

    let price: Decimal
    let closerLimit: { swapLimit: Decimal; limitingTick: { index: Number; initialized: Boolean } }
    if (closestTickIndex != null) {
      price = calculate_price_sqrt(closestTickIndex)

      if (xToY && price.v.gt(priceLimit.v)) {
        closerLimit = {
          swapLimit: price,
          limitingTick: { index: new Number(closestTickIndex), initialized: new Boolean(true) }
        }
      } else if (!xToY && price.v.lt(priceLimit.v)) {
        closerLimit = {
          swapLimit: price,
          limitingTick: { index: new Number(closestTickIndex), initialized: new Boolean(true) }
        }
      } else {
        closerLimit = {
          swapLimit: priceLimit,
          limitingTick: { index: new Number(null), initialized: new Boolean(null) }
        }
      }
    } else {
      const index = getSearchLimit(currentTickIndex, tickSpacing, !xToY)
      price = calculate_price_sqrt(index)

      if (xToY && price.v.gt(priceLimit.v)) {
        closerLimit = {
          swapLimit: price,
          limitingTick: { index: new Number(closestTickIndex), initialized: new Boolean(false) }
        }
      } else if (!xToY && price.v.lt(priceLimit.v)) {
        closerLimit = {
          swapLimit: price,
          limitingTick: { index: new Number(closestTickIndex), initialized: new Boolean(false) }
        }
      } else {
        closerLimit = {
          swapLimit: priceLimit,
          limitingTick: { index: new Number(null), initialized: new Boolean(null) }
        }
      }
    }
    const result = calculateSwapStep(
      currentSqrtPrice,
      closerLimit.swapLimit,
      liquidity,
      remainingAmount,
      byAmountIn,
      fee
    )
    totalAmountIn = { v: totalAmountIn.v.add(result.amountIn.v) }
    totalAmountOut = { v: totalAmountOut.v.add(result.amountOut.v) }
    totalFee = { v: totalFee.v.add(result.feeAmount.v) }

    let amountDiff: Decimal
    if (byAmountIn) {
      amountDiff = { v: result.amountIn.v.add(result.feeAmount.v) }
    } else {
      amountDiff = { v: result.amountOut.v }
    }

    remainingAmount = { v: remainingAmount.v.sub(amountDiff.v) }

    currentSqrtPrice = result.nextPrice

    if (currentSqrtPrice.v.eq(priceLimit.v) && remainingAmount.v.gt(new BN(0))) {
      throw new Error('Price would cross swap limit')
    }

    if (
      result.nextPrice.v.eq(closerLimit.swapLimit.v) &&
      closerLimit.limitingTick.index != undefined
    ) {
      const tickIndex = closerLimit.limitingTick.index
      const initialized = closerLimit.limitingTick.initialized

      if (initialized) {
        market.getTick(pair, tickIndex.valueOf()).then((tick) => {
          if (currentTickIndex >= tick.index !== tick.sign) {
            liquidity = { v: liquidity.v.add(tick.liquidityChange.v) }
          } else {
            liquidity = { v: liquidity.v.sub(tick.liquidityChange.v) }
          }
        })
      }
      if (xToY && !remainingAmount.v.eq(new BN(0))) {
        currentTickIndex = tickIndex.valueOf() - tickSpacing
      } else {
        currentTickIndex = tickIndex.valueOf()
      }
    } else {
      currentTickIndex = getTickFromPrice(currentTickIndex, tickSpacing, result.nextPrice, xToY)
    }
  }
  return { v: totalAmountOut.v.mul(DENOMINATOR).div(totalAmountIn.v) }
}
export const parseLiquidityOnTicks = (ticks: Tick[], pool: PoolStructure) => {
  let indexOfTickBelow = -1
  // find first tick
  for (let i = 0; i < ticks.length; i++) {
    if (ticks[i].index <= pool.currentTickIndex) {
      indexOfTickBelow = i
    } else break
  }

  const parsed = ticks.map(({ liquidityChange, sign, index }) => {
    return { index, liquidityChange, sign, liquidity: new BN(-1) }
  })
  parsed[indexOfTickBelow].liquidity = pool.liquidity.v

  for (let i = indexOfTickBelow + 1; i < parsed.length; i++) {
    if (ticks[i].sign === true) {
      parsed[i].liquidity = parsed[i - 1].liquidity.add(ticks[i].liquidityChange.v)
    } else {
      parsed[i].liquidity = parsed[i - 1].liquidity.sub(ticks[i].liquidityChange.v)
    }
  }

  for (let i = indexOfTickBelow - 1; i >= 0; i--) {
    if (ticks[i].sign === false) {
      parsed[i].liquidity = parsed[i + 1].liquidity.add(ticks[i].liquidityChange.v)
    } else {
      parsed[i].liquidity = parsed[i + 1].liquidity.sub(ticks[i].liquidityChange.v)
    }
  }

  return parsed
}

export const calculateClaimAmount = ({
  position,
  tickLower,
  tickUpper,
  tickCurrent,
  feeGrowthGlobalX,
  feeGrowthGlobalY
}: SimulateClaim) => {
  // determine position relative to current tick
  let current_above_lower = tickCurrent >= tickLower.index
  let current_below_upper = tickCurrent < tickUpper.index
  let feeGrowthBelowX: BN
  let feeGrowthBelowY: BN
  let feeGrowthAboveX: BN
  let feeGrowthAboveY: BN

  // calculate fee growth below
  if (current_above_lower) {
    feeGrowthBelowX = tickLower.feeGrowthOutsideX.v
  } else {
    feeGrowthBelowX = feeGrowthGlobalX.v.sub(tickLower.feeGrowthOutsideX.v)
  }
  if (current_above_lower) {
    feeGrowthBelowY = tickLower.feeGrowthOutsideY.v
  } else {
    feeGrowthBelowY = feeGrowthGlobalY.v.sub(tickLower.feeGrowthOutsideY.v)
  }

  // calculate fee growth above
  if (current_below_upper) {
    feeGrowthAboveX = tickUpper.feeGrowthOutsideX.v
  } else {
    feeGrowthAboveX = feeGrowthGlobalX.v.sub(tickUpper.feeGrowthOutsideX.v)
  }
  if (current_below_upper) {
    feeGrowthAboveY = tickUpper.feeGrowthOutsideY.v
  } else {
    feeGrowthAboveY = feeGrowthGlobalY.v.sub(tickUpper.feeGrowthOutsideY.v)
  }

  // calculate fee growth inside
  let feeGrowthInsideX = feeGrowthGlobalX.v.sub(feeGrowthBelowX.sub(feeGrowthAboveX))
  let feeGrowthInsideY = feeGrowthGlobalY.v.sub(feeGrowthBelowY.sub(feeGrowthAboveY))

  let tokensOwedX = position.liquidity.v
    .mul(feeGrowthInsideX.sub(position.feeGrowthInsideX.v))
    .div(DENOMINATOR)
  let tokensOwedY = position.liquidity.v
    .mul(feeGrowthInsideY.sub(position.feeGrowthInsideY.v))
    .div(DENOMINATOR)
  let tokensOwedXTotal = position.tokensOwedX.v.add(tokensOwedX)
  let tokensOwedYTotal = position.tokensOwedY.v.add(tokensOwedY)
  return [tokensOwedXTotal, tokensOwedYTotal]
}

export const bigNumberToBuffer = (n: BN, size: 16 | 32 | 64 | 128 | 256) => {
  const chunk = new BN(2).pow(new BN(16))

  const buffer = Buffer.alloc(size / 8)
  let offset = 0

  while (n.gt(new BN(0))) {
    buffer.writeUInt16LE(n.mod(chunk).toNumber(), offset)
    n = n.div(chunk)
    offset += 2
  }

  return buffer
}
