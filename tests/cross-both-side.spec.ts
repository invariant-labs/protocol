import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'
import {
  Market,
  Pair,
  TICK_LIMIT,
  Network,
  INVARIANT_ERRORS,
  calculatePriceSqrt
} from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { assertThrowsAsync, fromFee } from '@invariant-labs/sdk/lib/utils'
import { PRICE_DENOMINATOR, toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/src/market'
import { getLiquidityByX } from '@invariant-labs/sdk/lib/math'
import { DENOMINATOR } from '@invariant-labs/sdk'

describe('swap with cross both side', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const initTick = 0
  let market: Market
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
      payer: admin,
      initTick
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
  it('push price to tick without crossing and push price to tick with crossing', async () => {
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
    const lastTick = -20
    const createTickVars3: CreateTick = {
      pair,
      index: lastTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars3, admin)

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(5)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const { sqrtPrice } = await market.getPool(pair)
    const { liquidity: liquidityDelta } = getLiquidityByX(
      mintAmount.divn(10),
      lowerTick,
      upperTick,
      sqrtPrice,
      false,
      feeTier.tickSpacing
    )

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    const initPositionVars2: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: lastTick,
      upperTick: lowerTick,
      liquidityDelta,
      knownPrice: sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars2, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

    const limitWithoutCrossTickAmount = new BN(10068)
    const notCrossAmount = new BN(1)
    const minAmountToCrossFromTickPrice = new BN(3)
    const crossingAmountByAmountOut = new BN(20136101434)

    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)
    await tokenX.mintTo(
      accountX,
      mintAuthority.publicKey,
      [mintAuthority],
      tou64(
        limitWithoutCrossTickAmount
          .add(minAmountToCrossFromTickPrice)
          .add(notCrossAmount)
          .add(crossingAmountByAmountOut)
      )
    )

    // Swap
    const poolDataBefore = await market.getPool(pair)
    // const reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    // const reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount
    // const amountXBefore = (await tokenX.getAccountInfo(accountX)).amount
    // const amountYBefore = (await tokenY.getAccountInfo(accountY)).amount

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount: limitWithoutCrossTickAmount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapVars, owner)

    // Check pool
    const poolData = await market.getPool(pair)
    const expectedTick = -10
    const sqrtPriceAtTicks = calculatePriceSqrt(expectedTick)

    // not crossing
    assert.equal(poolData.currentTickIndex, expectedTick)
    assert.ok(poolData.sqrtPrice.v.eq(sqrtPriceAtTicks.v))
    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))

    // balances
    // const reserveX = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    // const reserveY = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount
    // const amountX = (await tokenX.getAccountInfo(accountX)).amount
    // const amountY = (await tokenY.getAccountInfo(accountY)).amount
    // TODO: validate state

    const swapNotCrossingVars: Swap = {
      pair,
      xToY: true,
      amount: notCrossAmount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await assertThrowsAsync(market.swap(swapNotCrossingVars, owner), INVARIANT_ERRORS.NO_GAIN_SWAP)
    // TODO: validate state

    // crossing tick with decreasing price
    const swapCrossingDecreasingVars: Swap = {
      pair,
      xToY: true,
      amount: minAmountToCrossFromTickPrice,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapCrossingDecreasingVars, owner)
    // TODO: validate state

    // crossing tick with increasing price
    const swapCrossingIncreasingVars: Swap = {
      pair,
      xToY: false,
      amount: minAmountToCrossFromTickPrice,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapCrossingIncreasingVars, owner)
    // TODO: validate state

    // Add massive amount of liquidity to test extreme case of high accuracy
    // OVERFLOW HAPPENS
    const massiveLiquidityAmountX = new BN(10).pow(new BN(19))
    const massiveLiquidityAmountY = new BN(10).pow(new BN(19))

    await tokenX.mintTo(
      userTokenXAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      tou64(massiveLiquidityAmountX)
    )
    await tokenY.mintTo(
      userTokenYAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      tou64(massiveLiquidityAmountY)
    )

    const currentPrice = (await market.getPool(pair)).sqrtPrice
    const { liquidity: massiveLiquidityDelta } = getLiquidityByX(
      massiveLiquidityAmountX,
      -20,
      0,
      currentPrice,
      false,
      feeTier.tickSpacing
    )

    const massiveInitPositionMassive: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: -20,
      upperTick: 0,
      liquidityDelta: massiveLiquidityDelta,
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(massiveInitPositionMassive, positionOwner)

    // Crossing tick with descending price and by 1 token amount out (with massive liquidity ~1/2 liquidity)
    const swapCrossingDecreasingByAmountOutVars: Swap = {
      pair,
      xToY: true,
      amount: new BN(1),
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: false,
      owner: owner.publicKey
    }
    await market.swap(swapCrossingDecreasingByAmountOutVars, owner)

    // Crossing tick with increasing price and by token amount in
    const swapCrossingIncreasingByAmountInVars: Swap = {
      pair,
      xToY: false,
      amount: new BN(2),
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapCrossingIncreasingByAmountInVars, owner)

    const finalPool = await market.getPool(pair)
    assert.equal(finalPool.currentTickIndex, -20)
    assert.ok(finalPool.feeGrowthGlobalX.v.eq(new BN('2999100269919024292')))
    assert.ok(finalPool.feeGrowthGlobalY.v.eq(new BN(0)))
    assert.ok(finalPool.feeProtocolTokenX.eq(new BN(4)))
    assert.ok(finalPool.feeProtocolTokenY.eq(new BN(2)))
    assert.ok(finalPool.liquidity.v.eq(new BN('19996000399699901991603000000')))
    assert.ok(finalPool.sqrtPrice.v.eq(new BN('999500149964999999999999')))

    const finalLastTick = await market.getTick(pair, lastTick)
    assert.ok(finalLastTick.feeGrowthOutsideX.v.eq(new BN(0)))
    assert.ok(finalLastTick.feeGrowthOutsideY.v.eq(new BN(0)))
    assert.ok(finalLastTick.liquidityChange.v.eq(new BN('19996000399699901991603000000')))

    const finalLowerTick = await market.getTick(pair, lowerTick)
    assert.ok(finalLowerTick.feeGrowthOutsideX.v.eq(new BN('2999100269919024292')))
    assert.ok(finalLowerTick.feeGrowthOutsideY.v.eq(new BN(0)))
    assert.ok(finalLowerTick.liquidityChange.v.eq(new BN(0)))

    const finalUpperTick = await market.getTick(pair, upperTick)
    assert.ok(finalUpperTick.feeGrowthOutsideX.v.eq(new BN(0)))
    assert.ok(finalUpperTick.feeGrowthOutsideY.v.eq(new BN(0)))
    assert.ok(finalUpperTick.liquidityChange.v.eq(new BN('20006000000000')))
  })
})
