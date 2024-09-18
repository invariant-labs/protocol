import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'
import { Market, Pair, Network, calculatePriceSqrt, sleep } from '@invariant-labs/sdk'
import { CreateFeeTier, FeeTier, InitPoolAndPosition } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { isInitialized } from '@invariant-labs/sdk/lib/math'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

describe('swap', () => {
  const provider = AnchorProvider.local()
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

    pair = new Pair(tokens[0], tokens[1], feeTier)
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
    const userTokenX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      owner.publicKey
    )
    const userTokenY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      owner.publicKey
    )
    await connection.requestAirdrop(owner.publicKey, 1e9)
    await sleep(400)

    await mintTo(connection, mintAuthority, pair.tokenX, userTokenX, mintAuthority, 1e9)
    await mintTo(connection, mintAuthority, pair.tokenY, userTokenY, mintAuthority, 1e9)
    await sleep(1000)

    const initTick = pair.tickSpacing * 3
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
      initTick,
      knownPrice: calculatePriceSqrt(initTick),
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
    const userTokenX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      owner.publicKey
    )
    const userTokenY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      owner.publicKey
    )
    await connection.requestAirdrop(owner.publicKey, 1e9)
    await sleep(400)

    await mintTo(connection, mintAuthority, pair.tokenX, userTokenX, mintAuthority, 1e9)
    await mintTo(connection, mintAuthority, pair.tokenY, userTokenY, mintAuthority, 1e9)
    await sleep(1000)

    const initTick = pair.tickSpacing * 3
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
      initTick,
      knownPrice: calculatePriceSqrt(initTick),
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
