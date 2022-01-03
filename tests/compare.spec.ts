import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'
import {
  Market,
  Pair,
  tou64,
  DENOMINATOR,
  signAndSend,
  TICK_LIMIT,
  Network
} from '@invariant-labs/sdk'
import { FeeTier, Decimal } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { toDecimal } from '@invariant-labs/sdk/src/utils'

describe('comapre', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) } // 10%
  let fisrtPair: Pair
  let secondPair: Pair
  let tokenX: Token
  let tokenY: Token
  let tokenZ: Token
  let tokenW: Token

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )

    // Request airdrops
    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    fisrtPair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, fisrtPair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, fisrtPair.tokenY, TOKEN_PROGRAM_ID, wallet)

    secondPair = new Pair(tokens[2].publicKey, tokens[3].publicKey, feeTier)
    tokenZ = new Token(connection, secondPair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenW = new Token(connection, secondPair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin, protocolFee)
    await market.createFeeTier(feeTier, admin)
  })
  it('#create()', async () => {
    await market.create({
      pair: fisrtPair,
      signer: admin
    })

    await market.create({
      pair: secondPair,
      signer: admin
    })

    //check first pool
    const fisrtPool = await market.get(fisrtPair)
    assert.ok(fisrtPool.tokenX.equals(tokenX.publicKey))
    assert.ok(fisrtPool.tokenY.equals(tokenY.publicKey))
    assert.ok(fisrtPool.fee.v.eq(feeTier.fee))
    assert.equal(fisrtPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(fisrtPool.liquidity.v.eqn(0))
    assert.ok(fisrtPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(fisrtPool.currentTickIndex == 0)
    assert.ok(fisrtPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(fisrtPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(fisrtPool.feeProtocolTokenX.v.eqn(0))
    assert.ok(fisrtPool.feeProtocolTokenY.v.eqn(0))

    const firstTickmapData = await market.getTickmap(fisrtPair)
    assert.ok(firstTickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(firstTickmapData.bitmap.every((v) => v == 0))

    // checkl second pool
    const secondPool = await market.get(secondPair)
    assert.ok(secondPool.tokenX.equals(tokenZ.publicKey))
    assert.ok(secondPool.tokenY.equals(tokenW.publicKey))
    assert.ok(secondPool.fee.v.eq(feeTier.fee))
    assert.equal(secondPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(secondPool.liquidity.v.eqn(0))
    assert.ok(secondPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(secondPool.currentTickIndex == 0)
    assert.ok(secondPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(secondPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(secondPool.feeProtocolTokenX.v.eqn(0))
    assert.ok(secondPool.feeProtocolTokenY.v.eqn(0))

    const secondTickmapData = await market.getTickmap(fisrtPair)
    assert.ok(secondTickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(secondTickmapData.bitmap.every((v) => v == 0))
  })

  it('#swap() within a tick', async () => {
    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const userTokenZAccount = await tokenZ.createAccount(positionOwner.publicKey)
    const userTokenWAccount = await tokenW.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenZ.mintTo(userTokenZAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenW.mintTo(userTokenWAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN(2000000).mul(DENOMINATOR) }
    const lowerTick: number = -50
    const upperTick: number = 50
    await market.createPositionList(positionOwner)

    //init position in first pool
    await market.initPosition(
      {
        pair: fisrtPair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      positionOwner
    )

    //init position in second pool
    await market.initPosition(
      {
        pair: secondPair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenZAccount,
        userTokenY: userTokenWAccount,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      positionOwner
    )
    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)
    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)
    const accountZ = await tokenZ.createAccount(owner.publicKey)
    const accountW = await tokenW.createAccount(owner.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))
    await tokenZ.mintTo(accountZ, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))
    await tokenW.mintTo(accountW, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))

    // Swap
    const firstPoolDataBefore = await market.get(fisrtPair)
    const secondPoolDataBefore = await market.get(secondPair)
    const reserveXBefore = (await tokenX.getAccountInfo(firstPoolDataBefore.tokenXReserve)).amount
    const reserveYBefore = (await tokenY.getAccountInfo(firstPoolDataBefore.tokenYReserve)).amount
    const reserveZBefore = (await tokenZ.getAccountInfo(secondPoolDataBefore.tokenXReserve)).amount
    const reserveWBefore = (await tokenW.getAccountInfo(secondPoolDataBefore.tokenYReserve)).amount

    //make swap on first pool
    const firstTx = await market.swapTransaction({
      pair: fisrtPair,
      XtoY: false,
      amount: new BN(500),
      knownPrice: firstPoolDataBefore.sqrtPrice,
      slippage: toDecimal(2, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    })
    await signAndSend(firstTx, [owner], connection)

    //make swap on second pool without simulation
    const secnodTx = await market.swapTransactionWithoutSimulation({
      pair: secondPair,
      XtoY: false,
      amount: new BN(500),
      knownPrice: secondPoolDataBefore.sqrtPrice,
      slippage: toDecimal(2, 2),
      accountX: accountZ,
      accountY: accountW,
      byAmountIn: true,
      owner: owner.publicKey
    })
    await signAndSend(secnodTx, [owner], connection)

    // Check pool
    const firstPoolData = await market.get(fisrtPair)
    const secondPoolData = await market.get(secondPair)

    // Check amounts and fees
    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const amountZ = (await tokenZ.getAccountInfo(accountZ)).amount
    const amountW = (await tokenW.getAccountInfo(accountW)).amount

    const reserveXAfter = (await tokenX.getAccountInfo(firstPoolData.tokenXReserve)).amount
    const reserveYAfter = (await tokenY.getAccountInfo(firstPoolData.tokenYReserve)).amount
    const reserveZAfter = (await tokenZ.getAccountInfo(secondPoolData.tokenXReserve)).amount
    const reserveWAfter = (await tokenW.getAccountInfo(secondPoolData.tokenYReserve)).amount

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
    assert.ok(firstPoolData.feeProtocolTokenX.v.eq(secondPoolData.feeProtocolTokenX.v))
    assert.ok(firstPoolData.feeProtocolTokenY.v.eq(secondPoolData.feeProtocolTokenY.v))
  })
})
