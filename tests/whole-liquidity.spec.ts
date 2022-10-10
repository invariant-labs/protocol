import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { Network, Pair, Market } from '@invariant-labs/sdk'
import { FeeTier, InitPosition } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'

describe('whole-liquidity', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner1 = Keypair.generate()
  const positionOwner2 = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = { fee: fromFee(new BN(600)), tickSpacing: 10 }
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

    await Promise.all([
      connection.requestAirdrop(wallet.publicKey, 1e9),
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(positionOwner1.publicKey, 1e9),
      connection.requestAirdrop(positionOwner2.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#init-positions()', async () => {
    const tick1 = 20
    const tick2 = 40
    const tick3 = -60

    const positionOwner1AccountX = await tokenX.createAccount(positionOwner1.publicKey)
    const positionOwner1AccountY = await tokenY.createAccount(positionOwner1.publicKey)
    const positionOwner2AccountX = await tokenX.createAccount(positionOwner2.publicKey)
    const positionOwner2AccountY = await tokenY.createAccount(positionOwner2.publicKey)

    await Promise.all([
      tokenX.mintTo(positionOwner1AccountX, mintAuthority, [mintAuthority], 1e9),
      tokenX.mintTo(positionOwner2AccountX, mintAuthority, [mintAuthority], 1e9),
      tokenY.mintTo(positionOwner1AccountY, mintAuthority, [mintAuthority], 1e9),
      tokenY.mintTo(positionOwner2AccountY, mintAuthority, [mintAuthority], 1e9)
    ])

    const initPositionVars: InitPosition = {
      lowerTick: tick1,
      upperTick: tick2,
      liquidityDelta: { v: new BN(1e6) },
      pair,
      userTokenX: positionOwner1AccountX,
      userTokenY: positionOwner1AccountY,
      owner: positionOwner1.publicKey,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner1)

    const initPositionVars2: InitPosition = {
      lowerTick: tick3,
      upperTick: tick1,
      liquidityDelta: { v: new BN(3e5) },
      pair,
      userTokenX: positionOwner1AccountX,
      userTokenY: positionOwner1AccountY,
      owner: positionOwner1.publicKey,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars2, positionOwner1)

    const initPositionVars3: InitPosition = {
      lowerTick: tick3,
      upperTick: tick2,
      liquidityDelta: { v: new BN(7e8) },
      pair,
      userTokenX: positionOwner2AccountX,
      userTokenY: positionOwner2AccountY,
      owner: positionOwner2.publicKey,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars3, positionOwner2)

    const wholeLiquidity = await market.getWholeLiquidity(pair)
    assert.ok(wholeLiquidity.eq(new BN(1e6 + 3e5 + 7e8)))
  })
})
