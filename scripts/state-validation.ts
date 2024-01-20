import { BN, Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { calculateClaimAmount } from '@invariant-labs/sdk/src/utils'
import { parseLiquidityOnTicks } from '@invariant-labs/sdk/lib/utils'
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes'
import { PoolStructure, Position } from '@invariant-labs/sdk/src/market'
import { assert } from 'chai'
import { getDeltaX } from '@invariant-labs/sdk/lib/math'
import { calculatePriceSqrt } from '@invariant-labs/sdk'
import { getDeltaY } from '@invariant-labs/sdk/src/math'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Tick } from '@invariant-labs/sdk/lib/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local('[FILL ME]', {
  skipPreflight: true
})

const assertionOn = true
const skipValidation = ['JCKjKab2Qj9fkVGDX1QH2TZDX5Y7YfihMwwyh2efy8tP']
const onlyValidation = [
  '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7', // usdc-usdt 0.01%
  '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC', // usdc-wsol 0.01%
  'A29rrFUrhwhvBtBATr1heqKVgzcdWncywTGeSb5jw4wQ', // usdc-jlp 0.1%
  'AsScbbfavtP77F1Ybpe3Cdwhca9Yby6gDQLVh5uWsi3X' // msol-bsol 0.01%
]

const connection = provider.connection

const placeholderTick: Tick = {
  index: 0,
  liquidityChange: { v: new BN(0) },
  sign: false,
  pool: Keypair.generate().publicKey,
  liquidityGross: { v: new BN(0) },
  secondsPerLiquidityOutside: { v: new BN(0) },
  feeGrowthOutsideX: { v: new BN(0) },
  feeGrowthOutsideY: { v: new BN(0) },
  sqrtPrice: { v: new BN(0) },
  bump: 0
}

const fetchAllPosition = async (market: Market, poolAddress: PublicKey) => {
  return (
    await market.program.account.position.all([
      {
        memcmp: { bytes: bs58.encode(poolAddress.toBuffer()), offset: 40 }
      }
    ])
  ).map(({ account }) => account) as Position[]
}

const fetchAllPools = async (market: Market) => {
  return await market.program.account.pool.all([])
}

const simulateWithdrawal = (position: Position, pool: PoolStructure) => {
  if (pool.currentTickIndex < position.lowerTickIndex) {
    return [
      getDeltaX(
        calculatePriceSqrt(position.lowerTickIndex),
        calculatePriceSqrt(position.upperTickIndex),
        position.liquidity,
        false
      ) ?? new BN(0),
      new BN(0)
    ]
  } else if (pool.currentTickIndex < position.upperTickIndex) {
    return [
      getDeltaX(
        pool.sqrtPrice,
        calculatePriceSqrt(position.upperTickIndex),
        position.liquidity,
        false
      ) ?? new BN(0),
      getDeltaY(
        calculatePriceSqrt(position.lowerTickIndex),
        pool.sqrtPrice,
        position.liquidity,
        false
      ) ?? new BN(0)
    ]
  } else {
    return [
      new BN(0),
      getDeltaY(
        calculatePriceSqrt(position.lowerTickIndex),
        calculatePriceSqrt(position.upperTickIndex),
        position.liquidity,
        false
      ) ?? new BN(0)
    ]
  }
}

const main = async () => {
  const market = await Market.build(Network.MAIN, provider.wallet, connection)

  const pools = await fetchAllPools(market)

  for (const poolAccount of pools) {
    const pool = poolAccount.account
    const poolAddress = poolAccount.publicKey

    if (
      onlyValidation.length > 0 &&
      !onlyValidation.find(address => poolAddress.equals(new PublicKey(address)))
    ) {
      continue
    }

    if (skipValidation.find(address => poolAddress.equals(new PublicKey(address))) !== undefined) {
      console.log(`Skipping pool ${poolAddress.toString()}`)
      continue
    }

    console.log(`Pool address: ${poolAccount.publicKey.toString()}`)
    console.log(
      `Checking pool ${pool.tokenX.toString()}/${pool.tokenY.toString()} at ${pool.fee.v
        .divn(1e7)
        .toString()}`
    )

    const pair = new Pair(pool.tokenX, pool.tokenY, {
      fee: pool.fee.v,
      tickSpacing: pool.tickSpacing
    })

    const expectedAddress = await pair.getAddress(market.program.programId)
    assert.equal(expectedAddress.toString(), poolAccount.publicKey.toString())

    const ticks = await market.getClosestTicks(pair, Infinity)

    // checking liquidity
    const parsed = parseLiquidityOnTicks(ticks).map(({ index, liquidity }) => ({
      liquidity: liquidity.toString(),
      index
    }))
    if (parsed.length !== 0) {
      const lastBelow = parsed.reduce(
        (acc, { index, liquidity }) => (index <= pool.currentTickIndex ? liquidity : acc),
        parsed[0].liquidity
      )
      assert.ok(lastBelow, pool.liquidity.v.toString())
    }

    const getAllPositions = fetchAllPosition(market, poolAccount.publicKey)
    const getReserveBalances = market.getReserveBalances(
      pair,
      new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, Keypair.generate()),
      new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, Keypair.generate())
    )
    const [positions, reserves] = await Promise.all([getAllPositions, getReserveBalances])

    ticks.forEach(({ index, liquidityChange, sign }) => {
      const positionsAbove = positions.filter(({ lowerTickIndex }) => lowerTickIndex === index)
      const positionsBelow = positions.filter(({ upperTickIndex }) => upperTickIndex === index)

      const sumOnPositionsBelow = positionsBelow.reduce(
        (acc, { liquidity: { v } }) => acc.add(v),
        new BN(0)
      )
      const sumOnPositionsAbove = positionsAbove.reduce(
        (acc, { liquidity: { v } }) => acc.add(v),
        new BN(0)
      )

      assert.equal(
        sumOnPositionsAbove.sub(sumOnPositionsBelow).toString(),
        liquidityChange.v.muln(sign ? 1 : -1).toString()
      )
    })

    const sumOfPositions = positions.reduce(
      (acc, position) => {
        const result = simulateWithdrawal(position, pool)

        const tickLower =
          ticks.find(({ index }) => index === position.lowerTickIndex) ?? placeholderTick
        const tickUpper =
          ticks.find(({ index }) => index === position.upperTickIndex) ?? placeholderTick

        const claim = calculateClaimAmount({
          position,
          tickLower,
          tickUpper,
          tickCurrent: pool.currentTickIndex,
          feeGrowthGlobalX: pool.feeGrowthGlobalX,
          feeGrowthGlobalY: pool.feeGrowthGlobalY
        })

        return [acc[0].add(result[0]).add(claim[0]), acc[1].add(result[1]).add(claim[1])]
      },
      [new BN(0), new BN(0)]
    )

    console.log('sumOfPositions:', ...sumOfPositions.map(i => i.toString()))

    console.log('reserve balances:', reserves.x.toString(), reserves.y.toString())
    if (!sumOfPositions[0].lte(reserves.x)) {
      console.log('x is invalid')
    }
    if (!sumOfPositions[1].lte(reserves.y)) {
      console.log('y is invalid')
    }
    if (assertionOn) {
      assert.ok(sumOfPositions[0].lte(reserves.x))
      assert.ok(sumOfPositions[1].lte(reserves.y))
    }
  }
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
