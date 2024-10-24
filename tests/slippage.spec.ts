import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assertThrowsAsync, createPoolWithLiquidity, createUserWithTokens } from './testUtils'
import { Market, Network, sleep, PRICE_DENOMINATOR, INVARIANT_ERRORS } from '@invariant-labs/sdk'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { Decimal, Swap } from '@invariant-labs/sdk/src/market'
import { assert } from 'chai'

describe('slippage', () => {
  const provider = AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const admin = Keypair.generate()
  let market: Market
  let assumedTargetPrice: Decimal
  let expectedPrice: BN

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    await connection.requestAirdrop(admin.publicKey, 1e12)
    await sleep(500)

    await market.createState(admin.publicKey, admin)

    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, admin)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    assumedTargetPrice = (await market.getPool(pair)).sqrtPrice
    const amount = new BN(1e8)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: assumedTargetPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(5, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await market.swap(swapVars, owner)

    expectedPrice = (await market.getPool(pair)).sqrtPrice.v
  })

  it('#swap with target just above limit', async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)

    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const priceLimit = expectedPrice.addn(1)
    const amount = new BN(1e8)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: { v: priceLimit },
      slippage: toDecimal(0, 0),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await market.swap(swapVars, owner)
  })

  it('#swap with target at limit', async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    // because not every token swapped will change the price price will be reached before all tokens are swapped
    const priceLimit = expectedPrice
    const amount = new BN(1e8)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: { v: priceLimit },
      slippage: toDecimal(0, 0),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await assertThrowsAsync(market.swap(swapVars, owner), INVARIANT_ERRORS.PRICE_LIMIT_REACHED)
  })

  it('#swap with target just below the limit', async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const priceLimit = expectedPrice.subn(1)
    const amount = new BN(1e8)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: { v: priceLimit },
      slippage: toDecimal(0, 0),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await assertThrowsAsync(market.swap(swapVars, owner), INVARIANT_ERRORS.PRICE_LIMIT_REACHED)
  })

  it('#swap with target on the other side of price', async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )

    const priceLimit = PRICE_DENOMINATOR.muln(2).sub(expectedPrice)
    const amount = new BN(1e8)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: { v: priceLimit },
      slippage: toDecimal(0, 0),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await assertThrowsAsync(market.swap(swapVars, owner), INVARIANT_ERRORS.PRICE_LIMIT_REACHED)
  })

  it.only('#swap actual slippage', async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )

    const amount = new BN(1e8)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: { v: expectedPrice },
      slippage: toDecimal(3, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }

    await market.swap(swapVars, owner)

    assert.equal((await market.getPool(pair)).sqrtPrice.v.toString(), expectedPrice.toString())

    await market.swap(swapVars, owner)
    await assertThrowsAsync(market.swap(swapVars, owner), INVARIANT_ERRORS.PRICE_LIMIT_REACHED)
  })
})
