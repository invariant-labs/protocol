import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initEverything } from './testUtils'
import {
  Market,
  Pair,
  LIQUIDITY_DENOMINATOR,
  Network,
  PRICE_DENOMINATOR,
  MIN_TICK
} from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { FEE_TIERS, fromFee } from '@invariant-labs/sdk/lib/utils'
import { simulateSwap, SimulationStatus, toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { CreateTick, InitPosition, Swap, Tick } from '@invariant-labs/sdk/src/market'
import { calculatePriceSqrt, getLiquidityByX, getLiquidityByY } from '@invariant-labs/sdk/src/math'

// test1:
// 1. setup a market with price 1.0
// 2. create user 1
// 3. open position w liquidity, deposits 100 A and 100 B between 0.9 and 1.1
// 4. create user 2 with 100 A
// 5. user 2 swaps 10 a for b - 10 times

describe('Multiple swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(10)),
    tickSpacing: 1
  }
  let market: Market
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
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('init pool with price equals to 1', async () => {
    await initEverything(market, [pair], admin, 0)
  })

  it('swap X to Y 10 times', async () => {
    //// create user and mint 100 token X and 100 token Y to user
    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = 10000
    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    //// create position from 0.9(tick index -1054 ) to 1.1 tick index (tick index 953)
    // price 1.1 is tick index 953   what is exactly 1.0999835611874733
    // price 0.9 is tick index -1054 what is exactly 0.9000592042233925 but we will take -953 to keep same amount of tokens

    const upperTick = 953
    const lowerTick = -953

    // calculate liquidity delta
    const liquidityByY = getLiquidityByY(
      new BN(mintAmount),
      lowerTick,
      upperTick,
      { v: PRICE_DENOMINATOR },
      true
    ).liquidity
    const liquidityByX = getLiquidityByX(
      new BN(mintAmount),
      lowerTick,
      upperTick,
      { v: PRICE_DENOMINATOR },
      true
    ).liquidity

    // calculation of liquidity might not be exactly equal on both tokens so taking smaller one
    const liquidityDelta = liquidityByY.v.lt(liquidityByX.v) ? liquidityByY : liquidityByX

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create second user for swap and mint 100 X tokens
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

    const amount = new BN(mintAmount)
    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    console.log('POOL BEFORE')

    let poolDataBefore = await market.getPool(pair)
    let reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    let reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount
    console.log('reserveXBefore ', reserveXBefore.toString())
    console.log('reserveYBefore ', reserveYBefore.toString())

    const userAmountXBefore = (await tokenX.getAccountInfo(accountX)).amount
    const userAmountYBefore = (await tokenY.getAccountInfo(accountY)).amount
    console.log('user token X before', userAmountXBefore.toString())
    console.log('user token Y before', userAmountYBefore.toString())

    // simulate swap first
    const ticks: Map<number, Tick> = new Map(
      (await market.getAllTicks(pair)).map(tick => {
        return [tick.index, tick]
      })
    )
    const tickmap = await market.getTickmap(pair)
    const {
      status,
      accumulatedAmountIn,
      accumulatedFee,
      accumulatedAmountOut,
      // trunk-ignore(eslint/@typescript-eslint/no-unused-vars)
      minReceived,
      amountPerTick,
      crossedTicks,
      priceImpact,
      priceAfterSwap
    } = simulateSwap({
      pool: poolDataBefore,
      byAmountIn: true,
      slippage: toDecimal(1, 2),
      priceLimit: poolDataBefore.sqrtPrice,
      swapAmount: new BN(1000),
      xToY: true,
      ticks,
      tickmap
    })

    assert.equal(SimulationStatus.Ok, status.valueOf())
    console.log('\n ########## simulation ##########')
    console.log('accumulatedAmountIn ', accumulatedAmountIn.toString())
    console.log('accumulatedFee ', accumulatedFee.toString())
    console.log('accumulatedAmountOut ', accumulatedAmountOut.toString())
    console.log('priceAfterSwap ', priceAfterSwap.toString())

    //Swap ten times X to Y
    console.log('\n ########## real swap ##########')
    // let counter = 10
    // while (counter--) {
    //console.log('************* iteration ', 10 - counter)
    poolDataBefore = await market.getPool(pair)
    console.log('liquidity before', poolDataBefore.liquidity.v.toString())
    reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount
    console.log('reserveXBefore ', reserveXBefore.toString())
    console.log('reserveYBefore ', reserveYBefore.toString())

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount: new BN(10000),
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 0),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapVars, owner)
    // }

    // Check pool
    // const poolData = await market.getPool(pair)
    // assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    // assert.equal(poolData.currentTickIndex, lowerTick)
    // assert.ok(poolData.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const userAmountXAfter = (await tokenX.getAccountInfo(accountX)).amount
    const userAmountYAfter = (await tokenY.getAccountInfo(accountY)).amount
    console.log('user token X after', userAmountXAfter.toString())
    console.log('user token Y after', userAmountYAfter.toString())

    const poolData = await market.getPool(pair)
    console.log('sqrtPrice', poolData.sqrtPrice.v.toString())
    console.log('liquidity after', poolData.liquidity.v.toString())
    console.log('feeGrowthGlobalX', poolData.feeGrowthGlobalX.v.toString())
    console.log('feeGrowthGlobalY', poolData.feeGrowthGlobalY.v.toString())

    console.log('feeProtocolTokenX', poolData.feeProtocolTokenX.toString())
    console.log('feeProtocolTokenY', poolData.feeProtocolTokenY.toString())
    const reserveXAfter = (await tokenX.getAccountInfo(poolData.tokenXReserve)).amount
    const reserveYAfter = (await tokenY.getAccountInfo(poolData.tokenYReserve)).amount
    console.log('reserveXAfter ', reserveXAfter.toString())
    console.log('reserveYAfter ', reserveYAfter.toString())

    // const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    // const reserveYDelta = reserveYBefore.sub(reserveYAfter)

    // // fee tokens           0.006 * 1000 = 6
    // // protocol fee tokens  ceil(6 * 0.01) = cei(0.06) = 1
    // // pool fee tokens      6 - 1 = 5
    // // fee growth global    5/1000000 = 5 * 10^-6
    // assert.ok(amountX.eqn(0))
    // assert.ok(amountY.eq(amount.subn(7)))
    // assert.ok(reserveXDelta.eq(amount))
    // assert.ok(reserveYDelta.eq(amount.subn(7)))
    // assert.equal(poolData.feeGrowthGlobalX.v.toString(), '5000000000000000000')
    // assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    // assert.ok(poolData.feeProtocolTokenX.eqn(1))
    // assert.ok(poolData.feeProtocolTokenY.eqn(0))

    // assert.equal(poolData.currentTickIndex, -20)
  })

  // test2:
  // 1. setup a market with price 1.0
  // 2. create user 1
  // 3. open position w liquidity, deposits 100 A and 100 B between 0.9 and 1.1
  // 4. create user 2 with 100 A
  // 5. user 2 swaps 10 B for A - 10 times
})
