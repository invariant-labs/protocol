import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import { Market, Pair, LIQUIDITY_DENOMINATOR, Network } from '@invariant-labs/sdk'
import { FeeTier, InitPosition, Swap } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'

describe('compare', () => {
  const provider = Provider.local()
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
  let tokenX: Token
  let tokenY: Token
  let tokenZ: Token
  let tokenW: Token

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

    firstPair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, firstPair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, firstPair.tokenY, TOKEN_PROGRAM_ID, wallet)

    secondPair = new Pair(tokens[2].publicKey, tokens[3].publicKey, feeTier)
    tokenZ = new Token(connection, secondPair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenW = new Token(connection, secondPair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#init()', async () => {
    await initMarket(market, [firstPair, secondPair], admin)
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
    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)
    const accountZ = await tokenZ.createAccount(owner.publicKey)
    const accountW = await tokenW.createAccount(owner.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))
    await tokenZ.mintTo(accountZ, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))
    await tokenW.mintTo(accountW, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))

    // Swap
    const firstPoolDataBefore = await market.getPool(firstPair)
    const secondPoolDataBefore = await market.getPool(secondPair)
    const reserveXBefore = (await tokenX.getAccountInfo(firstPoolDataBefore.tokenXReserve)).amount
    const reserveYBefore = (await tokenY.getAccountInfo(firstPoolDataBefore.tokenYReserve)).amount
    const reserveZBefore = (await tokenZ.getAccountInfo(secondPoolDataBefore.tokenXReserve)).amount
    const reserveWBefore = (await tokenW.getAccountInfo(secondPoolDataBefore.tokenYReserve)).amount

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

    // Check pool
    const firstPoolData = await market.getPool(firstPair)
    const secondPoolData = await market.getPool(secondPair)

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
    assert.ok(firstPoolData.feeProtocolTokenX.eq(secondPoolData.feeProtocolTokenX))
    assert.ok(firstPoolData.feeProtocolTokenY.eq(secondPoolData.feeProtocolTokenY))
  })
})
