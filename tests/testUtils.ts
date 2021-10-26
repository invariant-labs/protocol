import { Connection, Keypair } from '@solana/web3.js'
import { TokenInstructions } from '@project-serum/serum'
import { Token } from '@solana/spl-token'
import BN from 'bn.js'
import { Decimal } from '../sdk/lib/pool'
import { DECIMAL, FEE_DECIMAL } from '@invariant-labs/sdk/src/utils'
import { Position } from '@invariant-labs/sdk/lib/market'

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

export const eqDecimal = (x: Decimal, y: Decimal) => {
  return x.v.eq(y.v)
}

export const createToken = async (
  connection: Connection,
  payer: Keypair,
  mintAuthority: Keypair,
  decimals = 6
) => {
  const token = await Token.createMint(
    connection,
    payer,
    mintAuthority.publicKey,
    null,
    decimals,
    TokenInstructions.TOKEN_PROGRAM_ID
  )
  return token
}

// do not compare bump
export const positionEquals = (a: Position, b: Position) => {
  return positionWithoutOwnerPosition(a, b) && a.owner == b.owner
}

export const positionWithoutOwnerPosition = (a: Position, b: Position) => {
  return (
    eqDecimal(a.feeGrowthInsideX, b.feeGrowthInsideX) &&
    eqDecimal(a.feeGrowthInsideY, b.feeGrowthInsideY) &&
    eqDecimal(a.liquidity, b.liquidity) &&
    a.lowerTickIndex == b.lowerTickIndex &&
    a.upperTickIndex == b.upperTickIndex &&
    a.pool.equals(b.pool) &&
    eqDecimal(a.tokensOwedX, b.tokensOwedX) &&
    eqDecimal(a.tokensOwedY, b.tokensOwedY)
  )
}

export const fromFee = (fee: number): Decimal => {
  const PERCENT_NOMINATOR = 1000
  const val = new BN(fee * PERCENT_NOMINATOR).mul(new BN(10).pow(new BN(DECIMAL - FEE_DECIMAL)))
  return {
    v: val
  }
}
