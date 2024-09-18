import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import {
  Market,
  Pair,
  LIQUIDITY_DENOMINATOR,
  Network,
  sleep,
  PRICE_DENOMINATOR
} from '@invariant-labs/sdk'
import { FeeTier, InitPosition, Swap } from '@invariant-labs/sdk/lib/market'
import { fromFee, getBalance } from '@invariant-labs/sdk/lib/utils'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

describe('compare', () => {
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
  let firstPair: Pair
  let secondPair: Pair

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
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    firstPair = new Pair(tokens[0], tokens[1], feeTier)
    secondPair = new Pair(tokens[2], tokens[3], feeTier)
  })

  it('#init()', async () => {
    await initMarket(market, [firstPair, secondPair], admin)
  })

  it('#swap() within a tick', async () => {
    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      firstPair.tokenX,
      positionOwner.publicKey
    )
    const userTokenYAccount = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      firstPair.tokenY,
      positionOwner.publicKey
    )
    const userTokenZAccount = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      secondPair.tokenX,
      positionOwner.publicKey
    )
    const userTokenWAccount = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      secondPair.tokenY,
      positionOwner.publicKey
    )
    const mintAmount = new BN(10).pow(new BN(10))
    await mintTo(
      connection,
      mintAuthority,
      firstPair.tokenX,
      userTokenXAccount,
      mintAuthority,
      mintAmount
    )
    await mintTo(
      connection,
      mintAuthority,
      firstPair.tokenY,
      userTokenYAccount,
      mintAuthority,
      mintAmount
    )
    await mintTo(
      connection,
      mintAuthority,
      secondPair.tokenX,
      userTokenZAccount,
      mintAuthority,
      mintAmount
    )
    await mintTo(
      connection,
      mintAuthority,
      secondPair.tokenY,
      userTokenWAccount,
      mintAuthority,
      mintAmount
    )
    const liquidityDelta = { v: new BN(2000000).mul(LIQUIDITY_DENOMINATOR) }
    const lowerTick: number = -50
    const upperTick: number = 50
    await market.createPositionList(positionOwner.publicKey, positionOwner)

    // init position in first pool
    const initPositionVars: InitPosition = {
      pair: firstPair,
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

    // init position in second pool
    const initPositionVars2: InitPosition = {
      pair: secondPair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenZAccount,
      userTokenY: userTokenWAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars2, positionOwner)

    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)
    const accountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      firstPair.tokenX,
      owner.publicKey
    )
    const accountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      firstPair.tokenY,
      owner.publicKey
    )
    const accountZ = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      secondPair.tokenX,
      owner.publicKey
    )
    const accountW = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      secondPair.tokenY,
      owner.publicKey
    )
    await mintTo(
      connection,
      mintAuthority,
      firstPair.tokenX,
      accountX,
      mintAuthority,
      new BN(10000)
    )
    await mintTo(
      connection,
      mintAuthority,
      firstPair.tokenY,
      accountY,
      mintAuthority,
      new BN(10000)
    )
    await mintTo(
      connection,
      mintAuthority,
      secondPair.tokenX,
      accountZ,
      mintAuthority,
      new BN(10000)
    )
    await mintTo(
      connection,
      mintAuthority,
      secondPair.tokenY,
      accountW,
      mintAuthority,
      new BN(10000)
    )

    // Swap
    const firstPoolDataBefore = await market.getPool(firstPair)
    const secondPoolDataBefore = await market.getPool(secondPair)
    const reserveXBefore = await getBalance(connection, firstPoolDataBefore.tokenXReserve)
    const reserveYBefore = await getBalance(connection, firstPoolDataBefore.tokenYReserve)
    const reserveZBefore = await getBalance(connection, secondPoolDataBefore.tokenXReserve)
    const reserveWBefore = await getBalance(connection, secondPoolDataBefore.tokenYReserve)

    // make swap on first pool
    const swapVars: Swap = {
      pair: firstPair,
      owner: owner.publicKey,
      xToY: false,
      amount: new BN(500),
      estimatedPriceAfterSwap: firstPoolDataBefore.sqrtPrice,
      slippage: toDecimal(2, 2),
      accountX,
      accountY,
      byAmountIn: true
    }
    await market.swap(swapVars, owner)

    // make swap on second pool without simulation TODO
    const swapVars2: Swap = {
      pair: secondPair,
      owner: owner.publicKey,
      xToY: false,
      amount: new BN(500),
      estimatedPriceAfterSwap: secondPoolDataBefore.sqrtPrice,
      slippage: toDecimal(2, 2),
      accountX: accountZ,
      accountY: accountW,
      byAmountIn: true
    }
    await market.swap(swapVars2, owner)
    await sleep(1000)

    // Check pool
    const firstPoolData = await market.getPool(firstPair)
    const secondPoolData = await market.getPool(secondPair)

    // Check amounts and fees
    const amountX = await getBalance(connection, accountX)
    const amountY = await getBalance(connection, accountY)
    const amountZ = await getBalance(connection, accountZ)
    const amountW = await getBalance(connection, accountW)

    const reserveXAfter = await getBalance(connection, firstPoolDataBefore.tokenXReserve)
    const reserveYAfter = await getBalance(connection, firstPoolDataBefore.tokenYReserve)
    const reserveZAfter = await getBalance(connection, secondPoolDataBefore.tokenXReserve)
    const reserveWAfter = await getBalance(connection, secondPoolDataBefore.tokenYReserve)

    const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    const reserveYDelta = reserveYBefore.sub(reserveYAfter)
    const reserveZDelta = reserveZAfter.sub(reserveZBefore)
    const reserveWDelta = reserveWBefore.sub(reserveWAfter)

    assert.ok(amountX.eq(amountZ))
    assert.ok(amountY.eq(amountW))
    assert.ok(reserveXDelta.eq(reserveZDelta))
    assert.ok(reserveYDelta.eq(reserveWDelta))
    assert.ok(firstPoolData.feeGrowthGlobalX.v.eq(secondPoolData.feeGrowthGlobalX.v))
    assert.ok(firstPoolData.feeGrowthGlobalY.v.eq(secondPoolData.feeGrowthGlobalY.v))
    assert.ok(firstPoolData.feeProtocolTokenX.eq(secondPoolData.feeProtocolTokenX))
    assert.ok(firstPoolData.feeProtocolTokenY.eq(secondPoolData.feeProtocolTokenY))
  })
})
