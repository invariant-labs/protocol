import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import {
  Market,
  Pair,
  Network,
  LIQUIDITY_DENOMINATOR,
  PRICE_DENOMINATOR,
  sleep
} from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee, getBalance } from '@invariant-labs/sdk/lib/utils'
import { CreateTick, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

describe('reversed', () => {
  const provider = AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)), // 0.6%
    tickSpacing: 10
  }
  let market: Market
  let pair: Pair

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

    pair = new Pair(tokens[0], tokens[1], feeTier)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#swap() Y for X', async () => {
    // create ticks and owner
    for (let i = -100; i <= 90; i += 10) {
      const createTickVars: CreateTick = {
        pair,
        index: i,
        payer: admin.publicKey
      }
      await market.createTick(createTickVars, admin)
    }

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    await sleep(400)
    const userTokenXAccount = await createAssociatedTokenAccount(
      connection,
      positionOwner,
      pair.tokenX,
      positionOwner.publicKey
    )
    const userTokenYAccount = await createAssociatedTokenAccount(
      connection,
      positionOwner,
      pair.tokenY,
      positionOwner.publicKey
    )
    const mintAmount = tou64(new BN(10).pow(new BN(10)))
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenX,
      userTokenXAccount,
      mintAuthority,
      mintAmount
    )
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenY,
      userTokenYAccount,
      mintAuthority,
      mintAmount
    )

    const liquidityDelta = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }

    // Deposit
    const upperTick = 20
    const middleTick = 10
    const lowerTick = -10

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

    const initPositionVars2: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: middleTick,
      upperTick: upperTick + 20,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars2, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Prepare swapper
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      owner.publicKey
    )
    const accountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      owner.publicKey
    )

    const { tokenXReserve } = await market.getPool(pair)
    await mintTo(connection, mintAuthority, pair.tokenY, accountY, mintAuthority, amount)
    await mintTo(connection, mintAuthority, pair.tokenX, tokenXReserve, mintAuthority, amount)
    await sleep(1000)

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reservesBefore = await market.getReserveBalances(pair)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true
    }
    await market.swap(swapVars, owner)
    await sleep(1000)

    // Check pool
    const poolData = await market.getPool(pair)
    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v.muln(2)))
    assert.equal(poolData.currentTickIndex, middleTick)
    assert.ok(poolData.sqrtPrice.v.gt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const amountX = await getBalance(connection, accountX)
    const amountY = await getBalance(connection, accountY)
    const reservesAfter = await market.getReserveBalances(pair)
    const reserveXDelta = reservesBefore.x.sub(reservesAfter.x)
    const reserveYDelta = reservesAfter.y.sub(reservesBefore.y)

    assert.ok(amountX.eq(amount.subn(10)))
    assert.ok(amountY.eqn(0))
    assert.ok(reserveXDelta.eq(amount.subn(10)))
    assert.ok(reserveYDelta.eq(amount))

    assert.ok(poolData.feeGrowthGlobalX.v.eqn(0))
    assert.ok(poolData.feeGrowthGlobalY.v.eq(new BN('4000000000000000000')))
    assert.ok(poolData.feeProtocolTokenX.eqn(0))
    assert.ok(poolData.feeProtocolTokenY.eqn(2))

    // Check ticks
    const lowerTickData = await market.getTick(pair, lowerTick)
    const middleTickData = await market.getTick(pair, middleTick)
    const upperTickData = await market.getTick(pair, upperTick)

    assert.ok(upperTickData.liquidityChange.v.eq(liquidityDelta.v))
    assert.ok(middleTickData.liquidityChange.v.eq(liquidityDelta.v))
    assert.ok(lowerTickData.liquidityChange.v.eq(liquidityDelta.v))

    assert.ok(upperTickData.feeGrowthOutsideY.v.eqn(0))
    assert.ok(middleTickData.feeGrowthOutsideY.v.eq(new BN('3000000000000000000')))
    assert.ok(lowerTickData.feeGrowthOutsideY.v.eqn(0))
  })
})
