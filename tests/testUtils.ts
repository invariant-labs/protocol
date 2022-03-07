import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { TokenInstructions } from '@project-serum/serum'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { FeeTier, Market, Position } from '@invariant-labs/sdk/lib/market'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  Decimal,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/src/market'
import { feeToTickSpacing, FEE_TIERS, generateTicksArray } from '@invariant-labs/sdk/src/utils'
import BN from 'bn.js'
import { Pair, tou64, TICK_LIMIT, calculatePriceSqrt } from '@invariant-labs/sdk'
import { assert } from 'chai'

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
  return positionWithoutOwnerEquals(a, b) && a.owner === b.owner
}

export const positionWithoutOwnerEquals = (a: Position, b: Position) => {
  return (
    eqDecimal(a.feeGrowthInsideX, b.feeGrowthInsideX) &&
    eqDecimal(a.feeGrowthInsideY, b.feeGrowthInsideY) &&
    eqDecimal(a.liquidity, b.liquidity) &&
    a.lowerTickIndex === b.lowerTickIndex &&
    a.upperTickIndex === b.upperTickIndex &&
    a.pool.equals(b.pool) &&
    a.id.eq(b.id) &&
    a.lastSlot.eq(b.lastSlot) &&
    eqDecimal(a.secondsPerLiquidityInside, b.secondsPerLiquidityInside) &&
    eqDecimal(a.tokensOwedX, b.tokensOwedX) &&
    eqDecimal(a.tokensOwedY, b.tokensOwedY)
  )
}

export const createStandardFeeTiers = async (market: Market, payer: Keypair) => {
  await Promise.all(
    FEE_TIERS.map(async feeTier => {
      const createFeeTierVars: CreateFeeTier = {
        feeTier,
        admin: payer.publicKey
      }
      await market.createFeeTier(createFeeTierVars, payer)
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
    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: payer.publicKey
    }
    await market.createFeeTier(createFeeTierVars, payer)
  }

  const createPoolVars: CreatePool = {
    pair,
    payer: payer,
    initTick
  }
  await market.createPool(createPoolVars)

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
  liquidity: Decimal = { v: new BN(10).pow(new BN(16)) },
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

  const initPositionVars: InitPosition = {
    pair,
    owner: owner.publicKey,
    userTokenX: userAccountX,
    userTokenY: userAccountY,
    lowerTick,
    upperTick,
    liquidityDelta: liquidity
  }
  await market.initPosition(initPositionVars, owner)

  return { pair, mintAuthority }
}

export const setInitialized = (bitmap: number[], index: number) => {
  bitmap[Math.floor((index + TICK_LIMIT) / 8)] |= 1 << (index + TICK_LIMIT) % 8
}

export const createPosition = async (
  lowerTick: number,
  upperTick: number,
  liquidity: BN,
  owner: Keypair,
  ownerTokenXAccount: PublicKey,
  ownerTokenYAccount: PublicKey,
  tokenX: Token,
  tokenY: Token,
  pair: Pair,
  market: Market,
  wallet: Keypair,
  mintAuthority: Keypair
) => {
  const mintAmount = tou64(new BN(10).pow(new BN(18)))
  if ((await tokenX.getAccountInfo(ownerTokenXAccount)).amount.eq(new BN(0))) {
    await tokenX.mintTo(ownerTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
  }
  if ((await tokenY.getAccountInfo(ownerTokenYAccount)).amount.eq(new BN(0))) {
    await tokenY.mintTo(ownerTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
  }

  const initPositionVars: InitPosition = {
    pair,
    owner: owner.publicKey,
    userTokenX: ownerTokenXAccount,
    userTokenY: ownerTokenYAccount,
    lowerTick,
    upperTick,
    liquidityDelta: { v: liquidity }
  }
  await market.initPosition(initPositionVars, owner)
}

export const performSwap = async (
  pair: Pair,
  xToY: boolean,
  amount: BN,
  estimatedPriceAfterSwap: Decimal,
  slippage: Decimal,
  byAmountIn: boolean,
  connection: Connection,
  market: Market,
  tokenX: Token,
  tokenY: Token,
  mintAuthority: Keypair
) => {
  const swapper = Keypair.generate()
  await connection.requestAirdrop(swapper.publicKey, 1e12)

  const accountX = await tokenX.createAccount(swapper.publicKey)
  const accountY = await tokenY.createAccount(swapper.publicKey)

  if (xToY) {
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))
  } else {
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(amount))
  }

  const swapVars: Swap = {
    pair,
    owner: swapper.publicKey,
    xToY,
    amount,
    estimatedPriceAfterSwap,
    slippage,
    accountX,
    accountY,
    byAmountIn
  }
  await market.swap(swapVars, swapper)
}

export const createTicksFromRange = async (
  market: Market,
  { pair, payer }: CreateTick,
  start: number,
  stop: number,
  signer: Keypair
) => {
  const step = pair.feeTier.tickSpacing ?? feeToTickSpacing(pair.feeTier.fee)

  await Promise.all(
    generateTicksArray(start, stop, step).map(async index => {
      const createTickVars: CreateTick = {
        pair,
        index,
        payer
      }
      await market.createTick(createTickVars, signer)
    })
  )
}

export const initEverything = async (
  market: Market,
  pairs: Pair[],
  admin: Keypair,
  initTick?: number
) => {
  await market.createState(admin.publicKey, admin)

  const state = await market.getState()
  const { bump } = await market.getStateAddress()
  const { programAuthority, nonce } = await market.getProgramAuthority()
  assert.ok(state.admin.equals(admin.publicKey))
  assert.ok(state.authority.equals(programAuthority))
  assert.ok(state.nonce === nonce)
  assert.ok(state.bump === bump)

  for (const pair of pairs) {
    try {
      await market.getFeeTier(pair.feeTier)
    } catch (e) {
      const createFeeTierVars: CreateFeeTier = {
        feeTier: pair.feeTier,
        admin: admin.publicKey
      }
      await market.createFeeTier(createFeeTierVars, admin)
    }

    const createPoolVars: CreatePool = {
      pair,
      payer: admin,
      initTick: initTick
    }
    await market.createPool(createPoolVars)

    const createdPool = await market.getPool(pair)
    assert.ok(createdPool.tokenX.equals(pair.tokenX))
    assert.ok(createdPool.tokenY.equals(pair.tokenY))
    assert.ok(createdPool.fee.v.eq(pair.feeTier.fee))
    assert.equal(createdPool.tickSpacing, pair.feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(calculatePriceSqrt(initTick ?? 0).v))
    assert.ok(createdPool.currentTickIndex === (initTick ?? 0))
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length === TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v === 0))
  }
}
