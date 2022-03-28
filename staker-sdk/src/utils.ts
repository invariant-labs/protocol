import { BN } from '@project-serum/anchor'

export const DECIMAL = 12
export const DENOMINATOR = new BN(10).pow(new BN(DECIMAL))

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
