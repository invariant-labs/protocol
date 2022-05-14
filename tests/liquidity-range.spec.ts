import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initEverything } from './testUtils'
import { Market, Pair, tou64, LIQUIDITY_DENOMINATOR, Network } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { InitPosition } from '@invariant-labs/sdk/src/market'
import { getTickArray } from '../staker-sdk/src/utils'

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

  before(async () => {
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
    await initEverything(market, [pair], admin)
  })

  it('#swap() within a tick', async () => {
    // Deposit

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: -10,
      upperTick: 10,
      liquidityDelta,
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    const initPositionVars2: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: -20,
      upperTick: 20,
      liquidityDelta,
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars2, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v.muln(2)))

    const rawTicks = await market.getAllTicks(pair)

    const pool = await market.getPool(pair)

    const ticks = getTickArray(rawTicks, pool)

    assert.ok(ticks[0].liquidity.eq(new BN(1000000000000)))
    assert.ok(ticks[1].liquidity.eq(new BN(2000000000000)))
    assert.ok(ticks[2].liquidity.eq(new BN(1000000000000)))
    assert.ok(ticks[3].liquidity.eq(new BN(0)))
  })
})
