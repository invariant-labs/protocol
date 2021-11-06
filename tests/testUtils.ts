import { Connection, Keypair, Transaction } from '@solana/web3.js'
import { TokenInstructions } from '@project-serum/serum'
import { Token } from '@solana/spl-token'
import BN from 'bn.js'
import { DECIMAL, FEE_DECIMAL } from '@invariant-labs/sdk/src/utils'
import { Market, Position } from '@invariant-labs/sdk/lib/market'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { signAndSend } from '@invariant-labs/sdk'
import { fromFee } from '@invariant-labs/sdk/lib/utils'

export const STANDARD_FEE_TIER = [
  fromFee(new BN(20)), // 0.02% -> 4
  fromFee(new BN(40)), // 0.04% -> 8
  fromFee(new BN(100)), // 0.1%  -> 20
  fromFee(new BN(300)), // 0.3%  -> 60
  fromFee(new BN(1000)) // 1%    -> 200
]

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
  return positionWithoutOwnerEquals(a, b) && a.owner == b.owner
}

export const positionWithoutOwnerEquals = (a: Position, b: Position) => {
  return (
    eqDecimal(a.feeGrowthInsideX, b.feeGrowthInsideX) &&
    eqDecimal(a.feeGrowthInsideY, b.feeGrowthInsideY) &&
    eqDecimal(a.liquidity, b.liquidity) &&
    a.lowerTickIndex == b.lowerTickIndex &&
    a.upperTickIndex == b.upperTickIndex &&
    a.pool.equals(b.pool) &&
    a.id.eq(b.id) &&
    eqDecimal(a.tokensOwedX, b.tokensOwedX) &&
    eqDecimal(a.tokensOwedY, b.tokensOwedY)
  )
}

export const createStandardFeeTiers = async (market: Market, payer: Keypair) => {
  Promise.all(
    STANDARD_FEE_TIER.map(async (fee) => {
      await market.createFeeTier(fee.v, payer)
    })
  )
}
