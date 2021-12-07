import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { assertThrowsAsync, createPoolWithLiquidity } from './testUtils'
import { Market, Pair, TICK_LIMIT, Network } from '@invariant-labs/sdk'
import { DEFAULT_PUBLIC_KEY } from '@invariant-labs/sdk/src/market'

describe('oracle', () => {
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

  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let mintAuthority: Keypair

  before(async () => {
    const createdPool = await createPoolWithLiquidity(market, connection, wallet)
    pair = createdPool.pair
    mintAuthority = createdPool.mintAuthority
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#create()', async () => {
    const createdPool = await market.get(pair)
    assert.ok(createdPool.oracleAddress.equals(DEFAULT_PUBLIC_KEY))
    assert.isFalse(createdPool.oracleInitialized)

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
  })

  it('#initializeOracle()', async () => {
    await market.initializeOracle(pair, wallet)

    const createdPool = await market.get(pair)
    assert.isFalse(createdPool.oracleAddress.equals(DEFAULT_PUBLIC_KEY))
    assert.ok(createdPool.oracleInitialized)

    const oracle = await market.getOracle(pair)

    assert.equal(oracle.size, 100)
    assert.equal(oracle.head, 99)
    assert.equal(oracle.amount, 0)
  })

  it('#initializeOracle() again', async () => {
    await assertThrowsAsync(market.initializeOracle(pair, wallet))
  })
})
