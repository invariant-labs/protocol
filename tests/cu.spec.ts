import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assertThrowsAsync, createToken, createTokensAndPool, initMarket } from './testUtils'
import { Market, Pair, Network, sleep } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { feeToTickSpacing, fromFee, getMaxTick } from '@invariant-labs/sdk/lib/utils'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { getLiquidityByX } from '@invariant-labs/sdk/lib/math'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

describe('Compute units', () => {
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

    pair = new Pair(tokens[0], tokens[1], feeTier)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin, 0)
  })

  it('#swap() adjustable', async () => {
    const positions = 3
    const initTick =
      getMaxTick(feeTier.tickSpacing ?? feeToTickSpacing(feeTier.fee)) -
      10000 -
      feeToTickSpacing(feeTier.fee)
    const [lowestTick, uppestTick] = [initTick, initTick + 1000]

    const mintAmount = tou64(new BN(2).pow(new BN(64)).subn(1))
    const amountPerPosition = new BN(100000)
    const owner = Keypair.generate()
    const { pair, mintAuthority } = await createTokensAndPool(
      market,
      connection,
      wallet,
      lowestTick,
      feeTier
    )

    await connection.requestAirdrop(owner.publicKey, 1e9)
    await sleep(400)
    const accountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      owner.publicKey
    )
    const accountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      owner.publicKey
    )
    await mintTo(connection, mintAuthority, pair.tokenX, accountX, mintAuthority, mintAmount)
    await mintTo(connection, mintAuthority, pair.tokenY, accountY, mintAuthority, mintAmount)

    const { sqrtPrice } = await market.getPool(pair)

    for (let i = 0; i < positions; i++) {
      const [lowerTick, upperTick] = [lowestTick + i * pair.tickSpacing, uppestTick]
      const initPositionVars: InitPosition = {
        pair,
        owner: owner.publicKey,
        userTokenX: accountX,
        userTokenY: accountY,
        lowerTick,
        upperTick,
        liquidityDelta: getLiquidityByX(
          amountPerPosition,
          lowerTick + pair.tickSpacing,
          upperTick + pair.tickSpacing,
          sqrtPrice,
          false,
          pair.tickSpacing
        ).liquidity,

        knownPrice: sqrtPrice,
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, owner)
    }

    const amount = amountPerPosition.muln(positions - 1).addn(1e6)

    const swapVars: Swap = {
      pair,
      xToY: false,
      amount,
      estimatedPriceAfterSwap: sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 0),
      accountX,
      accountY,
      byAmountIn: false,
      owner: owner.publicKey
    }
    await assertThrowsAsync(market.swap(swapVars, owner))
  })
})
