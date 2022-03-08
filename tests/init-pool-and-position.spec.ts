import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'
import { Market, Pair, tou64, Network } from '@invariant-labs/sdk'
import { CreateFeeTier, FeeTier, InitPoolAndPosition } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { isInitialized } from '@invariant-labs/sdk/lib/math'
import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'

describe('swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }

  let market: Market
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  const owner = Keypair.generate()

  beforeEach(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    // Request airdrops
    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#init()', async () => {
    await market.createState(admin.publicKey, admin)
    const createFeeTierVars: CreateFeeTier = {
      feeTier: pair.feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)
  })

  it('#init Pool and position in a single tx', async () => {
    const [userTokenX, userTokenY] = await Promise.all([
      tokenX.createAccount(owner.publicKey),
      tokenY.createAccount(owner.publicKey),
      connection.requestAirdrop(owner.publicKey, 1e9)
    ])
    await Promise.all([
      tokenX.mintTo(userTokenX, mintAuthority, [], tou64(1e9)),
      tokenY.mintTo(userTokenY, mintAuthority, [], tou64(1e9))
    ])

    const lowerTick = pair.tickSpacing * 2
    const upperTick = pair.tickSpacing * 4

    const liquidity = new BN(1000)

    const props: InitPoolAndPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX,
      userTokenY,
      lowerTick,
      upperTick,
      liquidityDelta: { v: liquidity },
      initTick: pair.tickSpacing * 3,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }

    await market.initPoolAndPosition(props, owner)
    const pool = await market.getPool(pair)
    const position = await market.getPosition(owner.publicKey, 0)
    const tickmap = await market.getTickmap(pair)

    assert.equal(pool.liquidity.v.toString(), liquidity.toString())
    assert.equal(position.liquidity.v.toString(), liquidity.toString())
    assert.isTrue(isInitialized(tickmap, lowerTick, pair.tickSpacing))
    assert.isTrue(isInitialized(tickmap, upperTick, pair.tickSpacing))
  })

  it('#init second one on the same keypair', async () => {
    const [userTokenX, userTokenY] = await Promise.all([
      tokenX.createAccount(owner.publicKey),
      tokenY.createAccount(owner.publicKey),
      connection.requestAirdrop(owner.publicKey, 1e9)
    ])
    await Promise.all([
      tokenX.mintTo(userTokenX, mintAuthority, [], tou64(1e9)),
      tokenY.mintTo(userTokenY, mintAuthority, [], tou64(1e9))
    ])

    const lowerTick = pair.tickSpacing * 2
    const upperTick = pair.tickSpacing * 4

    const liquidity = new BN(1000)

    const props: InitPoolAndPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX,
      userTokenY,
      lowerTick,
      upperTick,
      liquidityDelta: { v: liquidity },
      initTick: pair.tickSpacing * 3,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }

    await market.initPoolAndPosition(props, owner)
    const pool = await market.getPool(pair)
    const position = await market.getPosition(owner.publicKey, 0)
    const tickmap = await market.getTickmap(pair)

    assert.equal(pool.liquidity.v.toString(), liquidity.toString())
    assert.equal(position.liquidity.v.toString(), liquidity.toString())
    assert.isTrue(isInitialized(tickmap, lowerTick, pair.tickSpacing))
    assert.isTrue(isInitialized(tickmap, upperTick, pair.tickSpacing))
  })
})
