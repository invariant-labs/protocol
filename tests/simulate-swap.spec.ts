import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import {
  Market,
  Pair,
  PRICE_DENOMINATOR,
  LIQUIDITY_DENOMINATOR,
  TICK_LIMIT,
  Network,
  sleep
} from '@invariant-labs/sdk'
import {
  FeeTier,
  CreateFeeTier,
  CreatePool,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/lib/market'
import { fromFee, getBalance } from '@invariant-labs/sdk/lib/utils'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { createToken } from './testUtils'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

describe('swap', () => {
  const provider = AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
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
    assert.ok(createdPool.tokenX.equals(pair.tokenX))
    assert.ok(createdPool.tokenY.equals(pair.tokenY))
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

  // Working from version 1.9, therefore skipped
  // TODO
  it.skip('#swap', async () => {
    // Deposit

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
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
    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const liquidityDelta = { v: new BN(2000000).mul(LIQUIDITY_DENOMINATOR) }
    for (let i = -200; i < 200; i += 10) {
      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: i,
        upperTick: i + 10,
        liquidityDelta: liquidityDelta,
        knownPrice: { v: PRICE_DENOMINATOR },
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, positionOwner)
    }
    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

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

    await mintTo(connection, mintAuthority, pair.tokenX, accountX, mintAuthority, new BN(10000))
    await mintTo(connection, mintAuthority, pair.tokenY, accountY, mintAuthority, new BN(10000))

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reserveXBefore = await getBalance(connection, poolDataBefore.tokenXReserve)
    const reserveYBefore = await getBalance(connection, poolDataBefore.tokenYReserve)

    // make swap into right to move price from tick 0
    const swapVars: Swap = {
      pair,
      xToY: false,
      amount: new BN(500),
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(2, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapVars, owner)

    // make swap bigger than cross tick
    const swapVars2: Swap = {
      pair,
      xToY: true,
      amount: new BN(3000),
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(2, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapVars2, owner)
    await sleep(1000)

    // Check pool
    const poolData = await market.getPool(pair)

    // Check amounts and fees
    const amountX = await getBalance(connection, accountX)
    const amountY = await getBalance(connection, accountY)
    const reserveXAfter = await getBalance(connection, poolData.tokenXReserve)
    const reserveYAfter = await getBalance(connection, poolData.tokenYReserve)
    const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    const reserveYDelta = reserveYAfter.sub(reserveYBefore)

    assert.ok(amountX.eqn(7496))
    assert.ok(amountY.eqn(12477))
    assert.ok(reserveXDelta.eqn(2504))
    assert.ok(reserveYDelta.eqn(2477))

    assert.ok(poolData.feeGrowthGlobalX.v.eq(new BN('8000000000000000000'))) // 0.6 % of amount - protocol fee
    assert.ok(poolData.feeGrowthGlobalY.v.eq(new BN('1000000000000000000')))
    assert.ok(poolData.feeProtocolTokenX.eq(new BN(4)))
    assert.ok(poolData.feeProtocolTokenY.eq(new BN(1)))
  })
})
