import { BN } from '@project-serum/anchor'

export const DECIMAL = 12
export const DENOMINATOR = new BN(10).pow(new BN(DECIMAL))
export const LIQUIDITY_DENOMINATOR = new BN(10).pow(new BN(6))

// hex code must be at the end of message
export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xa4',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers'
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
  if (currentTime.v.lte(startTime.v)) {
    throw Error("The incentive didn't start yet!")
  }
  const secondsInside = secondsPerLiquidityInside.v
    .sub(secondsPerLiquidityInsideInitial.v)
    .mul(liquidity.v.mul(LIQUIDITY_DENOMINATOR))
    .div(DENOMINATOR)
  const totalSecondsUnclaimed = new BN(Math.max(endTime.v.toNumber(), currentTime.v.toNumber()))
    .sub(startTime.v)
    .sub(totalSecondsClaimed.v)
  const result = totalRewardUnclaimed.v.mul(secondsInside).div(totalSecondsUnclaimed)

  return { secondsInside, result }
}

export interface CalculateReward {
  totalRewardUnclaimed: Decimal
  totalSecondsClaimed: Decimal
  startTime: Decimal
  endTime: Decimal
  liquidity: Decimal
  secondsPerLiquidityInsideInitial: Decimal
  secondsPerLiquidityInside: Decimal
  currentTime: Decimal
}
