import { FeeTier, PoolStructure, Tick, Tickmap } from '@invariant-labs/sdk/src/market'
import { isInitialized, findClosestTicks, MAX_TICK, MIN_TICK } from '@invariant-labs/sdk/src/math'
import { FEE_DENOMINATOR, parseLiquidityOnTicks } from '@invariant-labs/sdk/src/utils'
import { BN } from '@project-serum/anchor'
import { count } from 'console'

export const DECIMAL = 12
export const DENOMINATOR = new BN(10).pow(new BN(DECIMAL))
export const LIQUIDITY_DENOMINATOR = new BN(10).pow(new BN(6))
export const U128MAX = new BN('340282366920938463463374607431768211455')
export const PROTOCOL_FEE: number = 0.0001
export const FEE_TIER_DENOMINATOR: number = Math.pow(10, 10)

export enum Errors {
  TickNotFound = 'Tick was not found', // 0
  TickArrayIsEmpty = 'Tick array is empty' // 1
}
export enum STAKER_ERRORS {
  ZERO_AMOUNT = '0x1773',
  START_IN_PAST = '0x1775',
  TO_LONG_DURATION = '0x1774',
  ENDED = '0x1776',
  DIFFERENT_INCENTIVE_POOL = '0x1786'
}

export interface Decimal {
  v: BN
}

export const toDecimal = (x: number, decimals: number = 0): Decimal => {
  return { v: DENOMINATOR.muln(x).div(new BN(10).pow(new BN(decimals))) }
}

export const STAKER_SEED = Buffer.from('staker')

export const fromInteger = (integer: number): { v: BN } => {
  return { v: new BN(integer).mul(DENOMINATOR) }
}

export const calculateReward = ({
  totalRewardUnclaimed,
  totalSecondsClaimed,
  startTime,
  endTime,
  liquidity,
  secondsPerLiquidityInsideInitial,
  secondsPerLiquidityInside,
  currentTime
}: CalculateReward) => {
  if (currentTime.lte(startTime)) {
    throw Error("The incentive didn't start yet!")
  }
  const secondsInside = secondsPerLiquidityInside.v
    .sub(secondsPerLiquidityInsideInitial.v)
    .mul(liquidity.v)
    .div(LIQUIDITY_DENOMINATOR)
    .div(DENOMINATOR)
  const totalSecondsUnclaimed = new BN(Math.max(endTime.toNumber(), currentTime.toNumber()))
    .sub(startTime)
    .sub(totalSecondsClaimed)
  const result = totalRewardUnclaimed.mul(secondsInside).div(totalSecondsUnclaimed)

  return { secondsInside, result }
}

export const calculateSecondsPerLiquidityInside = ({
  tickLower,
  tickUpper,
  pool,
  currentTimestamp
}: SecondsPerLiquidityInside) => {
  const currentAboveLower = pool.currentTickIndex >= tickLower.index
  const currentBelowUpper = pool.currentTickIndex < tickUpper.index
  let secondsPerLiquidityBelow: BN
  let secondsPerLiquidityAbove: BN
  let secondsPerLiquidityInside: BN
  let secondsPerLiquidityGlobal: BN

  secondsPerLiquidityGlobal = pool.secondsPerLiquidityGlobal.v.add(
    currentTimestamp
      .sub(pool.lastTimestamp)
      .mul(DENOMINATOR) // align to fixed point precision
      .mul(LIQUIDITY_DENOMINATOR)
      .div(pool.liquidity.v)
  )
  //in case of overflow
  if (secondsPerLiquidityGlobal.gt(U128MAX)) {
    secondsPerLiquidityGlobal = secondsPerLiquidityGlobal.sub(U128MAX).addn(1)
  }
  if (currentAboveLower) {
    secondsPerLiquidityBelow = tickLower.secondsPerLiquidityOutside.v
  } else {
    // check possibility of underflow

    if (secondsPerLiquidityGlobal.gt(tickLower.secondsPerLiquidityOutside.v)) {
      secondsPerLiquidityBelow = secondsPerLiquidityGlobal.sub(
        tickLower.secondsPerLiquidityOutside.v
      )
    } else {
      secondsPerLiquidityBelow = secondsPerLiquidityGlobal
        .add(U128MAX)
        .sub(tickLower.secondsPerLiquidityOutside.v)
        .addn(1)
    }
  }
  if (currentBelowUpper) {
    secondsPerLiquidityAbove = tickUpper.secondsPerLiquidityOutside.v
  } else {
    // check possibility of underflow
    if (secondsPerLiquidityGlobal.gt(tickLower.secondsPerLiquidityOutside.v)) {
      secondsPerLiquidityAbove = secondsPerLiquidityGlobal.sub(
        tickUpper.secondsPerLiquidityOutside.v
      )
    } else {
      secondsPerLiquidityAbove = secondsPerLiquidityGlobal
        .add(U128MAX)
        .sub(tickUpper.secondsPerLiquidityOutside.v)
        .addn(1)
    }
  }

  if (secondsPerLiquidityBelow.add(secondsPerLiquidityAbove).lt(U128MAX)) {
    secondsPerLiquidityInside = secondsPerLiquidityGlobal
      .sub(secondsPerLiquidityBelow)
      .sub(secondsPerLiquidityAbove)
  } else {
    secondsPerLiquidityInside = secondsPerLiquidityGlobal
      .add(U128MAX)
      .sub(secondsPerLiquidityBelow)
      .sub(secondsPerLiquidityAbove)
      .addn(1)
  }

  // check possibility of underflow
  if (secondsPerLiquidityInside.lt(new BN(0))) {
    secondsPerLiquidityInside = U128MAX.sub(secondsPerLiquidityInside.abs()).addn(1)
  }

  return secondsPerLiquidityInside
}

export const priceLog = (val): number => {
  return Math.log(val) / Math.log(1.0001)
}

export const calculateLiquidity = (
  priceMinA: number,
  priceMaxA: number,
  priceMinB: number,
  priceMaxB: number,
  tickmap: Tickmap,
  tickSpacing: number,
  rawTicks: Tick[],
  pool: PoolStructure
): Decimal => {
  const { tickLower, tickUpper } = getRangeFromPrices(
    priceMinA,
    priceMaxA,
    priceMinB,
    priceMaxB,
    tickmap,
    tickSpacing
  )
  const ticks = getTickArray(rawTicks, pool)
  const liquidity = calculateAverageLiquidity(ticks, tickLower, tickUpper)
  return { v: liquidity }
}

export const dailyFactorRewards = (reward: BN, liquidity: Decimal, duration: BN): number => {
  return (
    reward.mul(LIQUIDITY_DENOMINATOR).div(liquidity.v.mul(duration)).toNumber() /
    LIQUIDITY_DENOMINATOR.toNumber()
  )
}

export const dailyFactorPool = (volume: Decimal, liquidity: Decimal, feeTier: FeeTier): number => {
  const fee: number = (feeTier.fee.toNumber() / FEE_TIER_DENOMINATOR) * (1 - PROTOCOL_FEE)
  return (
    (volume.v.toNumber() * fee * LIQUIDITY_DENOMINATOR.toNumber()) /
    liquidity.v.toNumber() /
    LIQUIDITY_DENOMINATOR.toNumber()
  )
}

export const rewardsAPY = (dailyFactorRewards: number, duration: number): number => {
  return (Math.pow(duration * dailyFactorRewards + 1, 365 / duration) - 1) * 100
}

export const poolAPY = (dailyFactorPool: number): number => {
  return (Math.pow(dailyFactorPool + 1, 365) - 1) * 100
}

export const getRangeFromPrices = (
  priceMinA: number,
  priceMaxA: number,
  priceMinB: number,
  priceMaxB: number,
  tickmap: Tickmap,
  tickSpacing: number
): LiquidityRange => {
  // calculate ticks from prices ratio between A and B
  let tickLower = priceLog(priceMinA / priceMinB)
  let tickUpper = priceLog(priceMaxA / priceMaxB)

  // check if tick are initialized
  const isLowerInitialized = isInitialized(tickmap, tickLower, tickSpacing)
  const isUpperInitialized = isInitialized(tickmap, tickUpper, tickSpacing)

  //find accurate if not initialized
  if (!isLowerInitialized) {
    //find closest tick on the right
    const closestTicks = findClosestTicks(
      tickmap.bitmap,
      tickLower,
      tickSpacing,
      MAX_TICK,
      tickUpper,
      'up'
    )
    if (!closestTicks.length) {
      throw new Error(Errors.TickNotFound)
    }
    tickLower = closestTicks[0]
  }

  if (!isUpperInitialized) {
    //find closest tick on the left
    const closestTicks = findClosestTicks(
      tickmap.bitmap,
      tickUpper,
      tickSpacing,
      MIN_TICK,
      tickLower,
      'down'
    )
    if (!closestTicks.length) {
      throw new Error(Errors.TickNotFound)
    }
    tickUpper = closestTicks[0]
  }

  return { tickLower, tickUpper }
}

export const getTickArray = (rawTicks: Tick[], pool: PoolStructure): TicksArray[] => {
  const sortedTicks = rawTicks.sort((a, b) => a.index - b.index)
  const ticks: TicksArray[] = rawTicks.length ? parseLiquidityOnTicks(sortedTicks, pool) : []
  if (!ticks.length) {
    throw new Error(Errors.TickArrayIsEmpty)
  }
  return ticks
}

export const calculateAverageLiquidity = (
  ticks: TicksArray[],
  lowerTick: number,
  upperTick: number
): BN => {
  let counter: BN = new BN(0)
  let sum: BN = new BN(0)
  let currentIndex = 0
  let nextIndex = 0
  let width: BN = new BN(0)

  for (let i = 0; i < ticks.length - 1; i++) {
    currentIndex = ticks[i].index
    nextIndex = ticks[i + 1].index

    if (currentIndex >= lowerTick && currentIndex < upperTick) {
      width = new BN(nextIndex).sub(new BN(currentIndex))
      counter = counter.add(width)
      sum = sum.add(width.mul(ticks[i].liquidity))
    }
  }
  return sum.div(counter)
}

export interface TicksArray {
  liquidity: BN
  index: number
}
export interface SecondsPerLiquidityInside {
  tickLower: Tick
  tickUpper: Tick
  pool: PoolStructure
  currentTimestamp: BN // unix timestamp in seconds
}
export interface CalculateReward {
  totalRewardUnclaimed: BN
  totalSecondsClaimed: BN
  startTime: BN
  endTime: BN
  liquidity: Decimal
  secondsPerLiquidityInsideInitial: Decimal
  secondsPerLiquidityInside: Decimal
  currentTime: BN
}
export interface LiquidityRange {
  tickLower: number
  tickUpper: number
}

export const TICKS = [
  { liquidity: new BN('264c6d4e386bb', 'hex'), index: -44363 }, // 673755091404475
  { liquidity: new BN('10f96d86ac1ebd', 'hex'), index: 10103 }, // 4777848433548989
  { liquidity: new BN('119f48c50da67d', 'hex'), index: 10107 }, // 4960209496548989
  { liquidity: new BN('9a6982917f848fd', 'hex'), index: 23563 }, // 4960209496548989
  { liquidity: new BN('119f48c50da67d', 'hex'), index: 23583 }, // 695410494738548989
  { liquidity: new BN('97361a0ee3a7cfd', 'hex'), index: 23939 }, // 4960209496548989
  { liquidity: new BN('9ec34bee8d1a03d', 'hex'), index: 23945 }, // 715004435399548989
  { liquidity: new BN('1a91636ae55727fd', 'hex'), index: 23947 }, // 1914420627374548989
  { liquidity: new BN('1c958e88117c9eac', 'hex'), index: 23948 }, // 2059709119651946156
  { liquidity: new BN('1d0d99acb6a69e6c', 'hex'), index: 23950 }, // 2093498368874946156
  { liquidity: new BN('32f9c880e2da056b', 'hex'), index: 23955 }, //
  { liquidity: new BN('7813fa9c39055ccf', 'hex'), index: 23956 }, //
  { liquidity: new BN('84c5de2c369bb171', 'hex'), index: 23957 }, //
  { liquidity: new BN('989927a105941c71', 'hex'), index: 23958 }, //
  { liquidity: new BN('8f376548dc6745f1', 'hex'), index: 23959 }, //
  { liquidity: new BN('9016af785152fef1', 'hex'), index: 23961 }, // 10382678922244587249
  { liquidity: new BN('990d91a1737d9e31', 'hex'), index: 23964 }, // 11028631185113587249
  { liquidity: new BN('9894be8378e67af1', 'hex'), index: 23965 }, // 10994622062196587249
  { liquidity: new BN('a2cbee7de39c5e31', 'hex'), index: 23966 }, // 11730731878873587249
  { liquidity: new BN('94049d5ca9358931', 'hex'), index: 23967 }, // 10665822838821587249
  { liquidity: new BN('9200723f7d101282', 'hex'), index: 23968 }, // 10520534346544190082
  { liquidity: new BN('9188671ad7e612c2', 'hex'), index: 23970 }, // 10486745097321190082
  { liquidity: new BN('a4539f382e6e70ec', 'hex'), index: 23971 }, // 11840982908933140716
  { liquidity: new BN('8fad6f7280509b3c', 'hex'), index: 23975 }, // 10353053655964359484
  { liquidity: new BN('4a933d572a2543d8', 'hex'), index: 23976 }, //
  { liquidity: new BN('3de159c72c8eef36', 'hex'), index: 23977 }, //
  { liquidity: new BN('34ea779e0a644ff6', 'hex'), index: 23978 }, //
  { liquidity: new BN('214d6bfe1ee48227', 'hex'), index: 23979 }, //
  { liquidity: new BN('206e21cea9f8c927', 'hex'), index: 23981 }, //
  { liquidity: new BN('21b9616a76f837e7', 'hex'), index: 23983 }, //
  { liquidity: new BN('178231700c4254a7', 'hex'), index: 23984 }, //
  { liquidity: new BN('15a453e54a23a1e7', 'hex'), index: 23987 }, //
  { liquidity: new BN('16fb56e2dd84dd33', 'hex'), index: 23990 }, //
  { liquidity: new BN('4301ec586fc7f09', 'hex'), index: 23991 }, //
  { liquidity: new BN('2b3e1e2256e5089', 'hex'), index: 23999 }, //
  { liquidity: new BN('168a246586ee1c9', 'hex'), index: 24003 }, //
  { liquidity: new BN('119f48c50da67d', 'hex'), index: 24010 }, //
  { liquidity: new BN('30aa213450e7b', 'hex'), index: 37831 }, //
  { liquidity: new BN('264c6d4e386bb', 'hex'), index: 37835 }, //
  { liquidity: new BN('0', 'hex'), index: 44362 } //
]
