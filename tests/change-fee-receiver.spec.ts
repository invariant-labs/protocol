import { Market, Pair, Network } from '@invariant-labs/sdk'
import { ChangeFeeReceiver, FeeTier } from '@invariant-labs/sdk/lib/market'
import { assertThrowsAsync, fromFee } from '@invariant-labs/sdk/lib/utils'
import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'

describe('change-fee-receiver', () => {
  const provider = Provider.local()
  const connection = provider.connection

  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeReceiver = Keypair.generate()

  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  let market: Market
  let pair: Pair

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e12),
      connection.requestAirdrop(admin.publicKey, 1e12),
      connection.requestAirdrop(feeReceiver.publicKey, 1e12)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
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
  it('#changeFeeReceiver() return to admin', async () => {
    const changeFeeReceiverVars: ChangeFeeReceiver = {
      pair,
      feeReceiver: admin.publicKey,
      admin: admin.publicKey
    }
    await market.changeFeeReceiver(changeFeeReceiverVars, admin)

    const pool = await market.getPool(pair)
    assert.ok(pool.feeReceiver.equals(admin.publicKey))
  })
})
