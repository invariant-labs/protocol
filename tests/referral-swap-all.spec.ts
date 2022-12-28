import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import { Market, Pair, LIQUIDITY_DENOMINATOR, Network } from '@invariant-labs/sdk'
import { FeeTier, Tick } from '@invariant-labs/sdk/lib/market'
import { fromFee, simulateSwap, SimulationStatus } from '@invariant-labs/sdk/lib/utils'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { CreateTick, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { calculatePriceSqrt } from '@invariant-labs/sdk'
import { MIN_TICK } from '@invariant-labs/sdk'

describe('Referral swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(500)),
    tickSpacing: 5
  }
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
    await initMarket(market, [pair], admin)
  })

  it('#swap() crossing tick with referral swap', async () => {
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
    const referralAccount = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const referralTokenXAccount = await tokenX.createAccount(referralAccount.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }

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
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: lowerTick,
        upperTick: upperTick,
        liquidityDelta,
        knownPrice: (await market.getPool(pair)).sqrtPrice,
        slippage: { v: new BN(0) }
      },
      positionOwner
    )

    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

    const amount = new BN(100000)
    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    const reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount
    const referralTokenXBefore = (await tokenX.getAccountInfo(referralTokenXAccount)).amount

    // simulate swap before
    const ticks: Map<number, Tick> = new Map(
      (await market.getAllTicks(pair)).map(tick => {
        return [tick.index, tick]
      })
    )
    const tickmap = await market.getTickmap(pair)
    const {
      status,
      accumulatedAmountIn,
      accumulatedFee,
      accumulatedAmountOut,
      minReceived,
      amountPerTick,
      crossedTicks,
      priceImpact,
      priceAfterSwap
    } = simulateSwap({
      pool: poolDataBefore,
      byAmountIn: true,
      slippage: toDecimal(1, 0),
      priceLimit: calculatePriceSqrt(MIN_TICK),
      swapAmount: amount,
      xToY: true,
      ticks,
      tickmap
    })

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount,
      estimatedPriceAfterSwap: { v: priceAfterSwap.subn(1) },
      slippage: toDecimal(0, 0),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey,
      referralAccount: referralTokenXAccount
    }
    await market.swap(swapVars, owner)

    // Check pool
    const poolData = await market.getPool(pair)
    assert.isFalse(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.equal(poolData.currentTickIndex, -1880)
    assert.ok(poolData.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reserveXAfter = (await tokenX.getAccountInfo(poolData.tokenXReserve)).amount
    const reserveYAfter = (await tokenY.getAccountInfo(poolData.tokenYReserve)).amount
    const referralTokenXAfter = (await tokenX.getAccountInfo(referralTokenXAccount)).amount
    const referralXDelta = referralTokenXAfter.sub(referralTokenXBefore)
    const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    const reserveYDelta = reserveYBefore.sub(reserveYAfter)

    // fee tokens           11, 333, 157 (estimated 0.005 * 100000 = 500)
    // protocol fee tokens  ceil(11 * 0.01) + ceil(333 * 0.01) + ceil(157 * 0.01) = 1 + 4 + 2 = 7
    // referral fee         floor(11 * 0.2) + floor(333 * 0.2) + floor(157 * 0.2) = 2 + 66 + 31 = 99
    // pool fee tokens      501 - 7 - 99 = 395
    // fee growth global    (11-1-2)/2000000 + (333-4-66)/1000000 + (157-2-31)/1000000 = 3.91 * 10^-4
    // y token to user      1998 + 62164 + 26502 = 90664
    const expectedXProtocolFee = new BN(7)
    const expectedXReferralFee = new BN(99)
    const expectedYTransferTo = new BN(90664)

    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(expectedYTransferTo))
    assert.ok(reserveXDelta.eq(amount.sub(expectedXReferralFee)))
    assert.ok(referralXDelta.eq(expectedXReferralFee))
    assert.ok(reserveYDelta.eq(expectedYTransferTo))
    assert.ok(poolData.feeProtocolTokenX.eq(expectedXProtocolFee))
    assert.ok(poolData.feeProtocolTokenY.eqn(0))
    assert.equal(poolData.feeGrowthGlobalX.v.toString(), '391000000000000000000')
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))

    // validate with simulation
    assert.equal(SimulationStatus.Ok, status.valueOf())
    assert.ok(poolData.sqrtPrice.v.eq(priceAfterSwap))
    assert.ok(amount.eq(accumulatedAmountIn.add(accumulatedFee)))
    assert.ok(accumulatedAmountOut.eq(expectedYTransferTo))
    // 2001 + 11 = 2012
    // (66422 + 333) + (31076 + 157) = 97988
    assert.equal(crossedTicks.length, 1)
    assert.equal(crossedTicks[0], -20)
    assert.equal(amountPerTick.length, 2)
    assert.ok(amountPerTick[0].eqn(2012))
    assert.ok(amountPerTick[1].eqn(97988))
    // real     17.1292689332... %
    // expected 17.1292689333 %
    assert.ok(priceImpact.eq(new BN('171292689333')))
    assert.ok(minReceived.eqn(0)) // due extremely low price limit
  })
})
