import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Market, Network, Pair, LIQUIDITY_DENOMINATOR } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createToken, initMarket } from './testUtils'
import { assert } from 'chai'
import {
  assertThrowsAsync,
  INVARIANT_ERRORS,
  toDecimal,
  tou64
} from '@invariant-labs/sdk/src/utils'
import { CreateTick, InitPosition, Swap, WithdrawProtocolFee } from '@invariant-labs/sdk/src/market'
import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'

describe('protocol-fee', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  let market: Market
  const lowerTick = -20
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let userTokenXAccount: PublicKey
  let userTokenYAccount: PublicKey

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#initPosition()', async () => {
    const upperTick = 10
    const lowerTick = -20

    const createTickVars: CreateTick = {
      pair,
      index: upperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)

    const createTickVars2: CreateTick = {
      pair,
      index: lowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)

    userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }

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

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))
  })
  it('#swap()', async () => {
    const swapper = Keypair.generate()
    await connection.requestAirdrop(swapper.publicKey, 1e9)

    const amount = new BN(1000)
    const accountX = await tokenX.createAccount(swapper.publicKey)
    const accountY = await tokenY.createAccount(swapper.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    const poolDataBefore = await market.getPool(pair)
    const reservesBeforeSwap = await market.getReserveBalances(pair, tokenX, tokenY)

    const swapVars: Swap = {
      pair,
      xToY: true,
      owner: swapper.publicKey,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true
    }
    await market.swap(swapVars, swapper)

    const poolDataAfter = await market.getPool(pair)
    assert.ok(poolDataAfter.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.ok(poolDataAfter.currentTickIndex === lowerTick)
    assert.ok(poolDataAfter.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reservesAfterSwap = await market.getReserveBalances(pair, tokenX, tokenY)
    const reserveXDelta = reservesAfterSwap.x.sub(reservesBeforeSwap.x)
    const reserveYDelta = reservesBeforeSwap.y.sub(reservesAfterSwap.y)
    const expectedProtocolFeeX = 1

    // fee tokens           0.006 * 1000 = 6
    // protocol fee tokens  ceil(6 * 0.01) = cei(0.06) = 1
    // pool fee tokens      6 - 1 = 5
    // fee growth global    5/1000000 = 5 * 10^-6
    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(amount.subn(7)))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(amount.subn(7)))
    assert.equal(poolDataAfter.feeGrowthGlobalX.v.toString(), '5000000000000000000')
    assert.ok(poolDataAfter.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolDataAfter.feeProtocolTokenX.eqn(expectedProtocolFeeX))
    assert.ok(poolDataAfter.feeProtocolTokenY.eqn(0))
  })

  it('Admin #withdrawProtocolFee()', async () => {
    const expectedProtocolFeeX = 1
    const adminAccountX = await tokenX.createAccount(admin.publicKey)
    const adminAccountY = await tokenY.createAccount(admin.publicKey)
    await tokenX.mintTo(adminAccountX, mintAuthority.publicKey, [mintAuthority], 1e9)
    await tokenY.mintTo(adminAccountY, mintAuthority.publicKey, [mintAuthority], 1e9)

    const reservesBeforeClaim = await market.getReserveBalances(pair, tokenX, tokenY)
    const adminAccountXBeforeClaim = (await tokenX.getAccountInfo(adminAccountX)).amount

    const withdrawProtocolFeeVars: WithdrawProtocolFee = {
      pair,
      accountX: adminAccountX,
      accountY: adminAccountY,
      admin: admin.publicKey
    }
    await market.withdrawProtocolFee(withdrawProtocolFeeVars, admin)

    const adminAccountXAfterClaim = (await tokenX.getAccountInfo(adminAccountX)).amount
    const reservesAfterClaim = await market.getReserveBalances(pair, tokenX, tokenY)

    const poolData = await market.getPool(pair)
    assert.equal(
      reservesBeforeClaim.x.toNumber(),
      reservesAfterClaim.x.toNumber() + expectedProtocolFeeX
    )
    assert.equal(
      adminAccountXAfterClaim.toNumber(),
      adminAccountXBeforeClaim.toNumber() + expectedProtocolFeeX
    )
    assert.equal(poolData.feeProtocolTokenX.toNumber(), 0)
    assert.equal(poolData.feeProtocolTokenY.toNumber(), 0)
  })
  it('Non-Admin #withdrawProtocolFee()', async () => {
    const user = Keypair.generate()
    await Promise.all([await connection.requestAirdrop(user.publicKey, 1e9)])
    const userAccountX = await tokenX.createAccount(user.publicKey)
    const userAccountY = await tokenY.createAccount(user.publicKey)
    await tokenX.mintTo(userAccountX, mintAuthority.publicKey, [mintAuthority], 1e9)
    await tokenY.mintTo(userAccountY, mintAuthority.publicKey, [mintAuthority], 1e9)

    const withdrawProtocolFeeVars: WithdrawProtocolFee = {
      pair,
      accountX: userAccountX,
      accountY: userAccountY,
      admin: user.publicKey
    }
    await assertThrowsAsync(
      market.withdrawProtocolFee(withdrawProtocolFeeVars, user),
      INVARIANT_ERRORS.INVALID_AUTHORITY
    )
  })
})
