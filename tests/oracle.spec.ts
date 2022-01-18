import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { assertThrowsAsync, createPoolWithLiquidity } from './testUtils'
import { Market, Pair, TICK_LIMIT, Network, sleep } from '@invariant-labs/sdk'
import { DEFAULT_PUBLIC_KEY, InitializeOracle } from '@invariant-labs/sdk/src/market'

describe('oracle', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const admin = Keypair.generate()

  let market: Market
  let pair: Pair

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )
    await connection.requestAirdrop(admin.publicKey, 1e12)
    await sleep(500)

    await market.createState(admin.publicKey, admin)

    const createdPool = await createPoolWithLiquidity(market, connection, admin)
    pair = createdPool.pair
  })

  it('#create()', async () => {
    const pool = await market.getPool(pair)
    assert.ok(pool.oracleAddress.equals(DEFAULT_PUBLIC_KEY))
    assert.isFalse(pool.oracleInitialized)

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length === TICK_LIMIT / 4)
  })

  it('#initializeOracle()', async () => {
    const initializeOracleVars: InitializeOracle = {
      pair,
      payer: wallet
    }
    await market.initializeOracle(initializeOracleVars)

    const createdPool = await market.getPool(pair)
    assert.isFalse(createdPool.oracleAddress.equals(DEFAULT_PUBLIC_KEY))
    assert.ok(createdPool.oracleInitialized)

    const oracle = await market.getOracle(pair)

    assert.equal(oracle.size, 256)
    assert.equal(oracle.head, 255)
    assert.equal(oracle.amount, 0)
  })

  it('#initializeOracle() again', async () => {
    const initializeOracleVars: InitializeOracle = {
      pair,
      payer: wallet
    }
    await assertThrowsAsync(market.initializeOracle(initializeOracleVars))
  })
})
