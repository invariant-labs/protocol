import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair, Transaction } from '@solana/web3.js'
import { createTokensAndPool, createUserWithTokens } from './testUtils'
import { Market, DENOMINATOR, Network } from '@invariant-labs/sdk'
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
import { signAndSend } from '@invariant-labs/sdk'
import { feeToTickSpacing, FEE_TIERS } from '@invariant-labs/sdk/lib/utils'
import { MAX_TICK } from '@invariant-labs/sdk'
import { TICK_LIMIT } from '@invariant-labs/sdk'
import { calculate_price_sqrt } from '@invariant-labs/sdk'

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
  let knownPrice: Decimal = { v: new BN(DENOMINATOR) }
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
    const mintAmount = new BN(2).pow(new BN(64)).subn(1)
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
    const liquidityByX = getLiquidityByY(
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
    const mintAmount = new BN(2).pow(new BN(64)).subn(1)
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
    const mintAmount = new BN(2).pow(new BN(64)).subn(1)
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
    const mintAmount = new BN(2).pow(new BN(64).subn(1))
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

  it.skip('big fee', async () => {
    const mintAmount = new BN(2).pow(new BN(64)).subn(1)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    const lowerTick = -10000
    const upperTick = 10000
    const liquidityDelta = DENOMINATOR.mul(new BN(10).pow(new BN(18)))

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta: { v: liquidityDelta }
      },
      owner
    )

    const amount = new BN(1e8)

    let priceBefore = (await market.get(pair)).sqrtPrice.v
    let prevFee = (await market.get(pair)).feeGrowthGlobalX.v

    const chunk = 1
    const repeats = 1

    for (let i = 0; i < repeats; i++) {
      const swaps = new Array(chunk).fill(0).map(async (_, i) => {
        const oneWayTx = market.swapTransaction({
          pair,
          XtoY: true,
          amount,
          knownPrice,
          slippage: toDecimal(5000 + i, 5),
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: true,
          owner: owner.publicKey
        })

        const otherWayTx = market.swapTransaction({
          pair,
          XtoY: false,
          amount: amount.subn(6),
          knownPrice,
          slippage: toDecimal(5000 + i, 5),
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: false,
          owner: owner.publicKey
        })

        const ixs = await Promise.all([oneWayTx, otherWayTx])

        await signAndSend(new Transaction().add(ixs[0]).add(ixs[1]), [owner], connection)
      })

      await Promise.all(swaps)

      const poolAfter = await market.get(pair)
      const priceAfter = poolAfter.sqrtPrice.v

      console.log(
        `price before: ${priceBefore}, price after: ${priceAfter}, feeGrowth: ${
          poolAfter.feeGrowthGlobalX.v
        } feeGrowthDelta: ${poolAfter.feeGrowthGlobalX.v.sub(prevFee)}`
      )
      prevFee = poolAfter.feeGrowthGlobalX.v
      priceBefore = priceAfter
    }
  })

  it.only('pool limited bit tickmap', async () => {
    const tickSpacing = feeToTickSpacing(feeTier.fee)
    const initTick = getMaxTick(tickSpacing)
    const result = await createTokensAndPool(market, connection, wallet, initTick, feeTier)
    pair = result.pair
    mintAuthority = result.mintAuthority

    const poolData = await market.get(pair)
    const knownPrice = poolData.sqrtPrice
    assert.equal(poolData.currentTickIndex, initTick)
    assert.equal(knownPrice.v.toString(), calculate_price_sqrt(initTick).v.toString())
    console.log(`init tick: ${initTick}`)

    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    const mintAmount = new BN(2).pow(new BN(64)).subn(2)
    const upperTick = getMaxTick(tickSpacing)
    const lowerTick = getMinTick(tickSpacing)

    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    const liquidityByY = getLiquidityByY(
      mintAmount,
      lowerTick,
      upperTick,
      poolData.sqrtPrice,
      false
    ).liquidity
    const liquidityByX = getLiquidityByY(
      mintAmount,
      lowerTick,
      upperTick,
      poolData.sqrtPrice,
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
        lowerTick: -Infinity,
        upperTick: Infinity,
        liquidityDelta
      },
      owner
    )

    const position = await market.getPosition(owner.publicKey, 0)
    assert.equal(position.lowerTickIndex, lowerTick)
    assert.equal(position.upperTickIndex, upperTick)

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
