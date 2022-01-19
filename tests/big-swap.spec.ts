import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { Network, Market, Pair, DENOMINATOR, TICK_LIMIT } from '@invariant-labs/sdk'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createPosition, createToken, performSwap } from './testUtils'
import { assert } from 'chai'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, RemovePosition } from '@invariant-labs/sdk/lib/market'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { calculateFeeGrowthInside } from '@invariant-labs/sdk/src/math'
import { CreateFeeTier, CreatePool } from '@invariant-labs/sdk/src/market'

describe('big-swap', () => {
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
    await market.createState(admin.publicKey, admin)
  })

  it('#createFeeTier()', async () => {
    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)
  })

  it('#create()', async () => {
    const createPoolVars: CreatePool = {
      pair,
      payer: admin,
      tokenX,
      tokenY
    }
    await market.createPool(createPoolVars)
    const createdPool = await market.getPool(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex === 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length === TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v === 0))
  })

  it('#swap()', async () => {
    const userTokenX = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenY = await tokenY.createAccount(positionOwner.publicKey)

    const positionsInfo: Array<[ticks: [lower: number, upper: number], liquidity: BN]> = [
      [[0, 20], new BN(1000000).mul(DENOMINATOR)],
      [[-10, 30], new BN(1800000).mul(DENOMINATOR)],
      [[-30, 0], new BN(1400000).mul(DENOMINATOR)],
      [[-40, 10], new BN(1900000).mul(DENOMINATOR)],
      [[20, 50], new BN(1500000).mul(DENOMINATOR)],
      [[0, 30], new BN(950000).mul(DENOMINATOR)],
      [[-30, 30], new BN(1150000).mul(DENOMINATOR)],
      [[-20, 20], new BN(1350000).mul(DENOMINATOR)],
      [[-10, 50], new BN(1250000).mul(DENOMINATOR)],
      [[-40, 0], new BN(1550000).mul(DENOMINATOR)]
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
      [true, new BN(3000)],
      [true, new BN(3260)],
      [false, new BN(2950)],
      [true, new BN(3660)],
      [false, new BN(3160)],
      [false, new BN(4030)],
      [false, new BN(3900)],
      [true, new BN(2940)],
      [false, new BN(3800)],
      [true, new BN(3700)],
      [false, new BN(3350)],
      [false, new BN(3940)],
      [true, new BN(2840)],
      [true, new BN(3040)],
      [false, new BN(2940)],
      [true, new BN(3670)]
    ]

    for (let i = 0; i < swaps.length; i++) {
      const pool = await market.getPool(pair)
      await performSwap(
        pair,
        swaps[i][0],
        swaps[i][1],
        pool.sqrtPrice,
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
      [[-30, 20], new BN(500000).mul(DENOMINATOR)],
      [[-20, 10], new BN(900000).mul(DENOMINATOR)],
      [[-20, 0], new BN(400000).mul(DENOMINATOR)],
      [[-40, 30], new BN(1000000).mul(DENOMINATOR)],
      [[10, 40], new BN(800000).mul(DENOMINATOR)],
      [[-40, 10], new BN(200000).mul(DENOMINATOR)],
      [[20, 50], new BN(1600000).mul(DENOMINATOR)],
      [[0, 30], new BN(450000).mul(DENOMINATOR)],
      [[-30, 30], new BN(1350000).mul(DENOMINATOR)],
      [[-20, 20], new BN(1750000).mul(DENOMINATOR)],
      [[0, 50], new BN(950000).mul(DENOMINATOR)],
      [[-10, 30], new BN(350000).mul(DENOMINATOR)],
      [[0, 20], new BN(1530000).mul(DENOMINATOR)],
      [[-10, 30], new BN(1630000).mul(DENOMINATOR)],
      [[-30, 0], new BN(1110000).mul(DENOMINATOR)]
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
      [true, new BN(3000)],
      [true, new BN(3260)],
      [true, new BN(2950)],
      [true, new BN(3660)],
      [true, new BN(3160)],
      [true, new BN(4030)],
      [false, new BN(2940)],
      [false, new BN(3800)],
      [false, new BN(3700)],
      [false, new BN(3350)],
      [false, new BN(3940)],
      [false, new BN(2840)],
      [false, new BN(3040)],
      [false, new BN(2940)],
      [false, new BN(3670)]
    ]

    for (let i = 0; i < swaps2.length; i++) {
      const pool = await market.getPool(pair)
      await performSwap(
        pair,
        swaps2[i][0],
        swaps2[i][1],
        pool.sqrtPrice,
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
