import { FeeTier, PoolStructure, Tick, Tickmap } from '@invariant-labs/sdk/src/market'
import { isInitialized, findClosestTicks } from '@invariant-labs/sdk/src/math'
import { FEE_DENOMINATOR } from '@invariant-labs/sdk/src/utils'
import { BN } from '@project-serum/anchor'

export const DECIMAL = 12
export const DENOMINATOR = new BN(10).pow(new BN(DECIMAL))
export const LIQUIDITY_DENOMINATOR = new BN(10).pow(new BN(6))
export const U128MAX = new BN('340282366920938463463374607431768211455')
export const PROTOCOL_FEE: number = 0.0001
export const FEE_TIER_DENOMINATOR: number = Math.pow(10, 10)

// hex code must be at the end of message
export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xa4',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers'
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

export const dailyFactorRewards = (reward: BN, liquidity: Decimal, duration: BN): number => {
  return (
    reward.mul(LIQUIDITY_DENOMINATOR).div(liquidity.v.mul(duration)).toNumber() /
    LIQUIDITY_DENOMINATOR.toNumber()
  )
}

export const dailyFactorPool = (volume: Decimal, liquidity: Decimal, feeTier: FeeTier): number => {
  const fee: number = (feeTier.fee.toNumber() / FEE_TIER_DENOMINATOR) * (1 - PROTOCOL_FEE)
  console.log('fee', fee)
  return (
    (volume.v.toNumber() * fee * LIQUIDITY_DENOMINATOR.toNumber()) /
    liquidity.v.toNumber() /
    LIQUIDITY_DENOMINATOR.toNumber()
  )
}

export const rewardsAPY = (dailyFactorRewards: number, duration: number): number => {
  return Math.pow(duration * dailyFactorRewards + 1, 365 / duration) - 1
}

export const poolAPY = (dailyFactorPool: number): number => {
  return Math.pow(dailyFactorPool + 1, 365) - 1
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
  const tickLower = priceLog(priceMinA / priceMinB)
  const tickUpper = priceLog(priceMaxA / priceMaxB)

  // check if tick are initialized
  const isLowerInitialized = isInitialized(tickmap, tickLower, tickSpacing)
  const isUpperInitialized = isInitialized(tickmap, tickUpper, tickSpacing)

  //
  if (!isLowerInitialized) {
    //find closest tick
    const closestTick = findClosestTicks(tickmap.bitmap, tickLower, tickSpacing, 200)
  } else {
  }

  if (!isUpperInitialized) {
    //find closest tick
    const closestTick = findClosestTicks(tickmap.bitmap, tickUpper, tickSpacing, 200)
  } else {
  }
  return { tickLower, tickUpper }
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
