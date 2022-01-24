import { Market, Pair, Network, TICK_LIMIT, DENOMINATOR } from '@invariant-labs/sdk'
import {
  ChangeFeeReceiver,
  CreateFeeTier,
  CreatePool,
  FeeTier
} from '@invariant-labs/sdk/lib/market'
import { assertThrowsAsync, fromFee } from '@invariant-labs/sdk/lib/utils'
import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'

describe('change-fee-receiver', () => {
  const provider = Provider.local()
  const connection = provider.connection

  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeReceiver = Keypair.generate()

  let market: Market
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }

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

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e12),
      await connection.requestAirdrop(admin.publicKey, 1e12),
      await connection.requestAirdrop(feeReceiver.publicKey, 1e12)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#createState()', async () => {
    await market.createState(admin.publicKey, admin)
  })

  it('#createFeeTier()', async () => {
    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)
  })

  it('#create()', async () => {
    // 0.6% / 10
    const createPoolVars: CreatePool = {
      pair,
      payer: feeReceiver
    }
    await market.createPool(createPoolVars)
    const createdPool = await market.getPool(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex === 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length === TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v === 0))
  })

  it('#changeFeeReceiver()', async () => {
    const newFeeReceiver = Keypair.generate()
    await connection.requestAirdrop(newFeeReceiver.publicKey, 1e12)

    const changeFeeReceiverVars: ChangeFeeReceiver = {
      pair,
      feeReceiver: newFeeReceiver.publicKey,
      admin: admin.publicKey
    }
    await market.changeFeeReceiver(changeFeeReceiverVars, admin)

    const pool = await market.getPool(pair)
    assert.ok(pool.feeReceiver.equals(newFeeReceiver.publicKey))
  })

  it('#changeFeeReceiver() Non-admin', async () => {
    const newFeeReceiver = Keypair.generate()
    await connection.requestAirdrop(newFeeReceiver.publicKey, 1e12)

    const changeFeeReceiverVars: ChangeFeeReceiver = {
      pair,
      feeReceiver: newFeeReceiver.publicKey,
      admin: wallet.publicKey
    }
    await assertThrowsAsync(market.changeFeeReceiver(changeFeeReceiverVars, wallet))
  })
})
