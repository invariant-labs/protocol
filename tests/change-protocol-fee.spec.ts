import { TICK_LIMIT, DENOMINATOR, Network } from '@invariant-labs/sdk'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { ChangeProtocolFee, Decimal, FeeTier } from '@invariant-labs/sdk/src/market'
import { fromFee } from '@invariant-labs/sdk/src/utils'
import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { changeProtocolFee, createToken } from './testUtils'

describe('change-protocol-fee', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }

  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e12),
      await connection.requestAirdrop(admin.publicKey, 1e12),
      await connection.requestAirdrop(positionOwner.publicKey, 1e12)
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
    await market.createState(admin, protocolFee)
  })

  it('#createFeeTier()', async () => {
    await market.createFeeTier(feeTier, admin)
  })

  it('#create()', async () => {
    // 0.6% / 10
    await market.create({
      pair,
      signer: admin
    })
    const createdPool = await market.get(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex == 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v == 0))
  })

  it('#change-protocol-fee()', async () => {
    const protocolFee: Decimal = { v: fromFee(new BN(11000)) }

    const changeProtocolFeeVars: ChangeProtocolFee = {
      pair,
      protocolFee,
      admin: admin.publicKey
    }
    await changeProtocolFee(market, changeProtocolFeeVars, admin)
  })
})
