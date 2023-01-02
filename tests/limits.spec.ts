import * as anchor from '@project-serum/anchor'
import { BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { createTokensAndPool, createUserWithTokens } from './testUtils'
import { Market, Network, sleep, calculatePriceSqrt, INVARIANT_ERRORS } from '@invariant-labs/sdk'
import { assertThrowsAsync, getMaxTick, toDecimal } from '@invariant-labs/sdk/src/utils'
import { Decimal, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { getLiquidityByX, getLiquidityByY } from '@invariant-labs/sdk/src/math'
import { beforeEach } from 'mocha'
import { assert } from 'chai'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { feeToTickSpacing, FEE_TIERS, PRICE_DENOMINATOR } from '@invariant-labs/sdk/lib/utils'
import { Pair } from '@invariant-labs/sdk/lib/pair'

describe('limits', () => {
  const provider = anchor.AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const admin = Keypair.generate()
  const feeTier = FEE_TIERS[0]
  let market: Market
  let tokenX: Token
  let tokenY: Token
  let pair: Pair
  let mintAuthority: Keypair
  const assumedTargetPrice: Decimal = { v: new BN(PRICE_DENOMINATOR) }

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )
    await connection.requestAirdrop(admin.publicKey, 1e10)
    await sleep(500)

    await market.createState(admin.publicKey, admin)
  })

  beforeEach(async () => {
    const result = await createTokensAndPool(market, connection, admin, 0, feeTier)
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
      { v: PRICE_DENOMINATOR },
      false
    ).liquidity
    const liquidityByX = getLiquidityByX(
      mintAmount,
      lowerTick,
      upperTick,
      { v: PRICE_DENOMINATOR },
      false
    ).liquidity
    // calculation of liquidity might not be exactly equal on both tokens so taking smaller one
    const liquidityDelta = liquidityByY.v.lt(liquidityByX.v) ? liquidityByY : liquidityByX

    const initPositionVars: InitPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, owner)

    const swapVars: Swap = {
      pair,
      owner: owner.publicKey,
      xToY: true,
      amount: new BN(1),
      estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(5, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await assertThrowsAsync(market.swap(swapVars, owner), INVARIANT_ERRORS.NO_GAIN_SWAP)

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
        { v: PRICE_DENOMINATOR },
        true
      ).liquidity

      const initPositionVars: InitPosition = {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta,
        knownPrice: { v: PRICE_DENOMINATOR },
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, owner)

      assert.ok((await tokenX.getAccountInfo(userAccountX)).amount.eqn(0))
      assert.ok((await tokenY.getAccountInfo(userAccountY)).amount.eq(mintAmount))

      const swapVars: Swap = {
        pair,
        owner: owner.publicKey,
        xToY: false,
        amount: mintAmount,
        estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      }
      await market.swap(swapVars, owner)

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
        { v: PRICE_DENOMINATOR },
        true
      ).liquidity

      const initPositionVars: InitPosition = {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta,
        knownPrice: { v: PRICE_DENOMINATOR },
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, owner)

      assert.ok((await tokenX.getAccountInfo(userAccountX)).amount.eq(mintAmount))
      assert.ok((await tokenY.getAccountInfo(userAccountY)).amount.eqn(0))

      const swapVars: Swap = {
        pair,
        xToY: true,
        amount: mintAmount,
        estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true,
        owner: owner.publicKey
      }
      await market.swap(swapVars, owner)

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
        { v: PRICE_DENOMINATOR },
        false
      ).liquidity
      const liquidityByX = getLiquidityByY(
        posAmount,
        lowerTick,
        upperTick,
        { v: PRICE_DENOMINATOR },
        false
      ).liquidity
      // calculation of liquidity might not be exactly equal on both tokens so taking smaller one
      const liquidityDelta = liquidityByY.v.lt(liquidityByX.v) ? liquidityByY : liquidityByX

      const initPositionVars: InitPosition = {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta,
        knownPrice: { v: PRICE_DENOMINATOR },
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, owner)

      // swap tokens
      const amount = mintAmount.divn(8)

      const swapVars: Swap = {
        pair,
        xToY: true,
        amount,
        estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true,
        owner: owner.publicKey
      }
      await market.swap(swapVars, owner)

      const swapVars2: Swap = {
        pair,
        xToY: false,
        amount,
        estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true,
        owner: owner.publicKey
      }
      await market.swap(swapVars2, owner)

      const swapVars3: Swap = {
        pair,
        xToY: true,
        amount,
        estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: false,
        owner: owner.publicKey
      }
      await market.swap(swapVars3, owner)

      const swapVars4: Swap = {
        pair,
        xToY: false,
        amount,
        estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: false,
        owner: owner.publicKey
      }
      await market.swap(swapVars4, owner)
    })

    it('swap at upper limit', async () => {
      const tickSpacing = feeToTickSpacing(feeTier.fee)
      const initTick = getMaxTick(tickSpacing)

      const result = await createTokensAndPool(market, connection, wallet, initTick, feeTier)
      pair = result.pair
      mintAuthority = result.mintAuthority

      const poolData = await market.getPool(pair)
      const currentSqrtPrice = poolData.sqrtPrice
      assert.equal(poolData.currentTickIndex, initTick)
      assert.equal(currentSqrtPrice.v.toString(), calculatePriceSqrt(initTick).v.toString())

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

      const initPositionVars: InitPosition = {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick: 0,
        upperTick: Infinity,
        liquidityDelta,
        knownPrice: { v: PRICE_DENOMINATOR },
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, owner)

      const swapVars: Swap = {
        pair,
        xToY: false,
        amount: new BN(1),
        estimatedPriceAfterSwap: currentSqrtPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(5, 2),
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true,
        owner: owner.publicKey
      }
      await assertThrowsAsync(market.swap(swapVars, owner))
    })
  })
})
