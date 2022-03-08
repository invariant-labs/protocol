import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'
import {
  Market,
  Pair,
  tou64,
  LIQUIDITY_DENOMINATOR,
  TICK_LIMIT,
  Network,
  calculatePriceSqrt,
  PRICE_DENOMINATOR
} from '@invariant-labs/sdk'
import { Decimal, FeeTier } from '@invariant-labs/sdk/lib/market'
import { assertThrowsAsync, fromFee } from '@invariant-labs/sdk/lib/utils'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/src/market'

describe('Liquidity gap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const positionOwner = Keypair.generate()
  let userTokenXAccount: PublicKey
  let userTokenYAccount: PublicKey
  let market: Market
  let owner: Keypair
  let assumedTargetPrice: Decimal
  let accountX: PublicKey
  let accountY: PublicKey
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    // Request airdrops
    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)
  })
  it('#create()', async () => {
    const createPoolVars: CreatePool = {
      pair,
      payer: admin
    }
    await market.createPool(createPoolVars)

    const createdPool = await market.getPool(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(PRICE_DENOMINATOR))
    assert.ok(createdPool.currentTickIndex === 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length === TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v === 0))
  })
  it('swap to limit without crossing', async () => {
    // Deposit
    const upperTick = 10
    const createTickVars: CreateTick = {
      pair,
      index: upperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)

    const lowerTick = -10
    const createTickVars2: CreateTick = {
      pair,
      index: lowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)

    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN(20006000).mul(LIQUIDITY_DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

    const amount = new BN(10067)
    accountX = await tokenX.createAccount(owner.publicKey)
    accountY = await tokenY.createAccount(owner.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    const reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 0),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapVars, owner)

    // Check pool
    const poolData = await market.getPool(pair)
    assumedTargetPrice = poolData.sqrtPrice
    const sqrtPriceAtTick = calculatePriceSqrt(lowerTick)

    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.ok(poolData.currentTickIndex === lowerTick)
    assert.ok(poolData.sqrtPrice.v.eq(sqrtPriceAtTick.v))

    // Check amounts and fees
    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reserveXAfter = (await tokenX.getAccountInfo(poolData.tokenXReserve)).amount
    const reserveYAfter = (await tokenY.getAccountInfo(poolData.tokenYReserve)).amount
    const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    const reserveYDelta = reserveYBefore.sub(reserveYAfter)
    const expectedYAmountOut = new BN(9999)

    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(expectedYAmountOut))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(expectedYAmountOut))
    assert.equal(poolData.feeGrowthGlobalX.v.toString(), '2399280215935219434')
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenX.eqn(13))
    assert.ok(poolData.feeProtocolTokenY.eqn(0))
  })
  it('no liquidity swap should fail', async () => {
    // no liquidity swap
    const swapVars2: Swap = {
      pair,
      xToY: true,
      amount: new BN(1),
      estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 0),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await assertThrowsAsync(market.swap(swapVars2, owner))
  })
  it('should skip gap then swap', async () => {
    // Add liquidity
    const upperTickAfterSwap = -50
    const createTickVars: CreateTick = {
      pair,
      index: upperTickAfterSwap,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)
    const lowerTickAfterSwap = -90
    const createTickVars2: CreateTick = {
      pair,
      index: lowerTickAfterSwap,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)

    const liquidityDelta = { v: new BN(20008000).mul(LIQUIDITY_DENOMINATOR) }
    const initPositionAfterSwapVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: lowerTickAfterSwap,
      upperTick: upperTickAfterSwap,
      liquidityDelta,
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionAfterSwapVars, positionOwner)
    const nextSwapAmount = new BN(5000)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(nextSwapAmount))

    // const poolDataBefore = await market.getPool(pair)
    // const reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    // const reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount

    const nextSwapVars: Swap = {
      pair,
      xToY: true,
      amount: nextSwapAmount,
      estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 0),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(nextSwapVars, owner)

    // Check pool
    // const poolData = await market.getPool(pair)

    // TODO: validate state
    // assert.ok(
    //   poolData.liquidity.v.sub(poolDataBefore.liquidity.v).eq(new BN(2000).mul(DENOMINATOR))
    // )
    // assert.equal(poolData.currentTickIndex, -70)
    // assert.ok(poolData.sqrtPrice.v.eq(new BN('996515578784')))

    // // Check amounts and fees
    // const amountX = (await tokenX.getAccountInfo(accountX)).amount
    // const amountY = (await tokenY.getAccountInfo(accountY)).amount
    // const reserveXAfter = (await tokenX.getAccountInfo(poolData.tokenXReserve)).amount
    // const reserveYAfter = (await tokenY.getAccountInfo(poolData.tokenYReserve)).amount
    // const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    // const reserveYDelta = reserveYBefore.sub(reserveYAfter)

    // assert.ok(amountX.eqn(0))
    // assert.ok(amountY.eq(new BN(29760)))
    // assert.ok(reserveXDelta.eq(nextSwapAmount))
    // assert.ok(reserveYDelta.eq(new BN(19761)))
    // assert.ok(poolData.feeGrowthGlobalX.v.eq(new BN('7197360983628142266')))
    // assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    // assert.ok(poolData.feeProtocolTokenX.eqn(37))
    // assert.ok(poolData.feeProtocolTokenY.eqn(0))
  })
})
