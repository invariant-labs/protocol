import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { assertThrowsAsync, createPoolWithLiquidity, createUserWithTokens } from './testUtils'
import { Market, DENOMINATOR, Network } from '@invariant-labs/sdk'
import { fromFee, toDecimal } from '@invariant-labs/sdk/src/utils'
import { Decimal } from '@invariant-labs/sdk/src/market'

describe('slippage', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  let market: Market
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

  let knownPrice: Decimal
  let expectedPrice: BN

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )

    await market.createState(wallet, protocolFee)

    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    knownPrice = (await market.get(pair)).sqrtPrice
    const amount = new BN(1e8)

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
    expectedPrice = (await market.get(pair)).sqrtPrice.v
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
      owner,
      priceLimit
    )
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
    await assertThrowsAsync(
      market.swap(
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
        owner,
        priceLimit
      )
    )
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
    await assertThrowsAsync(
      market.swap(
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
        owner,
        priceLimit
      )
    )
  })

  it('#swap with target on the other side of price', async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const priceLimit = expectedPrice.muln(-1)
    const amount = new BN(1e8)
    await assertThrowsAsync(
      market.swap(
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
        owner,
        priceLimit
      )
    )
  })
})
