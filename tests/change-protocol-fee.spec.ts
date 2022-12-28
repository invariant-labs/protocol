import { Network, sleep } from '@invariant-labs/sdk'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { ChangeProtocolFee, Decimal, FeeTier } from '@invariant-labs/sdk/src/market'
import { assertThrowsAsync, fromFee } from '@invariant-labs/sdk/src/utils'
import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'

describe('change-protocol-fee', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
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
      connection.requestAirdrop(positionOwner.publicKey, 1e12),
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

  it('#change-protocol-fee() state admin', async () => {
    const protocolFee: Decimal = { v: fromFee(new BN(11000)) }

    const changeProtocolFeeVars: ChangeProtocolFee = {
      pair,
      protocolFee,
      admin: admin.publicKey
    }
    await market.changeProtocolFee(changeProtocolFeeVars, admin)

    const pool = await market.getPool(pair)
    assert.ok(pool.protocolFee.v.eq(new BN(110000000000)))
  })

  it('#change-protocol-fee() fee receiver', async () => {
    const protocolFee: Decimal = { v: fromFee(new BN(11000)) }

    const changeProtocolFeeVars: ChangeProtocolFee = {
      pair,
      protocolFee,
      admin: feeReceiver.publicKey
    }
    await assertThrowsAsync(market.changeProtocolFee(changeProtocolFeeVars, feeReceiver))
  })

  it('#change-protocol-fee() other account', async () => {
    const protocolFee: Decimal = { v: fromFee(new BN(11000)) }

    const user = Keypair.generate()
    await connection.requestAirdrop(user.publicKey, 1e10)
    await sleep(500)

    const changeProtocolFeeVars: ChangeProtocolFee = {
      pair,
      protocolFee,
      admin: user.publicKey
    }
    await assertThrowsAsync(market.changeProtocolFee(changeProtocolFeeVars, user))
  })
})
