import { Provider, BN, utils } from '@project-serum/anchor'
import {
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmRawTransaction,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js'
import { calculatePriceSqrt, MAX_TICK, Pair, TICK_LIMIT, Market } from '.'
import {
  Decimal,
  FeeTier,
  FEE_TIER,
  PoolStructure,
  Tickmap,
  Tick,
  PoolData,
  Errors,
  PositionInitData
} from './market'
import {
  calculateMinReceivedTokensByAmountIn,
  calculatePriceAfterSlippage,
  calculatePriceImpact,
  calculateSwapStep,
  getLiquidityByX,
  getLiquidityByY,
  getXfromLiquidity,
  isEnoughAmountToPushPrice,
  MIN_TICK,
  sqrt
} from './math'
import { alignTickToSpacing, getTickFromPrice } from './tick'
import { getNextTick, getPreviousTick, getSearchLimit } from './tickmap'
import { struct, u32, u8 } from '@solana/buffer-layout'
import { u64 } from '@solana/spl-token'
import { TokenInfo, TokenListContainer, TokenListProvider } from '@solana/spl-token-registry'

export const SEED = 'Invariant'
export const DECIMAL = 12
export const LIQUIDITY_SCALE = 6
export const GROWTH_SCALE = 24
export const PRICE_SCALE = 24
export const FEE_DECIMAL = 5
export const DENOMINATOR = new BN(10).pow(new BN(DECIMAL))
export const LIQUIDITY_DENOMINATOR = new BN(10).pow(new BN(LIQUIDITY_SCALE))
export const PRICE_DENOMINATOR = new BN(10).pow(new BN(PRICE_SCALE))
export const GROWTH_DENOMINATOR = new BN(10).pow(new BN(GROWTH_SCALE))
export const FEE_OFFSET = new BN(10).pow(new BN(DECIMAL - FEE_DECIMAL))
export const FEE_DENOMINATOR = 10 ** FEE_DECIMAL
export const U128MAX = new BN('340282366920938463463374607431768211455')
export const CONCENTRATION_FACTOR = 1.00001526069123
export const PROTOCOL_FEE: number = 0.01

export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xbbc',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers',
  CONSTRAINT_RAW = '0x7d3',
  CONSTRAINT_SEEDS = '0x7d6',
  ACCOUNT_OWNED_BY_WRONG_PROGRAM = '0xbbf'
}

export enum INVARIANT_ERRORS {
  ZERO_AMOUNT = '0x1770',
  ZERO_OUTPUT = '0x1771',
  WRONG_TICK = '0x1772',
  WRONG_LIMIT = '0x1773',
  INVALID_TICK_INDEX = '0x1774',
  INVALID_TICK_INTERVAL = '0x1775',
  NO_MORE_TICKS = '0x1776',
  TICK_NOT_FOUND = '0x1777',
  PRICE_LIMIT_REACHED = '0x1778',
  INVALID_TICK_LIQUIDITY = '0x1779',
  EMPTY_POSITION_POKES = '0x177a',
  INVALID_POSITION_LIQUIDITY = '0x177b',
  INVALID_POOL_LIQUIDITY = '0x177c',
  INVALID_POSITION_INDEX = '0x177d',
  POSITION_WITHOUT_LIQUIDITY = '0x177e',
  INVALID_POOL_TOKEN_ADDRESSES = '0x1780',
  NO_GAIN_SWAP = '0x1785',
  INVALID_TOKEN_ACCOUNT = '0x1786',
  INVALID_ADMIN = '0x1787',
  INVALID_AUTHORITY = '0x1788',
  INVALID_OWNER = '0x1789',
  INVALID_MINT = '0x178a',
  INVALID_TICKMAP = '0x178b',
  INVALID_TICKMAP_OWNER = '0x178c',
  INVALID_LIST_OWNER = '0x178d',
  INVALID_TICK_SPACING = '0x178e'
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
  priceLimit?: Decimal
  slippage: Decimal
  ticks: Map<number, Tick>
  tickmap: Tickmap
  pool: PoolData
}

export interface Simulation {
  xToY: boolean
  byAmountIn: boolean
  swapAmount: BN
  priceLimit: Decimal
  slippage: Decimal
  pool: PoolData
}

export interface SimulationResult {
  status: SimulationStatus
  amountPerTick: BN[]
  crossedTicks: number[]
  accumulatedAmountIn: BN
  accumulatedAmountOut: BN
  accumulatedFee: BN
  minReceived: BN
  priceImpact: BN
  priceAfterSwap: BN
}

export interface FeeGrowthInside {
  tickLower: Tick
  tickUpper: Tick
  tickCurrent: number
  feeGrowthGlobalX: Decimal
  feeGrowthGlobalY: Decimal
}

export interface TokensOwed {
  position: PositionClaimData
  feeGrowthInsideX: BN
  feeGrowthInsideY: BN
}

export interface SimulateClaim {
  position: PositionClaimData
  tickLower: Tick
  tickUpper: Tick
  tickCurrent: number
  feeGrowthGlobalX: Decimal
  feeGrowthGlobalY: Decimal
}
export interface PositionClaimData {
  liquidity: Decimal
  feeGrowthInsideX: Decimal
  feeGrowthInsideY: Decimal
  tokensOwedX: Decimal
  tokensOwedY: Decimal
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

export const computeUnitsInstruction = (units: number, wallet: PublicKey) => {
  const program = new PublicKey('ComputeBudget111111111111111111111111111111')
  const params = { instruction: 0, units: units, additional_fee: 0 }
  const layout = struct([u8('instruction') as any, u32('units'), u32('additional_fee')])
  const data = Buffer.alloc(layout.span)
  layout.encode(params, data)
  const keys = [{ pubkey: wallet, isSigner: false, isWritable: false }]
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
  signers: Keypair[],
  connection: Connection,
  opts?: ConfirmOptions
) => {
  tx.setSigners(...signers.map(s => s.publicKey))
  const blockhash = await connection.getRecentBlockhash(
    opts?.commitment ?? Provider.defaultOptions().commitment
  )
  tx.recentBlockhash = blockhash.blockhash
  tx.partialSign(...signers)
  const rawTx = tx.serialize()
  return await sendAndConfirmRawTransaction(connection, rawTx, opts ?? Provider.defaultOptions())
}

export const sleep = async (ms: number) => {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

export const arithmeticalAverage = <T extends BN>(...args: T[]): T => {
  const sum = args.reduce((acc, val) => acc.add(val), new BN(0))
  return sum.divn(args.length) as T
}

export const tou64 = (amount: BN) => {
  // @ts-ignore
  return new u64(amount.toString())
}

export const fromFee = (fee: BN): BN => {
  // e.g fee - BN(1) -> 0.001%
  return fee.mul(FEE_OFFSET)
}

export const feeToTickSpacing = (fee: BN): number => {
  // linear relationship between fee and tickSpacing
  // tickSpacing = fee * 10^4
  if (fee.lte(fromFee(new BN(10)))) {
    return 1
  }

  const FEE_TO_SPACING_OFFSET = new BN(10).pow(new BN(DECIMAL - 4))
  return fee.div(FEE_TO_SPACING_OFFSET).toNumber()
}

export const FEE_TIERS: FeeTier[] = [
  { fee: fromFee(new BN(1)) },
  { fee: fromFee(new BN(10)) },
  { fee: fromFee(new BN(50)) },
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

  const ticks: number[] = []
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

export const toDecimalWithDenominator = (x: number, denominator: BN, decimals: number = 0) => {
  return { v: denominator.muln(x).div(new BN(10).pow(new BN(decimals))) }
}

export const calculateConcentration = (tickSpacing: number, minimumRange: number, n: number) => {
  const concentration = 1 / (1 - Math.pow(1.0001, (-tickSpacing * (minimumRange + 2 * n)) / 4))
  return concentration / CONCENTRATION_FACTOR
}

export const calculateTickDelta = (
  tickSpacing: number,
  minimumRange: number,
  concentration: number
) => {
  const base = Math.pow(1.0001, -(tickSpacing / 4))
  const logArg =
    (1 - 1 / (concentration * CONCENTRATION_FACTOR)) /
    Math.pow(1.0001, (-tickSpacing * minimumRange) / 4)

  return Math.ceil(Math.log(logArg) / Math.log(base) / 2)
}

export const getConcentrationArray = (
  tickSpacing: number,
  minimumRange: number,
  currentTick: number
): number[] => {
  const concentrations: number[] = []
  let counter = 0
  let concentration = 0
  let lastConcentration = calculateConcentration(tickSpacing, minimumRange, counter) + 1
  let concentrationDelta = 1

  while (concentrationDelta >= 1) {
    concentration = calculateConcentration(tickSpacing, minimumRange, counter)
    concentrations.push(concentration)
    concentrationDelta = lastConcentration - concentration
    lastConcentration = concentration
    counter++
  }
  concentration = Math.ceil(concentrations[concentrations.length - 1])

  while (concentration > 1) {
    concentrations.push(concentration)
    concentration--
  }
  const maxTick = alignTickToSpacing(MAX_TICK, tickSpacing)
  if ((minimumRange / 2) * tickSpacing > maxTick - Math.abs(currentTick)) {
    throw new Error(Errors.RangeLimitReached)
  }
  const limitIndex =
    (maxTick - Math.abs(currentTick) - (minimumRange / 2) * tickSpacing) / tickSpacing

  return concentrations.slice(0, limitIndex)
}

export const getPositionInitData = (
  tokenAmount: BN,
  tickSpacing: number,
  concentration: number,
  minimumRange: number,
  currentTick: number,
  currentPriceSqrt: Decimal,
  roundingUp: boolean,
  byAmountX: boolean
): PositionInitData => {
  let liquidity: Decimal
  let amountX: BN
  let amountY: BN
  const tickDelta = calculateTickDelta(tickSpacing, minimumRange, concentration)
  const lowerTick = currentTick - (tickDelta + minimumRange / 2) * tickSpacing
  const upperTick = currentTick + (tickDelta + minimumRange / 2) * tickSpacing

  if (byAmountX) {
    const result = getLiquidityByX(tokenAmount, lowerTick, upperTick, currentPriceSqrt, roundingUp)
    liquidity = result.liquidity
    amountX = tokenAmount
    amountY = result.y
  } else {
    const result = getLiquidityByY(tokenAmount, lowerTick, upperTick, currentPriceSqrt, roundingUp)

    liquidity = result.liquidity
    amountX = result.x
    amountY = tokenAmount
  }
  const positionData: PositionInitData = {
    lowerTick,
    upperTick,
    liquidity,
    amountX: amountX,
    amountY: amountY
  }

  return positionData
}

export const toPrice = (x: number, decimals: number = 0): Decimal => {
  return toDecimalWithDenominator(x, PRICE_DENOMINATOR, decimals)
}

export const toPercent = (x: number, decimals: number = 0): Decimal => {
  return toDecimalWithDenominator(x, DENOMINATOR, decimals)
}

export const getCloserLimit = (closerLimit: CloserLimit): CloserLimitResult => {
  const { sqrtPriceLimit, xToY, currentTick, tickSpacing, tickmap } = closerLimit

  let index: number | null = xToY
    ? getPreviousTick(tickmap, currentTick, tickSpacing)
    : getNextTick(tickmap, currentTick, tickSpacing)
  let sqrtPrice: Decimal
  let init: boolean

  if (index !== null) {
    sqrtPrice = calculatePriceSqrt(index)
    init = true
  } else {
    index = getSearchLimit(new BN(currentTick), new BN(tickSpacing), !xToY).toNumber()
    sqrtPrice = calculatePriceSqrt(index as number)
    init = false
  }
  if (xToY && sqrtPrice.v.gt(sqrtPriceLimit.v) && index !== null) {
    return { swapLimit: sqrtPrice, limitingTick: { index, initialized: init } }
  } else if (!xToY && sqrtPrice.v.lt(sqrtPriceLimit.v) && index !== null) {
    return { swapLimit: sqrtPrice, limitingTick: { index, initialized: init } }
  } else {
    return { swapLimit: sqrtPriceLimit, limitingTick: null }
  }
}

export enum SimulationStatus {
  Ok,
  WrongLimit = 'Price limit is on the wrong side of price',
  PriceLimitReached = 'Price would cross swap limit',
  TickNotFound = 'tick crossed but not passed to simulation',
  NoGainSwap = 'Amount out is zero',
  TooLargeGap = 'Too large liquidity gap',
  LimitReached = 'At the end of price range'
}

export const swapSimulation = async (
  xToY: boolean,
  byAmountIn: boolean,
  swapAmount: BN,
  priceLimit: Decimal,
  slippage: Decimal,
  market: Market,
  poolAddress: PublicKey
): Promise<SimulationResult> => {
  const { currentTickIndex, fee, tickSpacing, tokenX, tokenY, liquidity, sqrtPrice } =
    await market.getPoolByAddress(poolAddress)

  const feeTier: FeeTier = { fee: fee.v, tickSpacing }
  const pair: Pair = new Pair(tokenX, tokenY, feeTier)
  const tickmap = await market.getTickmap(pair)
  const allTicks = await market.getAllTicks(pair)

  const ticks: Map<number, Tick> = new Map()
  allTicks.forEach(tick => {
    ticks.set(tick.index, tick)
  })

  const poolData: PoolData = {
    currentTickIndex,
    tickSpacing,
    liquidity,
    fee,
    sqrtPrice
  }

  const swapParameters: SimulateSwapInterface = {
    xToY,
    byAmountIn,
    swapAmount,
    priceLimit,
    slippage,
    ticks,
    tickmap,
    pool: poolData
  }

  return simulateSwap(swapParameters)
}

export const simulateSwap = (swapParameters: SimulateSwapInterface): SimulationResult => {
  const {
    xToY,
    byAmountIn,
    swapAmount,
    slippage,
    ticks,
    tickmap,
    priceLimit: optionalPriceLimit,
    pool
  } = swapParameters
  let { currentTickIndex, tickSpacing, liquidity, sqrtPrice, fee } = pool
  const startingSqrtPrice = sqrtPrice.v
  let previousTickIndex = MAX_TICK + 1
  const amountPerTick: BN[] = []
  const crossedTicks: number[] = []
  const priceLimit =
    optionalPriceLimit ?? xToY ? calculatePriceSqrt(MIN_TICK) : calculatePriceSqrt(MAX_TICK)
  let accumulatedAmount: BN = new BN(0)
  let accumulatedAmountOut: BN = new BN(0)
  let accumulatedAmountIn: BN = new BN(0)
  let accumulatedFee: BN = new BN(0)
  const priceLimitAfterSlippage = calculatePriceAfterSlippage(priceLimit, slippage, !xToY)

  // Sanity check, should never throw
  if (xToY) {
    if (sqrtPrice.v.lt(priceLimitAfterSlippage.v)) {
      throw new Error(SimulationStatus.WrongLimit)
    }
  } else {
    if (sqrtPrice.v.gt(priceLimitAfterSlippage.v)) {
      throw new Error(SimulationStatus.WrongLimit)
    }
  }

  let remainingAmount: BN = swapAmount
  let status = SimulationStatus.Ok

  while (!remainingAmount.lte(new BN(0))) {
    // find closest initialized tick
    const closerLimit: CloserLimit = {
      sqrtPriceLimit: priceLimitAfterSlippage,
      xToY: xToY,
      currentTick: currentTickIndex,
      tickSpacing: tickSpacing,
      tickmap: tickmap
    }

    const { swapLimit, limitingTick } = getCloserLimit(closerLimit)
    const result = calculateSwapStep(
      sqrtPrice,
      swapLimit,
      liquidity,
      remainingAmount,
      byAmountIn,
      fee
    )

    accumulatedAmountIn = accumulatedAmountIn.add(result.amountIn)
    accumulatedAmountOut = accumulatedAmountOut.add(result.amountOut)
    accumulatedFee = accumulatedFee.add(result.feeAmount)

    let amountDiff: BN

    if (byAmountIn) {
      amountDiff = result.amountIn.add(result.feeAmount)
    } else {
      amountDiff = result.amountOut
    }

    remainingAmount = remainingAmount.sub(amountDiff)
    sqrtPrice = result.nextPrice

    if (sqrtPrice.v.eq(priceLimitAfterSlippage.v) && remainingAmount.gt(new BN(0))) {
      // throw new Error(SimulationErrors.PriceLimitReached)
      status = SimulationStatus.PriceLimitReached
      break
    }

    // crossing tick
    if (result.nextPrice.v.eq(swapLimit.v) && limitingTick != null) {
      const tickIndex: number = limitingTick.index
      const initialized: boolean = limitingTick.initialized

      const isEnoughAmountToCross = isEnoughAmountToPushPrice(
        remainingAmount,
        result.nextPrice,
        pool.liquidity,
        pool.fee,
        byAmountIn,
        xToY
      )

      // cross
      if (initialized) {
        if (!ticks.has(tickIndex)) {
          throw new Error(SimulationStatus.TickNotFound)
        }
        const tick = ticks.get(tickIndex) as Tick

        if (!xToY || isEnoughAmountToCross) {
          // trunk-ignore(eslint/no-mixed-operators)
          if (currentTickIndex >= tick.index !== tick.sign) {
            liquidity = { v: liquidity.v.add(tick.liquidityChange.v) }
          } else {
            liquidity = { v: liquidity.v.sub(tick.liquidityChange.v) }
          }
          crossedTicks.push(tickIndex)
        } else if (!remainingAmount.eqn(0)) {
          if (byAmountIn) {
            accumulatedAmountIn = accumulatedAmountIn.add(remainingAmount)
          }
          remainingAmount = new BN(0)
        }
      }
      if (xToY && isEnoughAmountToCross) {
        currentTickIndex = tickIndex - tickSpacing
      } else {
        currentTickIndex = tickIndex
      }
    } else {
      currentTickIndex = getTickFromPrice(currentTickIndex, tickSpacing, result.nextPrice, xToY)
    }

    // add amount to array if tick was initialized otherwise accumulate amount for next iteration
    accumulatedAmount = accumulatedAmount.add(amountDiff)
    // trunk-ignore(eslint/@typescript-eslint/prefer-optional-chain)
    const isTickInitialized = limitingTick !== null && limitingTick.initialized

    if (isTickInitialized || remainingAmount.eqn(0)) {
      amountPerTick.push(accumulatedAmount)
      accumulatedAmount = new BN(0)
    }

    // in the future this can be replaced by counter
    if (!isTickInitialized && liquidity.v.eqn(0)) {
      // throw new Error(SimulationErrors.TooLargeGap)
      status = SimulationStatus.TooLargeGap
      break
    }

    if (currentTickIndex === previousTickIndex && !remainingAmount.eqn(0)) {
      // throw new Error(SimulationErrors.LimitReached)
      status = SimulationStatus.LimitReached
      break
    } else {
      previousTickIndex = currentTickIndex
    }
  }

  if (accumulatedAmountOut.isZero() && status === SimulationStatus.Ok) {
    // throw new Error(SimulationErrors.NoGainSwap)
    status = SimulationStatus.NoGainSwap
  }

  const priceAfterSwap: BN = sqrtPrice.v
  const priceImpact = calculatePriceImpact(startingSqrtPrice, priceAfterSwap)

  let minReceived: BN
  if (byAmountIn) {
    const endingPriceAfterSlippage = calculatePriceAfterSlippage(
      { v: priceAfterSwap },
      slippage,
      !xToY
    ).v
    minReceived = calculateMinReceivedTokensByAmountIn(
      endingPriceAfterSlippage,
      xToY,
      accumulatedAmountIn,
      pool.fee.v
    )
  } else {
    minReceived = accumulatedAmountOut
  }

  return {
    status,
    amountPerTick,
    crossedTicks,
    accumulatedAmountIn,
    accumulatedAmountOut,
    accumulatedFee,
    priceAfterSwap,
    priceImpact,
    minReceived
  }
}

export const parseLiquidityOnTicks = (ticks: Tick[]) => {
  let currentLiquidity = new BN(0)

  return ticks.map(tick => {
    currentLiquidity = currentLiquidity.add(tick.liquidityChange.v.muln(tick.sign ? 1 : -1))
    return {
      liquidity: currentLiquidity,
      index: tick.index
    }
  })
}

export const calculateFeeGrowthInside = ({
  tickLower,
  tickUpper,
  tickCurrent,
  feeGrowthGlobalX,
  feeGrowthGlobalY
}: FeeGrowthInside) => {
  // determine position relative to current tick
  const currentAboveLower = tickCurrent >= tickLower.index
  const currentBelowUpper = tickCurrent < tickUpper.index
  let feeGrowthBelowX: BN
  let feeGrowthBelowY: BN
  let feeGrowthAboveX: BN
  let feeGrowthAboveY: BN

  // calculate fee growth below
  if (currentAboveLower) {
    feeGrowthBelowX = tickLower.feeGrowthOutsideX.v
    feeGrowthBelowY = tickLower.feeGrowthOutsideY.v
  } else {
    feeGrowthBelowX = feeGrowthGlobalX.v.sub(tickLower.feeGrowthOutsideX.v)
    feeGrowthBelowY = feeGrowthGlobalY.v.sub(tickLower.feeGrowthOutsideY.v)
  }

  // calculate fee growth above
  if (currentBelowUpper) {
    feeGrowthAboveX = tickUpper.feeGrowthOutsideX.v
    feeGrowthAboveY = tickUpper.feeGrowthOutsideY.v
  } else {
    feeGrowthAboveX = feeGrowthGlobalX.v.sub(tickUpper.feeGrowthOutsideX.v)
    feeGrowthAboveY = feeGrowthGlobalY.v.sub(tickUpper.feeGrowthOutsideY.v)
  }

  // calculate fee growth inside
  let feeGrowthInsideX = feeGrowthGlobalX.v.sub(feeGrowthBelowX).sub(feeGrowthAboveX)
  let feeGrowthInsideY = feeGrowthGlobalY.v.sub(feeGrowthBelowY).sub(feeGrowthAboveY)

  if (feeGrowthInsideX.lt(new BN(0))) {
    feeGrowthInsideX = U128MAX.sub(feeGrowthInsideX.abs()).addn(1)
  }
  if (feeGrowthInsideY.lt(new BN(0))) {
    feeGrowthInsideY = U128MAX.sub(feeGrowthInsideY.abs()).addn(1)
  }

  return [feeGrowthInsideX, feeGrowthInsideY]
}

export const calculateTokensOwed = ({
  position,
  feeGrowthInsideX,
  feeGrowthInsideY
}: TokensOwed) => {
  let tokensOwedX
  let tokensOwedY
  if (feeGrowthInsideX.lt(position.feeGrowthInsideX.v)) {
    tokensOwedX = position.liquidity.v
      .mul(feeGrowthInsideX.add(U128MAX.sub(position.feeGrowthInsideX.v)))
      .div(new BN(10).pow(new BN(DECIMAL + LIQUIDITY_SCALE)))
  } else {
    tokensOwedX = position.liquidity.v
      .mul(feeGrowthInsideX.sub(position.feeGrowthInsideX.v))
      .div(new BN(10).pow(new BN(DECIMAL + LIQUIDITY_SCALE)))
  }
  if (feeGrowthInsideY.lt(position.feeGrowthInsideY.v)) {
    tokensOwedY = position.liquidity.v
      .mul(feeGrowthInsideY.add(U128MAX.sub(position.feeGrowthInsideY.v)))
      .div(new BN(10).pow(new BN(DECIMAL + LIQUIDITY_SCALE)))
  } else {
    tokensOwedY = position.liquidity.v
      .mul(feeGrowthInsideY.sub(position.feeGrowthInsideY.v))
      .div(new BN(10).pow(new BN(DECIMAL + LIQUIDITY_SCALE)))
  }
  const tokensOwedXTotal = position.tokensOwedX.v.add(tokensOwedX).div(DENOMINATOR)
  const tokensOwedYTotal = position.tokensOwedY.v.add(tokensOwedY).div(DENOMINATOR)
  return [tokensOwedXTotal, tokensOwedYTotal]
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
  const feeGrowthParams: FeeGrowthInside = {
    tickLower: tickLower,
    tickUpper: tickUpper,
    tickCurrent: tickCurrent,
    feeGrowthGlobalX: feeGrowthGlobalX,
    feeGrowthGlobalY: feeGrowthGlobalY
  }
  const [feeGrowthInsideX, feeGrowthInsideY] = calculateFeeGrowthInside(feeGrowthParams)

  const tokensOwedParams: TokensOwed = {
    position: position,
    feeGrowthInsideX: feeGrowthInsideX,
    feeGrowthInsideY: feeGrowthInsideY
  }

  const [tokensOwedXTotal, tokensOwedYTotal] = calculateTokensOwed(tokensOwedParams)

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
  const limitedByTickmap = TICK_LIMIT * tickSpacing - tickSpacing
  return Math.min(limitedByPrice, limitedByTickmap)
}

export const getMinTick = (tickSpacing: number) => {
  const limitedByPrice = -MAX_TICK + (MAX_TICK % tickSpacing)
  const limitedByTickmap = -TICK_LIMIT * tickSpacing
  return Math.max(limitedByPrice, limitedByTickmap)
}

export const getVolume = (
  volumeX: number,
  volumeY: number,
  previousSqrtPrice: Decimal,
  currentSqrtPrice: Decimal
): number => {
  const price = previousSqrtPrice.v.mul(currentSqrtPrice.v).div(PRICE_DENOMINATOR)
  const denominatedVolumeY = new BN(volumeY).mul(PRICE_DENOMINATOR).div(price).toNumber()
  return volumeX + denominatedVolumeY
}

export const getTokensInRange = (ticks: ParsedTick[], lowerTick: number, upperTick: number): BN => {
  let tokenXamount: BN = new BN(0)
  let currentIndex: number | null
  let nextIndex: number | null

  for (let i = 0; i < ticks.length - 1; i++) {
    currentIndex = ticks[i].index
    nextIndex = ticks[i + 1].index

    if (currentIndex >= lowerTick && currentIndex < upperTick) {
      const lowerSqrtPrice = calculatePriceSqrt(currentIndex)
      const upperSqrtPrice = calculatePriceSqrt(nextIndex)
      tokenXamount = tokenXamount.add(
        getXfromLiquidity(ticks[i].liquidity, upperSqrtPrice.v, lowerSqrtPrice.v)
      )
    }
  }

  return tokenXamount
}
export const getTokens = (liquidity: BN, lowerTickIndex: number, upperTickIndex: number): BN => {
  const lowerSqrtPrice = calculatePriceSqrt(lowerTickIndex)
  const upperSqrtPrice = calculatePriceSqrt(upperTickIndex)
  return getXfromLiquidity(liquidity, upperSqrtPrice.v, lowerSqrtPrice.v)
}

export const getTokensAndLiquidity = (
  ticks: ParsedTick[],
  currentTickIndex: number
): { tokens: BN; liquidity: BN; nextInitializedTick: number } => {
  let tokens: BN = new BN(0)
  let liquidity: BN = new BN(0)
  let currentIndex: number | null
  let nextIndex: number | null
  let nextInitializedTick: number = 0

  for (let i = 0; i < ticks.length - 1; i++) {
    currentIndex = ticks[i].index
    nextIndex = ticks[i + 1].index
    if (currentIndex == currentTickIndex) {
      nextInitializedTick = nextIndex
    }

    tokens = getTokens(ticks[i].liquidity, currentIndex, nextIndex)
    liquidity = liquidity.add(ticks[i].liquidity)
  }
  return { tokens, liquidity, nextInitializedTick }
}

export const getTokensAndLiquidityOnSingleTick = (
  ticks: Map<number, ParsedTick>,
  currentTickIndex: number,
  nextInitialized: number
): { singleTickTokens: BN; singleTickLiquidity: BN } => {
  const singleTickLiquidity = ticks.get(currentTickIndex)?.liquidity as BN
  const singleTickTokens = getTokens(singleTickLiquidity, currentTickIndex, nextInitialized)

  return { singleTickTokens, singleTickLiquidity }
}

export const getRangeBasedOnFeeGrowth = (
  tickArrayPrevious: ParsedTick[],
  tickMapCurrent: Map<number, ParsedTick>
): { tickLower: number | null; tickUpper: number | null } => {
  let tickLower: number | null = null
  let tickUpper: number | null = null
  let tickLowerIndex: number = -1
  let tickUpperIndex: number = -1
  let tickLowerIndexSaved = false

  let currentSnapTick: ParsedTick | undefined
  const MIN_INDEX = 0
  const MAX_INDEX = tickArrayPrevious.length - 1

  for (let i = 0; i < tickArrayPrevious.length - 1; i++) {
    currentSnapTick = tickMapCurrent.get(tickArrayPrevious[i].index)
    if (currentSnapTick === undefined) continue

    if (
      !(
        tickArrayPrevious[i].feeGrowthOutsideX.v.eq(currentSnapTick.feeGrowthOutsideX.v) &&
        tickArrayPrevious[i].feeGrowthOutsideY.v.eq(currentSnapTick.feeGrowthOutsideY.v)
      )
    ) {
      if (!tickLowerIndexSaved) {
        tickLowerIndex = i
        tickLowerIndexSaved = true
      }
      tickUpperIndex = i
    }
  }
  if (tickLowerIndex !== -1) {
    tickLower =
      tickLowerIndex > MIN_INDEX
        ? tickArrayPrevious[tickLowerIndex - 1].index
        : tickArrayPrevious[tickLowerIndex].index
  }
  if (tickUpperIndex !== -1) {
    tickUpper =
      tickUpperIndex < MAX_INDEX
        ? tickArrayPrevious[tickUpperIndex + 1].index
        : tickArrayPrevious[tickUpperIndex].index
  }
  return {
    tickLower,
    tickUpper
  }
}
export const parseFeeGrowthAndLiquidityOnTicksArray = (ticks: Tick[]): ParsedTick[] => {
  const sortedTicks = ticks.sort((a, b) => a.index - b.index)

  let currentLiquidity = new BN(0)
  return sortedTicks.map(tick => {
    currentLiquidity = currentLiquidity.add(tick.liquidityChange.v.muln(tick.sign ? 1 : -1))
    return {
      liquidity: currentLiquidity,
      index: tick.index,
      feeGrowthOutsideX: tick.feeGrowthOutsideX,
      feeGrowthOutsideY: tick.feeGrowthOutsideY
    }
  })
}

export const parseFeeGrowthAndLiquidityOnTicksMap = (ticks: Tick[]): Map<number, ParsedTick> => {
  const sortedTicks = ticks.sort((a, b) => a.index - b.index)
  let currentLiquidity = new BN(0)
  const ticksMap = new Map<number, ParsedTick>()
  sortedTicks.map(tick => {
    currentLiquidity = currentLiquidity.add(tick.liquidityChange.v.muln(tick.sign ? 1 : -1))
    ticksMap.set(tick.index, {
      liquidity: currentLiquidity,
      index: tick.index,
      feeGrowthOutsideX: tick.feeGrowthOutsideX,
      feeGrowthOutsideY: tick.feeGrowthOutsideY
    })
  })

  return ticksMap
}
export const calculateTokensRange = (
  ticksPreviousSnapshot: Tick[],
  ticksCurrentSnapshot: Tick[],
  currentTickIndex: number
): RangeData => {
  const tickArrayPrevious = parseFeeGrowthAndLiquidityOnTicksArray(ticksPreviousSnapshot)
  const tickArrayCurrent = parseFeeGrowthAndLiquidityOnTicksArray(ticksCurrentSnapshot)
  const tickMapCurrent = parseFeeGrowthAndLiquidityOnTicksMap(ticksCurrentSnapshot)
  if (!(tickArrayPrevious.length || tickArrayCurrent.length)) {
    throw new Error(Errors.TickArrayIsEmpty)
  }
  if (!(tickArrayPrevious.length && tickArrayCurrent.length)) {
    const notEmptyArray = tickArrayPrevious.length ? tickArrayPrevious : tickArrayCurrent
    const tickLower = notEmptyArray[0].index
    const tickUpper = notEmptyArray[notEmptyArray.length - 1].index
    const tokens = getTokensInRange(notEmptyArray, tickLower, tickUpper)

    return {
      tokens,
      tickLower,
      tickUpper
    }
  }

  let { tickLower, tickUpper } = getRangeBasedOnFeeGrowth(tickArrayPrevious, tickMapCurrent)

  if (tickLower == null || tickUpper == null) {
    const { lower, upper } = getTicksFromSwapRange(tickArrayCurrent, currentTickIndex)
    tickLower = lower
    tickUpper = upper
  }
  if (tickLower == null || tickUpper == null) {
    throw new Error(Errors.TickNotFound)
  }

  const tokensPrevious = getTokensInRange(tickArrayPrevious, tickLower, tickUpper)
  const tokensCurrent = getTokensInRange(tickArrayCurrent, tickLower, tickUpper)

  // arithmetic mean of tokensPrevious and tokensCurrent
  const tokens = tokensPrevious.add(tokensCurrent).divn(2)

  return {
    tokens,
    tickLower,
    tickUpper
  }
}

export const calculateTokensAndLiquidity = (
  ticksCurrentSnapshot: Tick[],
  currentTickIndex: number
): RewardData => {
  const tickArrayCurrent = parseFeeGrowthAndLiquidityOnTicksArray(ticksCurrentSnapshot)
  const tickMapCurrent = parseFeeGrowthAndLiquidityOnTicksMap(ticksCurrentSnapshot)
  if (tickArrayCurrent.length === 0) {
    throw new Error(Errors.TickArrayIsEmpty)
  }

  const { tokens, liquidity, nextInitializedTick } = getTokensAndLiquidity(
    tickArrayCurrent,
    currentTickIndex
  )

  const { singleTickTokens, singleTickLiquidity } = getTokensAndLiquidityOnSingleTick(
    tickMapCurrent,
    currentTickIndex,
    nextInitializedTick
  )
  return {
    tokens,
    liquidity,
    singleTickTokens,
    singleTickLiquidity
  }
}

export const calculatePoolLiquidityFromSnapshot = (
  ticksCurrentSnapshot: Tick[],
  currentTickIndex: number
): { poolLiquidity: BN } => {
  const tickArrayCurrent = parseFeeGrowthAndLiquidityOnTicksArray(ticksCurrentSnapshot)
  if (tickArrayCurrent.length === 0) {
    throw new Error(Errors.TickArrayIsEmpty)
  }

  const { liquidity } = getTokensAndLiquidity(tickArrayCurrent, currentTickIndex)

  return { poolLiquidity: liquidity }
}

export const dailyFactorPool = (tokenXamount: BN, volume: number, feeTier: FeeTier): number => {
  const fee: number = (feeTier.fee.toNumber() / DENOMINATOR.toNumber()) * (1 - PROTOCOL_FEE)
  return (volume * fee) / tokenXamount.toNumber()
}

export const getTicksFromSwapRange = (
  ticks: ParsedTick[],
  currentTickIndex: number
): { lower: number | null; upper: number | null } => {
  for (let i = 0; i < ticks.length - 1; i++) {
    const lower = ticks[i].index
    const upper = ticks[i + 1].index

    if (lower <= currentTickIndex && upper >= currentTickIndex) {
      return { lower, upper }
    }
  }
  return { lower: null, upper: null }
}

// use differnet avg
export const poolAPY = (params: ApyPoolParams): WeeklyData => {
  const {
    feeTier,
    currentTickIndex,
    activeTokens,
    ticksPreviousSnapshot,
    ticksCurrentSnapshot,
    weeklyData,
    volumeX,
    volumeY
  } = params
  const { weeklyFactor, weeklyRange } = weeklyData
  let dailyFactor: number | null
  let dailyRange: Range
  let dailyTokens: BN = new BN(0)
  let dailyVolumeX: number = 0
  try {
    const { tickLower, tickUpper, tokens: averageTokensFromRange } = calculateTokensRange(
      ticksPreviousSnapshot,
      ticksCurrentSnapshot,
      currentTickIndex
    )

    const previousSqrtPrice = calculatePriceSqrt(tickLower)
    const currentSqrtPrice = calculatePriceSqrt(tickUpper)
    const volume = getVolume(volumeX, volumeY, previousSqrtPrice, currentSqrtPrice)
    // arithmetical average of activeTokens and averageTokensFromRange
    const avgTokens = activeTokens.add(averageTokensFromRange).divn(2)
    dailyFactor = dailyFactorPool(avgTokens, volume, feeTier)
    dailyRange = { tickLower, tickUpper }
    dailyTokens = averageTokensFromRange
    dailyVolumeX = volumeX
  } catch (e: any) {
    dailyFactor = 0
    dailyRange = { tickLower: null, tickUpper: null }
  }

  const newWeeklyFactor = updateWeeklyFactor(weeklyFactor, dailyFactor)
  const newWeeklyRange = updateWeeklyRange(weeklyRange, dailyRange)

  const apy = (Math.pow(average(newWeeklyFactor) + 1, 365) - 1) * 100

  return {
    weeklyFactor: newWeeklyFactor,
    weeklyRange: newWeeklyRange,
    tokenXamount: dailyTokens,
    volumeX: dailyVolumeX,
    apy
  }
}

export const dailyFactorRewards = (
  rewardInUSD: number,
  tokenXamount: BN,
  tokenXprice: number,
  tokenDecimal: number,
  duration: number
): number => {
  return (
    rewardInUSD /
    (tokenXamount.div(new BN(10).pow(new BN(tokenDecimal))).toNumber() * tokenXprice * duration)
  )
}

export const rewardsAPY = (params: ApyRewardsParams): { apy: number; apySingleTick: number } => {
  const {
    currentTickIndex,
    currentLiquidity,
    allLiquidityInTokens,
    tickSpacing,
    rewardInUsd,
    tokenPrice,
    tokenDecimal,
    duration
  } = params

  if (currentLiquidity.eqn(0)) {
    return { apy: Infinity, apySingleTick: Infinity }
  }
  const decimal: BN = new BN(10).pow(new BN(tokenDecimal))
  const dailyRewards = rewardInUsd / duration
  const lowerSqrtPrice = calculatePriceSqrt(currentTickIndex).v
  const upperSqrtPrice = calculatePriceSqrt(currentTickIndex + tickSpacing).v

  const dailyFactor = (dailyRewards / allLiquidityInTokens.div(decimal).toNumber()) * tokenPrice

  const priceFactor = lowerSqrtPrice
    .mul(upperSqrtPrice)
    .div(upperSqrtPrice.sub(lowerSqrtPrice))
    .div(PRICE_DENOMINATOR)
    .toNumber()

  const rewardsFactor = (dailyRewards / tokenPrice) * decimal.toNumber()

  // dailyFactorSingleTick =  lowerSqrtPrice * upperSqrtPrice/ (upperSqrtPrice - lowerSqrtPrice) * 1/liquidity * dailyRewards/price / decimal
  const dailyFactorSingleTick =
    (priceFactor / currentLiquidity.div(LIQUIDITY_DENOMINATOR).toNumber()) * rewardsFactor

  const apy = Math.pow(dailyFactor + 1, 365) - 1
  const apySingleTick = Math.pow(dailyFactorSingleTick + 1, 365) - 1

  return { apy, apySingleTick }
}

export const positionsRewardAPY = (params: ApyPositionRewardsParams): number => {
  const {
    poolLiquidity,
    currentTickIndex,
    rewardInUsd,
    tokenPrice,
    tokenDecimal,
    duration,
    positionLiquidity,
    lowerTickIndex,
    upperTickIndex
  } = params

  // check if position is active
  if (!isActive(lowerTickIndex, upperTickIndex, currentTickIndex)) {
    return 0
  }
  if (poolLiquidity.eqn(0)) {
    return Infinity
  }
  const decimal: BN = new BN(10).pow(new BN(tokenDecimal))
  const dailyRewards = rewardInUsd / duration
  const liquidityRatio =
    positionLiquidity.v.mul(LIQUIDITY_DENOMINATOR).div(poolLiquidity).toNumber() /
    LIQUIDITY_DENOMINATOR.toNumber()
  const lowerSqrtPrice = calculatePriceSqrt(lowerTickIndex)
  const upperSqrtPrice = calculatePriceSqrt(upperTickIndex)
  const positionTokens = getXfromLiquidity(positionLiquidity.v, upperSqrtPrice.v, lowerSqrtPrice.v)
  const dailyFactor =
    (dailyRewards * liquidityRatio) / (positionTokens.div(decimal).toNumber() * tokenPrice)

  const positionApy = Math.pow(dailyFactor + 1, 365) - 1

  return positionApy
}

export const calculateUserDailyRewards = (params: UserDailyRewardsParams): number => {
  const {
    poolLiquidity,
    currentTickIndex,
    rewardInTokens,
    userLiquidity,
    duration,
    lowerTickIndex,
    upperTickIndex
  } = params
  // check if position is active
  if (!isActive(lowerTickIndex, upperTickIndex, currentTickIndex)) {
    return 0
  }
  if (poolLiquidity.eqn(0)) {
    return Infinity
  }

  const dailyRewards = rewardInTokens / duration

  const liquidityRatio =
    userLiquidity.v.mul(LIQUIDITY_DENOMINATOR).div(poolLiquidity).toNumber() /
    LIQUIDITY_DENOMINATOR.toNumber()

  return dailyRewards * liquidityRatio
}

export const average = (array: number[]) =>
  array.reduce((prev: number, curr: number) => prev + curr) / array.length

export const updateWeeklyFactor = (weeklyFactor: number[], dailyFactor: number): number[] => {
  weeklyFactor.shift()
  weeklyFactor.push(dailyFactor)
  return weeklyFactor
}

export const updateWeeklyRange = (weeklyRange: Range[], dailyRange: Range): Range[] => {
  weeklyRange.shift()
  weeklyRange.push(dailyRange)
  return weeklyRange
}

export const isActive = (lowerIndex: number, upperIndex: number, currentIndex: number): boolean => {
  return lowerIndex <= currentIndex && upperIndex > currentIndex
}

const coingeckoIdOverwrites = {
  '9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i': 'terrausd',
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 'lido-staked-sol',
  NRVwhjBQiUPYtfDT5zRBVJajzFQHaBUNtC7SNVvqRFa: 'nirvana-nirv'
}

export const getTokensData = async (): Promise<Record<string, TokenData>> => {
  const tokens: TokenListContainer = await new TokenListProvider().resolve()

  const tokenList = tokens
    .filterByClusterSlug('mainnet-beta')
    .getList()
    .filter(token => token.chainId === 101)

  const tokensObj: Record<string, TokenData> = {}

  tokenList.forEach((token: TokenInfo) => {
    tokensObj[token.address.toString()] = {
      // @ts-ignore
      id: coingeckoIdOverwrites?.[token.address.toString()] ?? token.extensions?.coingeckoId,
      decimals: token.decimals,
      ticker: token.symbol
    }
  })

  return tokensObj
}

export const getPrice = (sqrtPrice: Decimal, decimalDiff: number): Decimal => {
  const price = sqrtPrice.v.pow(new BN(2)) // sqrtPrice^2
  const priceWithCorrectPrecision = price.div(new BN(10).pow(new BN(40))) // price / 10^40, becouse now is 48 we need 8
  if (decimalDiff > 0) {
    return { v: priceWithCorrectPrecision.mul(new BN(10).pow(new BN(decimalDiff))) }
  }
  if (decimalDiff < 0) {
    return { v: priceWithCorrectPrecision.div(new BN(10).pow(new BN(Math.abs(decimalDiff)))) }
  }
  return { v: priceWithCorrectPrecision }
}

export const getPositionIndex = async (
  expectedAddress: PublicKey,
  invariantAddress: PublicKey,
  owner: PublicKey
): Promise<number> => {
  let index: number = -1
  let counter: number = 0
  let found: Boolean = false

  while (!found) {
    const indexBuffer = Buffer.alloc(4)
    indexBuffer.writeInt32LE(counter)

    const [positionAddress, positionBump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode('positionv1')), owner.toBuffer(), indexBuffer],
      invariantAddress
    )

    if (positionAddress.toString() == expectedAddress.toString()) {
      found = true
      index = counter
    }
    counter++
  }

  return index
}

export interface TokenData {
  id: string
  decimals: number
  ticker: string
}
export interface ParsedTick {
  liquidity: BN
  index: number
  feeGrowthOutsideX: Decimal
  feeGrowthOutsideY: Decimal
}

export interface LiquidityRange {
  tickLower: number
  tickUpper: number
}

export interface RangeData {
  tokens: BN
  tickLower: number
  tickUpper: number
}
export interface RewardData {
  tokens: BN
  liquidity: BN
  singleTickTokens: BN
  singleTickLiquidity: BN
}
export interface ApyPoolParams {
  feeTier: FeeTier
  currentTickIndex: number
  activeTokens: BN
  ticksPreviousSnapshot: Tick[]
  ticksCurrentSnapshot: Tick[]
  weeklyData: WeeklyData
  volumeX: number
  volumeY: number
}
export interface ApyRewardsParams {
  currentTickIndex: number
  currentLiquidity: BN
  allLiquidityInTokens: BN
  tickSpacing: number
  rewardInUsd: number
  tokenPrice: number
  tokenDecimal: number
  duration: number
}
export interface UserDailyRewardsParams {
  poolLiquidity: BN
  currentTickIndex: number
  rewardInTokens: number
  userLiquidity: Decimal
  duration: number
  lowerTickIndex: number
  upperTickIndex: number
}

export interface ApyPositionRewardsParams {
  poolLiquidity: BN
  currentTickIndex: number
  rewardInUsd: number
  tokenPrice: number
  tokenDecimal: number
  duration: number
  positionLiquidity: Decimal
  lowerTickIndex: number
  upperTickIndex: number
}

export interface WeeklyData {
  weeklyFactor: number[]
  weeklyRange: Range[]
  tokenXamount: BN
  volumeX: number
  apy: number
}

export interface Range {
  tickLower: number | null
  tickUpper: number | null
}
