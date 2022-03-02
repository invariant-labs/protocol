import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initEverything } from './testUtils'
import { Market, Pair, tou64, DENOMINATOR, Network } from '@invariant-labs/sdk'
import { FeeTier, Tick } from '@invariant-labs/sdk/lib/market'
import { fromFee, simulateSwap, SimulateSwapInterface } from '@invariant-labs/sdk/lib/utils'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { CreateTick, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { FEE_TIER } from '@invariant-labs/sdk/lib/market'
import { FEE_TIERS } from '@invariant-labs/sdk/lib/utils'

describe('swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = FEE_TIERS[0]
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

  it('#init()', async () => {
    await initEverything(market, [pair], admin)
  })

  it('#swap() within a tick', async () => {
    // Deposit
    const upperTick = 1
    const lowerTick = -1

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(16)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN('1651619929989051521970357888') }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta
    }
    await market.initPosition(initPositionVars, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

    const amount = new BN(1e9)
    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    const reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount: new BN(1e6),
      estimatedPriceAfterSwap: { v: new BN('999993589272131718667513') }, // ignore price impact using high slippage tolerance
      slippage: toDecimal(10, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapVars, owner)

    const ticksArray: Tick[] = await market.getClosestTicks(pair, Infinity)
    const ticks: Map<number, Tick> = new Map<number, Tick>()

    console.log(ticksArray.map(tick => tick.index))

    for (const tick of ticksArray) {
      ticks.set(tick.index, tick)
    }

    // const simProps: SimulateSwapInterface = {
    //   xToY: true,
    //   byAmountIn: true,
    //   swapAmount: new anchor.BN(1e10),
    //   priceLimit: poolDataBefore.sqrtPrice,
    //   slippage: { v: new anchor.BN(DENOMINATOR) },
    //   ticks,
    //   tickmap: await market.getTickmap(pair),
    //   pool: poolDataBefore
    // }

    // const result = simulateSwap(simProps)
    // console.log(poolDataBefore.liquidity.v.toString())

    // console.log('here', result.priceAfterSwap.toString())

    // console.log(result.amountPerTick.map(i => i.toString()))

    // console.log(
    //   result.accumulatedAmountIn.add(result.accumulatedFee).toString(),
    //   result.accumulatedAmountOut.toString()
    // )

    // // Check pool
    // const poolData = await market.getPool(pair)
    // assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    // assert.equal(poolData.currentTickIndex, lowerTick)
    // assert.ok(poolData.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    // // Check amounts and fees
    // const amountX = (await tokenX.getAccountInfo(accountX)).amount
    // const amountY = (await tokenY.getAccountInfo(accountY)).amount
    // const reserveXAfter = (await tokenX.getAccountInfo(poolData.tokenXReserve)).amount
    // const reserveYAfter = (await tokenY.getAccountInfo(poolData.tokenYReserve)).amount
    // const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    // const reserveYDelta = reserveYBefore.sub(reserveYAfter)

    // assert.ok(amountX.eqn(0))
    // assert.ok(amountY.eq(amount.subn(7)))
    // assert.ok(reserveXDelta.eq(amount))
    // assert.ok(reserveYDelta.eq(amount.subn(7)))
    // // assert.ok(poolData.feeGrowthGlobalX.v.eqn(5400000)) // 0.6 % of amount - protocol fee
    // assert.equal(poolData.feeGrowthGlobalX.v.toString(), '4000000000000000000')
    // assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    // assert.ok(poolData.feeProtocolTokenX.eqn(2))
    // assert.ok(poolData.feeProtocolTokenY.eqn(0))

    // assert.equal(poolData.currentTickIndex, -20)
  })
})
