import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { TokenInstructions } from '@project-serum/serum'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { FeeTier, Market, Position } from '@invariant-labs/sdk/lib/market'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import BN from 'bn.js'
import { Pair } from '@invariant-labs/sdk'
import { tou64 } from '@invariant-labs/sdk'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { TICK_LIMIT } from '@invariant-labs/sdk'

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
    a.lastSlot.eq(b.lastSlot) &&
    eqDecimal(a.secondsPerLiquidityInside, b.secondsPerLiquidityInside) &&
    eqDecimal(a.tokensOwedX, b.tokensOwedX) &&
    eqDecimal(a.tokensOwedY, b.tokensOwedY)
  )
}

export const createStandardFeeTiers = async (market: Market, payer: Keypair) => {
  Promise.all(
    FEE_TIERS.map(async (feeTier) => {
      await market.createFeeTier(feeTier, payer)
    })
  )
}

export const createTokensAndPool = async (
  market: Market,
  connection: Connection,
  payer: Keypair,
  initTick: number = 0,
  feeTier: FeeTier = FEE_TIERS[0]
) => {
  const mintAuthority = Keypair.generate()

  const promiseResults = await Promise.all([
    createToken(connection, payer, mintAuthority),
    createToken(connection, payer, mintAuthority),
    connection.requestAirdrop(mintAuthority.publicKey, 1e9)
  ])

  const pair = new Pair(promiseResults[0].publicKey, promiseResults[1].publicKey, feeTier)
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, payer)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, payer)
  const feeTierAccount = await connection.getAccountInfo(
    (
      await market.getFeeTierAddress(feeTier)
    ).address
  )
  if (feeTierAccount === null) {
    await market.createFeeTier(pair.feeTier, payer)
  }

  await market.create({
    pair,
    signer: payer,
    initTick
  })

  return { tokenX, tokenY, pair, mintAuthority }
}

export const createUserWithTokens = async (
  pair: Pair,
  connection: Connection,
  mintAuthority: Keypair,
  mintAmount: BN = new BN(1e9)
) => {
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, mintAuthority)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, mintAuthority)

  const owner = Keypair.generate()

  const [userAccountX, userAccountY] = await Promise.all([
    tokenX.createAccount(owner.publicKey),
    tokenY.createAccount(owner.publicKey),
    connection.requestAirdrop(owner.publicKey, 1e9)
  ])

  await Promise.all([
    tokenX.mintTo(userAccountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount)),
    tokenY.mintTo(userAccountY, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))
  ])

  return { owner, userAccountX, userAccountY }
}

export const createPoolWithLiquidity = async (
  market: Market,
  connection: Connection,
  payer: Keypair,
  liquidity: Decimal = { v: new BN(10).pow(new BN(22)) },
  initialTick: number = 0,
  lowerTick: number = -1000,
  upperTick: number = 1000
) => {
  const { pair, mintAuthority } = await createTokensAndPool(market, connection, payer, initialTick)
  const { owner, userAccountX, userAccountY } = await createUserWithTokens(
    pair,
    connection,
    mintAuthority,
    new BN(10).pow(new BN(14))
  )

  await market.initPosition(
    {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta: liquidity
    },
    owner
  )

  return { pair, mintAuthority }
}

export const setInitialized = (bitmap: number[], index: number) => {
  bitmap[Math.floor((index + TICK_LIMIT) / 8)] |= 1 << (index + TICK_LIMIT) % 8
}
