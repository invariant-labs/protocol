import { Network, Pair, Market, PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { FeeTier, InitPosition } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

describe('whole-liquidity', () => {
  const provider = AnchorProvider.local()
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

    pair = new Pair(tokens[0], tokens[1], feeTier)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#init-positions()', async () => {
    const tick1 = 20
    const tick2 = 40
    const tick3 = -60

    const positionOwner1AccountX = await createAssociatedTokenAccount(
      connection,
      positionOwner1,
      pair.tokenX,
      positionOwner1.publicKey
    )
    const positionOwner1AccountY = await createAssociatedTokenAccount(
      connection,
      positionOwner1,
      pair.tokenY,
      positionOwner1.publicKey
    )
    const positionOwner2AccountX = await createAssociatedTokenAccount(
      connection,
      positionOwner2,
      pair.tokenX,
      positionOwner2.publicKey
    )
    const positionOwner2AccountY = await createAssociatedTokenAccount(
      connection,
      positionOwner2,
      pair.tokenY,
      positionOwner2.publicKey
    )
    await mintTo(
      connection,
      positionOwner1,
      pair.tokenX,
      positionOwner1AccountX,
      mintAuthority,
      1e9
    )
    await mintTo(
      connection,
      positionOwner1,
      pair.tokenY,
      positionOwner1AccountY,
      mintAuthority,
      1e9
    )
    await mintTo(
      connection,
      positionOwner2,
      pair.tokenX,
      positionOwner2AccountX,
      mintAuthority,
      1e9
    )
    await mintTo(
      connection,
      positionOwner2,
      pair.tokenY,
      positionOwner2AccountY,
      mintAuthority,
      1e9
    )

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
