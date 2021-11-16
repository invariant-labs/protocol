import * as anchor from '@project-serum/anchor'
import { Provider, Program, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert, expect } from 'chai'
import {
  assertThrowsAsync,
  createPoolWithLiquidity,
  createToken,
  createTokensAndPool,
  createUserWithTokens,
  toDecimal
} from './testUtils'
import {
  Market,
  Pair,
  SEED,
  tou64,
  DENOMINATOR,
  signAndSend,
  TICK_LIMIT,
  Network
} from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'

describe('slippage', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const market = new Market(
    Network.LOCAL,
    provider.wallet,
    connection,
    anchor.workspace.Amm.programId
  )

  let expectedPrice: BN

  before(async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const priceLimit = DENOMINATOR.muln(1000).divn(100)
    const amount = new BN(1e8)
    await market.swap(
      {
        pair,
        XtoY: false,
        amount,
        priceLimit,
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )

    expectedPrice = (await market.get(pair)).sqrtPrice.v
  })

  it('#swap with target above limit', async () => {
    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const priceLimit = DENOMINATOR.muln(1000).divn(100)
    const amount = new BN(1e8)
    await market.swap(
      {
        pair,
        XtoY: false,
        amount,
        priceLimit,
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )
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
        priceLimit,
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
    )
  })

  it('#swap with target at limit', async () => {
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
        priceLimit,
        accountX: userAccountX,
        accountY: userAccountY,
        byAmountIn: true
      },
      owner
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
          priceLimit,
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: true
        },
        owner
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
          priceLimit,
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: true
        },
        owner
      )
    )
  })
})
