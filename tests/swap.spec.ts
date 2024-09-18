import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import { Market, Pair, LIQUIDITY_DENOMINATOR, Network, sleep } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee, getBalance } from '@invariant-labs/sdk/lib/utils'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { CreateTick, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
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
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#swap() within a tick', async () => {
    // Deposit
    const upperTick = 10
    const createTickVars: CreateTick = {
      pair,
      index: upperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)

    const lowerTick = -20
    const createTickVars2: CreateTick = {
      pair,
      index: lowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)

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
    const liquidityDelta = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: -Infinity,
      upperTick: Infinity,
      liquidityDelta,
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
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
    await mintTo(connection, mintAuthority, pair.tokenX, accountX, mintAuthority, amount)

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reserveXBefore = await getBalance(connection, poolDataBefore.tokenXReserve)
    const reserveYBefore = await getBalance(connection, poolDataBefore.tokenYReserve)

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }
    await market.swap(swapVars, owner)
    await sleep(1000)

    // Check pool
    const poolData = await market.getPool(pair)
    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.equal(poolData.currentTickIndex, lowerTick)
    assert.ok(poolData.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const amountX = await getBalance(connection, accountX)
    const amountY = await getBalance(connection, accountY)
    const reserveXAfter = await getBalance(connection, poolData.tokenXReserve)
    const reserveYAfter = await getBalance(connection, poolData.tokenYReserve)
    const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    const reserveYDelta = reserveYBefore.sub(reserveYAfter)

    // fee tokens           0.006 * 1000 = 6
    // protocol fee tokens  ceil(6 * 0.01) = cei(0.06) = 1
    // pool fee tokens      6 - 1 = 5
    // fee growth global    5/1000000 = 5 * 10^-6
    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(amount.subn(7)))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(amount.subn(7)))
    assert.equal(poolData.feeGrowthGlobalX.v.toString(), '5000000000000000000')
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenX.eqn(1))
    assert.ok(poolData.feeProtocolTokenY.eqn(0))

    assert.equal(poolData.currentTickIndex, -20)
  })
})
