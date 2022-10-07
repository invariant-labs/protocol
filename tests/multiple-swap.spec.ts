import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import { Market, Pair, Network, PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { simulateSwap, SimulationStatus, tou64 } from '@invariant-labs/sdk/src/utils'
import { InitPosition } from '@invariant-labs/sdk/src/market'
import { getLiquidity } from '@invariant-labs/sdk/src/math'

describe('Multiple swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const user1 = Keypair.generate()
  const user2 = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(10)),
    tickSpacing: 1
  }
  let market: Market
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

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
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
    await initMarket(market, [pair], admin, 0)

    // create position with the same amount of tokens (tick, -tick) when current price is 1
    // price range = (0.9, 1/0.9)
    const upperTick = 953
    const lowerTick = -upperTick
    const mintAmount = new BN(100)

    //// create user1 and mint 100 token X and 100 token Y to user1
    const [user1AccountX, user1AccountY] = await Promise.all([
      tokenX.createAccount(user1.publicKey),
      tokenY.createAccount(user1.publicKey)
    ])
    await Promise.all([
      tokenX.mintTo(user1AccountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount)),
      tokenY.mintTo(user1AccountY, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))
    ])

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
    const [user2AccountX, user2AccountY] = await Promise.all([
      tokenX.createAccount(user2.publicKey),
      tokenY.createAccount(user2.publicKey)
    ])
    await tokenX.mintTo(user2AccountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))

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
    }
  })
  it('swap Y to X 10 times', async () => {
    // initialize market
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
    await initMarket(market, [pair], admin, 0)

    // create position with the same amount of tokens (tick, -tick) when current price is 1
    // price range = (0.9, 1/0.9)
    const upperTick = 953
    const lowerTick = -upperTick
    const mintAmount = new BN(100)

    //// create user1 and mint 100 token X and 100 token Y to user1
    const [user1AccountX, user1AccountY] = await Promise.all([
      tokenX.createAccount(user1.publicKey),
      tokenY.createAccount(user1.publicKey)
    ])
    await Promise.all([
      tokenX.mintTo(user1AccountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount)),
      tokenY.mintTo(user1AccountY, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))
    ])

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
    const [user2AccountX, user2AccountY] = await Promise.all([
      tokenX.createAccount(user2.publicKey),
      tokenY.createAccount(user2.publicKey)
    ])
    await tokenX.mintTo(user2AccountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))

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
    }
  })
})
