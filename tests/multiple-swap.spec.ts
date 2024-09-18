import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, eqDecimal, initMarket } from './testUtils'
import { Market, Pair, Network, PRICE_DENOMINATOR, sleep } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee, getBalance } from '@invariant-labs/sdk/lib/utils'
import { simulateSwap, SimulationStatus } from '@invariant-labs/sdk/src/utils'
import { InitPosition } from '@invariant-labs/sdk/src/market'
import { getLiquidity } from '@invariant-labs/sdk/src/math'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

describe('Multiple swap', () => {
  const provider = AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const user1 = Keypair.generate()
  const user2 = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(100)),
    tickSpacing: 1
  }
  let market: Market
  let pair: Pair

  before(async () => {
    // Request airdrops
    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(user1.publicKey, 1e9),
      connection.requestAirdrop(user2.publicKey, 1e9)
    ])

    // build market
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )
  })
  it('swap X to Y 10 times', async () => {
    // initialize market
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])
    pair = new Pair(tokens[0], tokens[1], feeTier)

    await initMarket(market, [pair], admin, 0)

    // create position with the same amount of tokens (tick, -tick) when current price is 1
    // price range = (0.9, 1/0.9)
    const upperTick = 953
    const lowerTick = -upperTick
    const mintAmount = new BN(100)

    //// create user1 and mint 100 token X and 100 token Y to user1

    const user1AccountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      user1.publicKey
    )
    const user1AccountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      user1.publicKey
    )
    await mintTo(connection, mintAuthority, pair.tokenX, user1AccountX, mintAuthority, mintAmount)
    await mintTo(connection, mintAuthority, pair.tokenY, user1AccountY, mintAuthority, mintAmount)

    // calculate required liquidity based on token amount
    const { liquidity: liquidityDelta } = getLiquidity(
      mintAmount,
      mintAmount,
      lowerTick,
      upperTick,
      { v: PRICE_DENOMINATOR },
      true,
      feeTier.tickSpacing
    )

    const initPositionVars: InitPosition = {
      pair,
      owner: user1.publicKey,
      userTokenX: user1AccountX,
      userTokenY: user1AccountY,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR }, // initial price = 1.0
      slippage: { v: new BN(0) } // 0% slippage
    }
    await market.initPosition(initPositionVars, user1)

    // create user2 for swap and mint 100 X tokens
    const swapAmount = new BN(10)
    const swapParams = {
      xToY: true,
      byAmountIn: true,
      slippage: { v: new BN(0) }
    }

    const user2AccountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      user2.publicKey
    )
    const user2AccountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      user2.publicKey
    )
    await mintTo(connection, mintAuthority, pair.tokenX, user2AccountX, mintAuthority, mintAmount)

    for (let i = 0; i < 10; i++) {
      // fetch required data to simulate swap
      const [poolData, ticks, tickmap] = await Promise.all([
        market.getPool(pair),
        market.getAllIndexedTicks(pair),
        market.getTickmap(pair)
      ])

      // simulate swap (required to determine valid price limit that tolerate slippage)
      const { status, priceAfterSwap } = simulateSwap({
        pool: poolData,
        swapAmount,
        ticks,
        tickmap,
        ...swapParams
      })
      assert.equal(SimulationStatus.Ok, status.valueOf())

      // swap
      await market.swap(
        {
          pair,
          amount: swapAmount,
          estimatedPriceAfterSwap: { v: priceAfterSwap },
          accountX: user2AccountX,
          accountY: user2AccountY,
          owner: user2.publicKey,
          ...swapParams
        },
        user2
      )

      await sleep(1000)
    }

    const {
      currentTickIndex,
      feeGrowthGlobalX,
      feeGrowthGlobalY,
      feeProtocolTokenX,
      feeProtocolTokenY,
      liquidity,
      sqrtPrice,
      tokenXReserve,
      tokenYReserve
    } = await market.getPool(pair)

    // validate pool data
    assert.equal(currentTickIndex, -821)
    assert.ok(feeGrowthGlobalX.v.eqn(0))
    assert.ok(feeGrowthGlobalY.v.eqn(0))
    assert.ok(feeProtocolTokenX.eqn(10))
    assert.ok(feeProtocolTokenY.eqn(0))
    assert.ok(eqDecimal(liquidity, liquidityDelta))
    assert.ok(eqDecimal(sqrtPrice, { v: new BN('959803483698079499776690') }))

    // validate pool reserves
    const reserveXAmount = await getBalance(connection, tokenXReserve)
    const reserveYAmount = await getBalance(connection, tokenYReserve)
    assert.ok(reserveXAmount.eq(new BN(200)))
    assert.ok(reserveYAmount.eq(new BN(20)))

    // validate user2 balances
    const user2XAmount = await getBalance(connection, user2AccountX)
    const user2YAmount = await getBalance(connection, user2AccountY)
    assert.ok(user2XAmount.eq(new BN(0)))
    assert.ok(user2YAmount.eq(new BN(80)))
  })
  it('swap Y to X 10 times', async () => {
    // initialize market
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])
    pair = new Pair(tokens[0], tokens[1], feeTier)

    await initMarket(market, [pair], admin, 0)

    // create position with the same amount of tokens (tick, -tick) when current price is 1
    // price range = (0.9, 1/0.9)
    const upperTick = 953
    const lowerTick = -upperTick
    const mintAmount = new BN(100)

    //// create user1 and mint 100 token X and 100 token Y to user1
    const user1AccountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      user1.publicKey
    )
    const user1AccountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      user1.publicKey
    )
    await mintTo(connection, mintAuthority, pair.tokenX, user1AccountX, mintAuthority, mintAmount)
    await mintTo(connection, mintAuthority, pair.tokenY, user1AccountY, mintAuthority, mintAmount)
    await sleep(1000)

    // calculate required liquidity based on token amount
    const { liquidity: liquidityDelta } = getLiquidity(
      mintAmount,
      mintAmount,
      lowerTick,
      upperTick,
      { v: PRICE_DENOMINATOR },
      true,
      feeTier.tickSpacing
    )

    const initPositionVars: InitPosition = {
      pair,
      owner: user1.publicKey,
      userTokenX: user1AccountX,
      userTokenY: user1AccountY,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR }, // initial price = 1.0
      slippage: { v: new BN(0) } // 0% slippage
    }

    await market.initPosition(initPositionVars, user1)

    // create user2 for swap and mint 100 X tokens
    const swapAmount = new BN(10)
    const swapParams = {
      xToY: false,
      byAmountIn: true,
      slippage: { v: new BN(0) }
    }

    const user2AccountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      user2.publicKey
    )
    const user2AccountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      user2.publicKey
    )
    await mintTo(connection, mintAuthority, pair.tokenY, user2AccountY, mintAuthority, mintAmount)
    await sleep(1000)

    for (let i = 0; i < 10; i++) {
      // fetch required data to simulate swap
      const [poolData, ticks, tickmap] = await Promise.all([
        market.getPool(pair),
        market.getAllIndexedTicks(pair),
        market.getTickmap(pair)
      ])

      // simulate swap (required to determine valid price limit that tolerate slippage)
      const { status, priceAfterSwap } = simulateSwap({
        pool: poolData,
        swapAmount,
        ticks,
        tickmap,
        ...swapParams
      })
      assert.equal(SimulationStatus.Ok, status.valueOf())

      // swap
      await market.swap(
        {
          pair,
          amount: swapAmount,
          estimatedPriceAfterSwap: { v: priceAfterSwap },
          accountX: user2AccountX,
          accountY: user2AccountY,
          owner: user2.publicKey,
          ...swapParams
        },
        user2
      )
      await sleep(1000)
    }
    const {
      currentTickIndex,
      feeGrowthGlobalX,
      feeGrowthGlobalY,
      feeProtocolTokenX,
      feeProtocolTokenY,
      liquidity,
      sqrtPrice,
      tokenXReserve,
      tokenYReserve
    } = await market.getPool(pair)

    // validate pool data
    assert.equal(currentTickIndex, 820)
    assert.ok(feeGrowthGlobalX.v.eqn(0))
    assert.ok(feeGrowthGlobalY.v.eqn(0))
    assert.ok(feeProtocolTokenX.eqn(0))
    assert.ok(feeProtocolTokenY.eqn(10))
    assert.ok(eqDecimal(liquidity, liquidityDelta))
    assert.ok(eqDecimal(sqrtPrice, { v: new BN('1041879944160074453234060') }))

    // validate pool reserves
    const reserveXAmount = await getBalance(connection, tokenXReserve)
    const reserveYAmount = await getBalance(connection, tokenYReserve)
    assert.ok(reserveXAmount.eq(new BN(20)))
    assert.ok(reserveYAmount.eq(new BN(200)))

    // validate user2 balances
    const user2XAmount = await getBalance(connection, user2AccountX)
    const user2YAmount = await getBalance(connection, user2AccountY)
    assert.ok(user2XAmount.eq(new BN(80)))
    assert.ok(user2YAmount.eq(new BN(0)))
  })
})
