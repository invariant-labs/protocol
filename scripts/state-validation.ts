import { ProgramAccount, Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import {
  bigNumberToBuffer,
  calculateClaimAmount,
  FEE_TIERS,
  toDecimal
} from '@invariant-labs/sdk/src/utils'
import { parseLiquidityOnTicks } from '@invariant-labs/sdk/lib/utils'
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes'
import { FeeTier, PoolStructure, Position } from '@invariant-labs/sdk/src/market'
import { BN } from '../sdk-staker/lib'
import { assert } from 'chai'
import { getDeltaX } from '@invariant-labs/sdk/lib/math'
import { calculatePriceSqrt } from '@invariant-labs/sdk'
import { getDeltaY } from '@invariant-labs/sdk/src/math'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Tick } from '@invariant-labs/sdk/lib/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection

const placeholderTick: Tick = {
  index: 0,
  liquidityChange: { v: new BN(0) },
  sign: false,
  pool: Keypair.generate().publicKey,
  liquidityGross: { v: new BN(0) },
  feeGrowthOutsideX: { v: new BN(0) },
  feeGrowthOutsideY: { v: new BN(0) },
  sqrtPrice: { v: new BN(0) },
  bump: 0
}

const fetchAllPosition = async (market: Market, poolAddress: PublicKey) => {
  return (
    (await market.program.account.position.all([
      {
        memcmp: { bytes: bs58.encode(poolAddress.toBuffer()), offset: 40 }
      }
    ])) as ProgramAccount<Position>[]
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
      ),
      new BN(0)
    ]
  } else if (pool.currentTickIndex < position.upperTickIndex) {
    return [
      getDeltaX(
        pool.sqrtPrice,
        calculatePriceSqrt(position.upperTickIndex),
        position.liquidity,
        false
      ),
      getDeltaY(
        calculatePriceSqrt(position.lowerTickIndex),
        pool.sqrtPrice,
        position.liquidity,
        false
      )
    ]
  } else {
    return [
      new BN(0),
      getDeltaY(
        calculatePriceSqrt(position.lowerTickIndex),
        calculatePriceSqrt(position.upperTickIndex),
        position.liquidity,
        false
      )
    ]
  }
}

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  const pools = await fetchAllPools(market)

  for (const poolAccount of pools) {
    const pool = poolAccount.account
    console.log(`Checking pool ${pool.tokenX}/${pool.tokenY} at ${pool.fee.v.divn(1e7)}`)

    const pair = new Pair(pool.tokenX, pool.tokenY, {
      fee: pool.fee.v
    })
    const expectedAddress = await pair.getAddress(market.program.programId)

    assert.equal(expectedAddress.toString(), poolAccount.publicKey.toString())

    const ticks = await market.getClosestTicks(pair, Infinity)

    // checking liquidity
    const parsed = parseLiquidityOnTicks(ticks, pool).map(({ index, liquidity }) => ({
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

    // fetching position
    const positions = await fetchAllPosition(
      market,
      await pair.getAddress(market.program.programId)
    )

    ticks.forEach(({ index, liquidityChange, sign }) => {
      const positionsBelow = positions.filter(({ lowerTickIndex }) => lowerTickIndex == index)
      const positionsAbove = positions.filter(({ upperTickIndex }) => upperTickIndex == index)

      const sumOnPositionsBelow = positionsBelow.reduce(
        (acc, { liquidity: { v } }) => acc.add(v),
        new BN(0)
      )
      const sumOnPositionsAbove = positionsAbove.reduce(
        (acc, { liquidity: { v } }) => acc.add(v),
        new BN(0)
      )

      assert.equal(
        sumOnPositionsBelow.sub(sumOnPositionsAbove).toString(),
        liquidityChange.v.muln(sign ? 1 : -1).toString()
      )
    })

    const p: Position = {
      lowerTickIndex: -20,
      upperTickIndex: 10,
      liquidity: { v: new BN(1000000).mul(DENOMINATOR) },
      owner: Keypair.generate().publicKey,
      pool: Keypair.generate().publicKey,
      id: new BN(0),
      feeGrowthInsideX: { v: new BN(0) },
      feeGrowthInsideY: { v: new BN(0) },
      secondsPerLiquidityInside: { v: new BN(0) },
      lastSlot: new BN(0),
      tokensOwedX: { v: new BN(0) },
      tokensOwedY: { v: new BN(0) },
      bump: 0
    }

    const sumOfPositions = positions.reduce(
      (acc, position) => {
        const result = simulateWithdrawal(position, pool)

        const tickLower =
          ticks.find(({ index }) => index == position.lowerTickIndex) ?? placeholderTick
        const tickUpper =
          ticks.find(({ index }) => index == position.upperTickIndex) ?? placeholderTick

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

    const reserves = await market.getReserveBalances(
      pair,
      new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, Keypair.generate()),
      new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, Keypair.generate())
    )
    console.log('reserve balances:', reserves.x.toString(), reserves.y.toString())
    assert.ok(sumOfPositions[0].lte(reserves.x))
    assert.ok(sumOfPositions[1].lte(reserves.y))
  }
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
