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
import { calculatePriceSqrt, fromInteger, MAX_TICK, Pair, TICK_LIMIT } from '.'
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

export interface SimulateSwapInterface {
  xToY: boolean
  byAmountIn: boolean
  swapAmount: BN
  currentPrice: Decimal
  slippage: Decimal
  ticks: Map<number, Tick>
  tickmap: Tickmap
  pool: PoolStructure
  market: Market
  pair: Pair
}

export interface SimulationResult {
  amountPerTick: BN[]
  accumulatedAmountOut: BN
  accumulatedFee: BN
}

export interface SimulateClaim {
  position: Position
  tickLower: Tick
  tickUpper: Tick
  tickCurrent: number
  feeGrowthGlobalX: Decimal
  feeGrowthGlobalY: Decimal
}

export interface CloserLimit {
  sqrtPriceLimit: Decimal
  xToY: boolean
  currentTick: number
  tickSpacing: number
  tickmap: Tickmap
}

export interface TickState {
  index: number
  initialized: boolean
}
export interface CloserLimitResult {
  swapLimit: Decimal
  limitingTick: TickState | null
}

export const ComputeUnitsInstruction = (units: number, wallet: PublicKey) => {
  const program = new PublicKey('ComputeBudget111111111111111111111111111111')
  let params = { instruction: 0, units: units }
  let layout = struct([u8('instruction') as any, u32('units')])
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
  tx.setSigners(...signers.map(s => s.publicKey))
  const blockhash = await connection.getRecentBlockhash(
    opts?.commitment || Provider.defaultOptions().commitment
  )
  tx.recentBlockhash = blockhash.blockhash
  tx.partialSign(...signers)
  const rawTx = tx.serialize()
  return await sendAndConfirmRawTransaction(connection, rawTx, opts || Provider.defaultOptions())
}

export const sleep = async (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const tou64 = amount => {
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

export const getCloserLimit = (closerLimit: CloserLimit): CloserLimitResult => {
  let { sqrtPriceLimit, xToY, currentTick, tickSpacing, tickmap } = closerLimit
  let index

  if (xToY) {
    index = getPreviousTick(tickmap, currentTick, tickSpacing)
  } else {
    index = getNextTick(tickmap, currentTick, tickSpacing)
  }

  let sqrtPrice: Decimal
  let init: boolean

  if (index != null) {
    sqrtPrice = calculatePriceSqrt(index)
    init = true
  } else {
    const index: number = getSearchLimit(currentTick, tickSpacing, !xToY)
    sqrtPrice = calculatePriceSqrt(index)
    init = false
  }

  if (index == null) {
    throw new Error('Index is undefined')
  }

  if (xToY && sqrtPrice.v.gt(sqrtPriceLimit.v)) {
    return { swapLimit: sqrtPrice, limitingTick: { index, initialized: init } }
  } else if (!xToY && sqrtPrice.v.lt(sqrtPriceLimit.v)) {
    return { swapLimit: sqrtPrice, limitingTick: { index, initialized: init } }
  } else {
    return { swapLimit: sqrtPriceLimit, limitingTick: null }
  }
}

export const simulateSwap = (swapParameters: SimulateSwapInterface): SimulationResult => {
  const { xToY, byAmountIn, swapAmount, slippage, ticks, tickmap, pool } = swapParameters
  let { currentTickIndex, tickSpacing, liquidity, fee } = pool
  const amountPerTick: BN[] = []
  let accumulatedAmount: BN = new BN(0)
  let accumulatedAmountOut: BN = new BN(0)
  let accumulatedFee: BN = new BN(0)
  const priceLimit = calculatePriceAfterSlippage(pool.sqrtPrice, slippage, !xToY)
  if (xToY) {
    if (pool.sqrtPrice.v.lt(priceLimit.v)) {
      throw new Error('Price limit is on the wrong side of price')
    }
  } else {
    if (pool.sqrtPrice.v.gt(priceLimit.v)) {
      throw new Error('Price limit is on the wrong side of price')
    }
  }
  let remainingAmount: BN = swapAmount
  while (!remainingAmount.lte(new BN(0))) {
    //find closest initielized tick
    const closerLimit: CloserLimit = {
      sqrtPriceLimit: priceLimit,
      xToY: xToY,
      currentTick: currentTickIndex,
      tickSpacing: tickSpacing,
      tickmap: tickmap
    }

    const { swapLimit, limitingTick } = getCloserLimit(closerLimit)
    const result = calculateSwapStep(
      pool.sqrtPrice,
      swapLimit,
      liquidity,
      remainingAmount,
      byAmountIn,
      fee
    )

    accumulatedAmountOut = accumulatedAmountOut.add(result.amountOut)
    accumulatedFee = accumulatedFee.add(result.feeAmount)

    let amountDiff: BN

    if (byAmountIn) {
      amountDiff = result.amountIn.add(result.feeAmount)
    } else {
      amountDiff = result.amountOut
    }

    remainingAmount = remainingAmount.sub(amountDiff)
    pool.sqrtPrice = result.nextPrice

    if (pool.sqrtPrice.v.eq(priceLimit.v) && remainingAmount.gt(new BN(0))) {
      throw new Error('Price would cross swap limit')
    }

    //crossing tick
    if (result.nextPrice.v.eq(swapLimit.v) && limitingTick != null) {
      const tickIndex: number = limitingTick.index
      const initialized: boolean = limitingTick.initialized

      if (initialized) {
        let tick = ticks.get(tickIndex) as Tick

        if (currentTickIndex >= tick.index !== tick.sign) {
          liquidity = { v: liquidity.v.add(tick.liquidityChange.v) }
        } else {
          liquidity = { v: liquidity.v.sub(tick.liquidityChange.v) }
        }
      }
      if (xToY && !remainingAmount.eq(new BN(0))) {
        currentTickIndex = tickIndex - tickSpacing
      } else {
        currentTickIndex = tickIndex
      }
    } else {
      currentTickIndex = getTickFromPrice(currentTickIndex, tickSpacing, result.nextPrice, xToY)
    }

    // add amount to array if tick was initialized otherwise accumulate amount for next iteration
    accumulatedAmount = accumulatedAmount.add(amountDiff)
    if ((limitingTick != null && limitingTick.initialized) || remainingAmount.eqn(0)) {
      amountPerTick.push(accumulatedAmount)
      accumulatedAmount = new BN(0)
    }
  }

  return {
    amountPerTick,
    accumulatedAmountOut,
    accumulatedFee
  }
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

export const getMaxTick = (tickSpacing: number) => {
  const limitedByPrice = MAX_TICK - (MAX_TICK % tickSpacing)
  const limitedByTickmap = TICK_LIMIT * tickSpacing
  return Math.min(limitedByPrice, limitedByTickmap)
}

export const getMinTick = (tickSpacing: number) => {
  const limitedByPrice = -MAX_TICK + (MAX_TICK % tickSpacing)
  const limitedByTickmap = -TICK_LIMIT * tickSpacing
  return Math.max(limitedByPrice, limitedByTickmap)
}
