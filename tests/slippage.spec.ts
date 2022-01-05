import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import {
  assertThrowsAsync,
  createPoolWithLiquidity,
  createState,
  createUserWithTokens,
  swap
} from './testUtils'
import { Market, Network } from '@invariant-labs/sdk'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { Decimal, Swap } from '@invariant-labs/sdk/src/market'
import { sleep } from '@invariant-labs/sdk'

describe('slippage', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const admin = Keypair.generate()
  let market: Market

  let knownPrice: Decimal
  let expectedPrice: BN

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )

    await connection.requestAirdrop(admin.publicKey, 1e12)
    await sleep(500)

    await createState(market, admin.publicKey, admin)

    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, admin)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    knownPrice = (await market.getPool(pair)).sqrtPrice
    const amount = new BN(1e8)

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      knownPrice,
      slippage: toDecimal(5, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await swap(market, swapVars, owner)

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
      knownPrice,
      slippage: toDecimal(5, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await swap(market, swapVars, owner, priceLimit)
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
      knownPrice,
      slippage: toDecimal(5, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await assertThrowsAsync(swap(market, swapVars, owner, priceLimit))
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
      knownPrice,
      slippage: toDecimal(5, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await assertThrowsAsync(swap(market, swapVars, owner, priceLimit))
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

    const swapVars: Swap = {
      pair,
      xToY: false,
      owner: owner.publicKey,
      amount,
      knownPrice,
      slippage: toDecimal(5, 2),
      accountX: userAccountX,
      accountY: userAccountY,
      byAmountIn: true
    }
    await assertThrowsAsync(swap(market, swapVars, owner, priceLimit))
  })
})
