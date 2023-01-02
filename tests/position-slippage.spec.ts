import * as anchor from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import {
  assertThrowsAsync,
  createPoolWithLiquidity,
  createTokensAndPool,
  createUserWithTokens
} from './testUtils'
import { Market, Network, sleep, PRICE_DENOMINATOR, INVARIANT_ERRORS } from '@invariant-labs/sdk'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { InitPosition } from '@invariant-labs/sdk/lib/market'
import { toPrice } from '@invariant-labs/sdk/lib/utils'

describe('Position Slippage', () => {
  const provider = anchor.AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const admin = Keypair.generate()
  let market: Market

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    await connection.requestAirdrop(admin.publicKey, 1e12)
    await sleep(500)

    await market.createState(admin.publicKey, admin)

    const { pair, mintAuthority } = await createPoolWithLiquidity(market, connection, admin)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
  })

  it.only('zero slippage', async () => {
    const { pair, mintAuthority } = await createTokensAndPool(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const [lowerTick, upperTick] = [-pair.tickSpacing, pair.tickSpacing]

    const initPositionVars: InitPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta: toDecimal(1, 0),
      knownPrice: toPrice(1),
      slippage: toDecimal(0)
    }
    await market.initPosition(initPositionVars, owner)
  })

  it('inside range', async () => {
    const { pair, mintAuthority } = await createTokensAndPool(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const [lowerTick, upperTick] = [-pair.tickSpacing, pair.tickSpacing]

    const initPositionVars: InitPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta: toDecimal(1, 0),
      knownPrice: { v: toPrice(101, 2).v },
      slippage: toDecimal(3, 2)
    }
    await market.initPosition(initPositionVars, owner)
  })

  it('below range', async () => {
    const { pair, mintAuthority } = await createTokensAndPool(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const [lowerTick, upperTick] = [-pair.tickSpacing, pair.tickSpacing]

    const initPositionVars: InitPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta: toDecimal(1, 0),
      knownPrice: { v: toPrice(103, 2).v },
      slippage: toDecimal(3, 2)
    }
    assertThrowsAsync(market.initPosition(initPositionVars, owner))
  })

  it('above range', async () => {
    const { pair, mintAuthority } = await createTokensAndPool(market, connection, wallet)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority
    )
    const [lowerTick, upperTick] = [-pair.tickSpacing, pair.tickSpacing]

    const initPositionVars: InitPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta: toDecimal(1, 0),
      knownPrice: { v: toPrice(97, 2).v },
      slippage: toDecimal(3, 2)
    }
    assertThrowsAsync(market.initPosition(initPositionVars, owner))
  })
})
