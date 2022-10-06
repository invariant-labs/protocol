import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { Network, Market, Pair, LIQUIDITY_DENOMINATOR } from '@invariant-labs/sdk'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createPosition, createToken, initMarket, performSwap } from './testUtils'
import { assert } from 'chai'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, RemovePosition } from '@invariant-labs/sdk/lib/market'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { calculateFeeGrowthInside } from '@invariant-labs/sdk/src/math'

describe('big-swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
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

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e12),
      connection.requestAirdrop(admin.publicKey, 1e12),
      connection.requestAirdrop(positionOwner.publicKey, 1e12)
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

  it('#swap()', async () => {
    const userTokenX = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenY = await tokenY.createAccount(positionOwner.publicKey)

    const positionsInfo: Array<[ticks: [lower: number, upper: number], liquidity: BN]> = [
      [[0, 20], new BN(10000000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-10, 30], new BN(180000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-30, 0], new BN(14000000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-40, 10], new BN(1900000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[20, 50], new BN(1500000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[0, 30], new BN(950000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-30, 30], new BN(1150000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-20, 20], new BN(1350000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-10, 50], new BN(1250000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-40, 0], new BN(1550000000000).mul(LIQUIDITY_DENOMINATOR)]
    ]

    for (let i = 0; i < positionsInfo.length; i++) {
      await createPosition(
        positionsInfo[i][0][0],
        positionsInfo[i][0][1],
        positionsInfo[i][1],
        positionOwner,
        userTokenX,
        userTokenY,
        tokenX,
        tokenY,
        pair,
        market,
        wallet,
        mintAuthority
      )
    }

    const swaps: Array<[xToY: boolean, amount: BN]> = [
      [true, new BN(3000000000)],
      [true, new BN(3260000000)],
      [false, new BN(2950000000)],
      [true, new BN(3660000000)],
      [false, new BN(3160000000)],
      [false, new BN(4030000000)],
      [false, new BN(3900000000)],
      [true, new BN(2940000000)],
      [false, new BN(3800000000)],
      [true, new BN(3700000000)],
      [false, new BN(3350000000)],
      [false, new BN(3940000000)],
      [true, new BN(2840000000)],
      [true, new BN(3040000000)],
      [false, new BN(2940000000)],
      [true, new BN(3670000000)]
    ]

    for (let i = 0; i < swaps.length; i++) {
      const pool = await market.getPool(pair)
      await performSwap(
        pair,
        swaps[i][0],
        swaps[i][1],
        pool.sqrtPrice, // ignore price impact using high slippage tolerance
        toDecimal(1, 2),
        true,
        connection,
        market,
        tokenX,
        tokenY,
        mintAuthority
      )
    }

    const poolAfterSwaps = await market.getPool(pair)
    const { feeX, feeY } = await market.getGlobalFee(pair)
    const { volumeX, volumeY } = await market.getVolume(pair)

    assert.ok(feeX.eq(new BN(156655500)))
    assert.ok(feeY.eq(new BN(168147600)))
    assert.ok(volumeX.eq(new BN(26109250000)))
    assert.ok(volumeY.eq(new BN(28024600000)))
    for (let i = -40; i < 50; i += 10) {
      let lowerTick
      try {
        lowerTick = await market.getTick(pair, i)
      } catch (e: unknown) {
        if (e instanceof Error) {
          continue
        }
      }
      for (let j = i + 10; j <= 50; j += 10) {
        let upperTick
        try {
          upperTick = await market.getTick(pair, j)
        } catch (e: unknown) {
          if (e instanceof Error) {
            continue
          }
        }
        const [feeGrowthInsideX, feeGrowthInsideY] = calculateFeeGrowthInside(
          lowerTick,
          upperTick,
          poolAfterSwaps.currentTickIndex,
          poolAfterSwaps.feeGrowthGlobalX,
          poolAfterSwaps.feeGrowthGlobalY
        )
        assert.ok(feeGrowthInsideX.v.gte(new BN(0)))
        assert.ok(feeGrowthInsideY.v.gte(new BN(0)))
      }
    }

    const removePositionVars: RemovePosition = {
      index: 0,
      pair,
      userTokenX,
      userTokenY,
      owner: positionOwner.publicKey
    }
    await market.removePosition(removePositionVars, positionOwner)

    const removePositionVars2: RemovePosition = {
      index: 3,
      pair,
      userTokenX,
      userTokenY,
      owner: positionOwner.publicKey
    }
    await market.removePosition(removePositionVars2, positionOwner)

    const removePositionVars3: RemovePosition = {
      index: 2,
      pair,
      userTokenX,
      userTokenY,
      owner: positionOwner.publicKey
    }
    await market.removePosition(removePositionVars3, positionOwner)

    const removePositionVars4: RemovePosition = {
      index: 3,
      pair,
      userTokenX,
      userTokenY,
      owner: positionOwner.publicKey
    }
    await market.removePosition(removePositionVars4, positionOwner)

    const positionsInfo2: Array<[ticks: [lower: number, upper: number], liquidity: BN]> = [
      [[-30, 20], new BN(50000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-20, 10], new BN(90000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-20, 0], new BN(40000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-40, 30], new BN(100000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[10, 40], new BN(80000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-40, 10], new BN(20000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[20, 50], new BN(160000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[0, 30], new BN(45000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-30, 30], new BN(135000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-20, 20], new BN(175000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[0, 50], new BN(95000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-10, 30], new BN(35000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[0, 20], new BN(153000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-10, 30], new BN(163000000000).mul(LIQUIDITY_DENOMINATOR)],
      [[-30, 0], new BN(111000000000).mul(LIQUIDITY_DENOMINATOR)]
    ]

    for (let i = 0; i < positionsInfo2.length; i++) {
      await createPosition(
        positionsInfo2[i][0][0],
        positionsInfo2[i][0][1],
        positionsInfo2[i][1],
        positionOwner,
        userTokenX,
        userTokenY,
        tokenX,
        tokenY,
        pair,
        market,
        wallet,
        mintAuthority
      )
    }

    const swaps2: Array<[xToY: boolean, amount: BN]> = [
      [true, new BN(300000000)],
      [true, new BN(326000000)],
      [true, new BN(295000000)],
      [true, new BN(366000000)],
      [true, new BN(316000000)],
      [true, new BN(403000000)],
      [false, new BN(294000000)],
      [false, new BN(380000000)],
      [false, new BN(370000000)],
      [false, new BN(335000000)],
      [false, new BN(394000000)],
      [false, new BN(284000000)],
      [false, new BN(304000000)],
      [false, new BN(294000000)],
      [false, new BN(367000000)]
    ]

    for (let i = 0; i < swaps2.length; i++) {
      const pool = await market.getPool(pair)
      await performSwap(
        pair,
        swaps2[i][0],
        swaps2[i][1],
        pool.sqrtPrice, // ignore price impact using high slippage tolerance
        toDecimal(1, 2),
        true,
        connection,
        market,
        tokenX,
        tokenY,
        mintAuthority
      )
    }

    const poolAfterSwaps2 = await market.getPool(pair)
    const { feeX: feeX2, feeY: feeY2 } = await market.getGlobalFee(pair)
    const { volumeX: volumeX2, volumeY: volumeY2 } = await market.getVolume(pair)

    assert.ok(feeX2.eq(new BN(168682700)))
    assert.ok(feeY2.eq(new BN(186276900)))
    assert.ok(volumeX2.eq(new BN(28113783333)))
    assert.ok(volumeY2.eq(new BN(31046150000)))

    for (let i = -40; i < 50; i += 10) {
      let lowerTick
      try {
        lowerTick = await market.getTick(pair, i)
      } catch (e: unknown) {
        if (e instanceof Error) {
          continue
        }
      }
      for (let j = i + 10; j <= 50; j += 10) {
        let upperTick
        try {
          upperTick = await market.getTick(pair, j)
        } catch (e: unknown) {
          if (e instanceof Error) {
            continue
          }
        }
        const [feeGrowthInsideX, feeGrowthInsideY] = calculateFeeGrowthInside(
          lowerTick,
          upperTick,
          poolAfterSwaps2.currentTickIndex,
          poolAfterSwaps2.feeGrowthGlobalX,
          poolAfterSwaps2.feeGrowthGlobalY
        )
        assert.ok(feeGrowthInsideX.v.gte(new BN(0)))
        assert.ok(feeGrowthInsideY.v.gte(new BN(0)))
      }
    }
  })
})
