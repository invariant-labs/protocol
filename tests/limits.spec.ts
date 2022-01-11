import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair, Transaction } from '@solana/web3.js'
import { createTokensAndPool, createUserWithTokens } from './testUtils'
import {
  Market,
  DENOMINATOR,
  Network,
  signAndSend,
  MAX_TICK,
  TICK_LIMIT,
  calculatePriceSqrt
} from '@invariant-labs/sdk'
import {
  assertThrowsAsync,
  fromFee,
  getMaxTick,
  getMinTick,
  toDecimal
} from '@invariant-labs/sdk/src/utils'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { Pair } from '@invariant-labs/sdk/src'
import {
  calculatePriceAfterSlippage,
  getLiquidityByX,
  getLiquidityByY
} from '@invariant-labs/sdk/src/math'
import { beforeEach } from 'mocha'
import { assert } from 'chai'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { feeToTickSpacing, FEE_TIERS } from '@invariant-labs/sdk/lib/utils'

describe('limits', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let market: Market
  let tokenX: Token
  let tokenY: Token
  let pair: Pair
  let mintAuthority: Keypair
  const knownPrice: Decimal = { v: new BN(DENOMINATOR) }
  const feeTier = FEE_TIERS[0]

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )
    await market.createState(wallet, protocolFee)
  })

  beforeEach(async () => {
    const result = await createTokensAndPool(market, connection, wallet, 0, feeTier)
    pair = result.pair
    mintAuthority = result.mintAuthority

    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('big deposit both tokens', async () => {
    const mintAmount = new BN(2).pow(new BN(63)).subn(1)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    const upperTick = pair.feeTier.tickSpacing ?? 0
    const lowerTick = -(pair.feeTier.tickSpacing ?? 0)

    const liquidityByY = getLiquidityByY(
      mintAmount,
      lowerTick,
      upperTick,
      { v: DENOMINATOR },
      false
    ).liquidity
    const liquidityByX = getLiquidityByX(
      mintAmount,
      lowerTick,
      upperTick,
      { v: DENOMINATOR },
      false
    ).liquidity
    // calculation of liquidity might not be exactly equal on both tokens so taking smaller one
    const liquidityDelta = liquidityByY.v.lt(liquidityByX.v) ? liquidityByY : liquidityByX

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      owner
    )

    await market.swap(
      {
        pair,
        XtoY: true,
        amount: new BN(1),
        knownPrice,
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )
  })

  it('big deposit X and swap Y', async () => {
    const mintAmount = new BN(2).pow(new BN(63)).subn(1)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    const lowerTick = 0
    const upperTick = lowerTick + (pair.feeTier.tickSpacing ?? 0)

    const liquidityDelta = getLiquidityByX(
      mintAmount,
      lowerTick,
      upperTick,
      { v: DENOMINATOR },
      true
    ).liquidity

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      owner
    )

    assert.ok((await tokenX.getAccountInfo(userAccountX)).amount.eqn(0))
    assert.ok((await tokenY.getAccountInfo(userAccountY)).amount.eq(mintAmount))

    await market.swap(
      {
        pair,
        XtoY: false,
        amount: mintAmount,
        knownPrice,
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )

    assert.isFalse((await tokenX.getAccountInfo(userAccountX)).amount.eqn(0))
    assert.ok((await tokenY.getAccountInfo(userAccountY)).amount.eqn(0))
  })

  it('big deposit Y and swap X', async () => {
    const mintAmount = new BN(2).pow(new BN(63)).subn(1)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    const upperTick = 0
    const lowerTick = upperTick - (pair.feeTier.tickSpacing ?? 0)

    const liquidityDelta = getLiquidityByY(
      mintAmount,
      lowerTick,
      upperTick,
      { v: DENOMINATOR },
      true
    ).liquidity

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      owner
    )

    assert.ok((await tokenX.getAccountInfo(userAccountX)).amount.eq(mintAmount))
    assert.ok((await tokenY.getAccountInfo(userAccountY)).amount.eqn(0))

    await market.swap(
      {
        pair,
        XtoY: true,
        amount: mintAmount,
        knownPrice,
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )

    assert.ok((await tokenX.getAccountInfo(userAccountX)).amount.eqn(0))
    assert.isFalse((await tokenY.getAccountInfo(userAccountY)).amount.eqn(0))
  })

  it('big deposit and swaps', async () => {
    const mintAmount = new BN(2).pow(new BN(63).subn(1))
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    const upperTick = pair.feeTier.tickSpacing ?? 0
    const lowerTick = -(pair.feeTier.tickSpacing ?? 0)

    const posAmount = mintAmount.divn(2)
    const liquidityByY = getLiquidityByY(
      posAmount,
      lowerTick,
      upperTick,
      { v: DENOMINATOR },
      false
    ).liquidity
    const liquidityByX = getLiquidityByY(
      posAmount,
      lowerTick,
      upperTick,
      { v: DENOMINATOR },
      false
    ).liquidity
    // calculation of liquidity might not be exactly equal on both tokens so taking smaller one
    const liquidityDelta = liquidityByY.v.lt(liquidityByX.v) ? liquidityByY : liquidityByX

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      owner
    )

    // swap tokens
    const amount = mintAmount.divn(8)

    await market.swap(
      {
        pair,
        XtoY: true,
        amount,
        knownPrice,
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )

    await market.swap(
      {
        pair,
        XtoY: false,
        amount,
        knownPrice,
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )

    await market.swap(
      {
        pair,
        XtoY: true,
        amount,
        knownPrice,
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: false
      },
      owner
    )

    await market.swap(
      {
        pair,
        XtoY: false,
        amount,
        knownPrice,
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: false
      },
      owner
    )
  })

  it('swap at upper limit', async () => {
    const tickSpacing = feeToTickSpacing(feeTier.fee)
    const initTick = getMaxTick(tickSpacing)

    const result = await createTokensAndPool(market, connection, wallet, initTick, feeTier)
    pair = result.pair
    mintAuthority = result.mintAuthority

    const poolData = await market.get(pair)
    const knownPrice = poolData.sqrtPrice
    assert.equal(poolData.currentTickIndex, initTick)
    assert.equal(knownPrice.v.toString(), calculatePriceSqrt(initTick).v.toString())

    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    const mintAmount = new BN(2).pow(new BN(63)).subn(1)

    const positionAmount = mintAmount.subn(1)

    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      positionAmount
    )

    const liquidityDelta = getLiquidityByY(
      positionAmount,
      0,
      Infinity,
      poolData.sqrtPrice,
      false,
      pair.feeTier.tickSpacing
    ).liquidity

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick: 0,
        upperTick: Infinity,
        liquidityDelta
      },
      owner
    )

    const position = await market.getPosition(owner.publicKey, 0)

    await assertThrowsAsync(
      market.swap(
        {
          pair,
          XtoY: false,
          amount: new BN(1),
          knownPrice,
          slippage: toDecimal(5, 2),
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: true
        },
        owner
      )
    )
  })
})
