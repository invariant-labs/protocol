import { LIQUIDITY_DENOMINATOR } from '@invariant-labs/sdk'
import { PoolStructure, Tick } from '@invariant-labs/sdk/lib/market'
import { BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import {
  calculateReward,
  CalculateReward,
  calculateSecondsPerLiquidityInside,
  dailyFactorRewards,
  rewardsAPY,
  SecondsPerLiquidityInside
} from '../staker-sdk/src/utils'

describe('Staker math tests', () => {
  describe('Reward tests', () => {
    it('case 1', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(1637002223),
        endTime: new BN(1640002223),
        liquidity: { v: new BN(1_000_000).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(4_000_000) },
        secondsPerLiquidityInside: { v: new BN(10_000_000) },
        currentTime: new BN(1637002232)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(2)))
      assert.ok(result.secondsInside.eq(new BN(6)))
    })
    it('case 2', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(0),
        endTime: new BN(100),
        liquidity: { v: new BN(2_000_000).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(10_000_000) },
        secondsPerLiquidityInside: { v: new BN(35_000_000) },
        currentTime: new BN(50)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(500)))
      assert.ok(result.secondsInside.eq(new BN(50)))
    })
    it('case 3', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(100),
        endTime: new BN(200),
        liquidity: { v: new BN(10).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(0).mul(new BN(10).pow(new BN(12))) },
        secondsPerLiquidityInside: { v: new BN(2).mul(new BN(10).pow(new BN(12))) },
        currentTime: new BN(120)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(200)))
      assert.ok(result.secondsInside.eq(new BN(20)))
    })
    it('case 4', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(100),
        endTime: new BN(200),
        liquidity: { v: new BN(100).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(0).mul(new BN(10).pow(new BN(12))) },
        secondsPerLiquidityInside: { v: new BN(1).mul(new BN(10).pow(new BN(12))) },
        currentTime: new BN(300)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(500)))
      assert.ok(result.secondsInside.eq(new BN(100)))
    })
    it('case 5', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(100),
        endTime: new BN(200),
        liquidity: { v: new BN(100).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(0).mul(new BN(10).pow(new BN(12))) },
        secondsPerLiquidityInside: { v: new BN(1).mul(new BN(10).pow(new BN(12))) },
        currentTime: new BN(201)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(990)))
      assert.ok(result.secondsInside.eq(new BN(100)))
    })
    it('case 6', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000),
        totalSecondsClaimed: new BN(10),
        startTime: new BN(100),
        endTime: new BN(200),
        liquidity: { v: new BN(5).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(0).mul(new BN(10).pow(new BN(12))) },
        secondsPerLiquidityInside: { v: new BN(2).mul(new BN(10).pow(new BN(12))) },
        currentTime: new BN(120)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(111)))
      assert.ok(result.secondsInside.eq(new BN(10)))
    })
    it('case 7', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(0),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(100),
        endTime: new BN(200),
        liquidity: { v: new BN(5).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(0).mul(new BN(10).pow(new BN(12))) },
        secondsPerLiquidityInside: { v: new BN(2).mul(new BN(10).pow(new BN(12))) },
        currentTime: new BN(120)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(0)))
      assert.ok(result.secondsInside.eq(new BN(10)))
    })
    it('case 8', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(100),
        endTime: new BN(200),
        liquidity: { v: new BN(5).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(2).mul(new BN(10).pow(new BN(12))) },
        secondsPerLiquidityInside: { v: new BN(2).mul(new BN(10).pow(new BN(12))) },
        currentTime: new BN(120)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(0)))
      assert.ok(result.secondsInside.eq(new BN(0)))
    })
    it('case 9', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(1_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(100),
        endTime: new BN(200),
        liquidity: { v: new BN(100).mul(new BN(0).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(0).mul(new BN(10).pow(new BN(12))) },
        secondsPerLiquidityInside: { v: new BN(2).mul(new BN(10).pow(new BN(12))) },
        currentTime: new BN(120)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(0)))
      assert.ok(result.secondsInside.eq(new BN(0)))
    })
    it('case 10', async () => {
      try {
        const data: CalculateReward = {
          totalRewardUnclaimed: new BN(1_000),
          totalSecondsClaimed: new BN(0),
          startTime: new BN(100),
          endTime: new BN(200),
          liquidity: { v: new BN(5).mul(new BN(10).pow(new BN(6))) },
          secondsPerLiquidityInsideInitial: { v: new BN(0).mul(new BN(10).pow(new BN(12))) },
          secondsPerLiquidityInside: { v: new BN(2).mul(new BN(10).pow(new BN(12))) },
          currentTime: new BN(99)
        }
        const result = calculateReward(data)
        assert.isTrue(false)
      } catch (err) {
        assert.isTrue(true)
      }
    })
    it('case 11', async () => {
      const data: CalculateReward = {
        totalRewardUnclaimed: new BN(100_000),
        totalSecondsClaimed: new BN(0),
        startTime: new BN(1637002223),
        endTime: new BN(1640002223),
        liquidity: { v: new BN(1_000_000).mul(new BN(10).pow(new BN(6))) },
        secondsPerLiquidityInsideInitial: { v: new BN(4_000_000) },
        secondsPerLiquidityInside: { v: new BN(10_000_000) },
        currentTime: new BN(1637002232)
      }
      const result = calculateReward(data)
      assert.ok(result.result.eq(new BN(0)))
      assert.ok(result.secondsInside.eq(new BN(6)))
    })
  })
  describe('SecondsPerLiquidityInside tests', () => {
    const currentTimestamp = new BN(100)
    let tickLower: Tick = {
      pool: Keypair.generate().publicKey,
      index: 0,
      sign: true,
      liquidityChange: { v: new BN(0) },
      liquidityGross: { v: new BN(0) },
      sqrtPrice: { v: new BN(0) },
      feeGrowthOutsideX: { v: new BN(0) },
      feeGrowthOutsideY: { v: new BN(0) },
      secondsPerLiquidityOutside: { v: new BN('3012300000') },
      bump: 0
    }
    let tickUpper: Tick = {
      pool: Keypair.generate().publicKey,
      index: 10,
      sign: true,
      liquidityChange: { v: new BN(0) },
      liquidityGross: { v: new BN(0) },
      sqrtPrice: { v: new BN(0) },
      feeGrowthOutsideX: { v: new BN(0) },
      feeGrowthOutsideY: { v: new BN(0) },
      secondsPerLiquidityOutside: { v: new BN('2030400000') },
      bump: 0
    }
    let pool: PoolStructure = {
      tokenX: Keypair.generate().publicKey,
      tokenY: Keypair.generate().publicKey,
      tokenXReserve: Keypair.generate().publicKey,
      tokenYReserve: Keypair.generate().publicKey,
      positionIterator: new BN(0),
      tickSpacing: 0,
      fee: { v: new BN(0) },
      protocolFee: { v: new BN(0) },
      liquidity: { v: new BN('1000').mul(LIQUIDITY_DENOMINATOR) },
      sqrtPrice: { v: new BN(0) },
      currentTickIndex: -10,
      tickmap: Keypair.generate().publicKey,
      feeGrowthGlobalX: { v: new BN(0) },
      feeGrowthGlobalY: { v: new BN(0) },
      feeProtocolTokenX: new BN(0),
      feeProtocolTokenY: new BN(0),
      secondsPerLiquidityGlobal: { v: new BN(0) },
      startTimestamp: new BN(0),
      lastTimestamp: new BN(0),
      feeReceiver: Keypair.generate().publicKey,
      oracleAddress: Keypair.generate().publicKey,
      oracleInitialized: false,
      bump: 0
    }
    it('case 1', async () => {
      const data: SecondsPerLiquidityInside = {
        tickLower,
        tickUpper,
        pool,
        currentTimestamp
      }

      const result = calculateSecondsPerLiquidityInside(data)
      assert.ok(result.eq(new BN(981900000)))
    })
    it('case 2', async () => {
      pool.currentTickIndex = 0
      const data: SecondsPerLiquidityInside = {
        tickLower,
        tickUpper,
        pool,
        currentTimestamp
      }

      const result = calculateSecondsPerLiquidityInside(data)
      assert.ok(result.eq(new BN(94957300000)))
    })
    it('case 3', async () => {
      tickLower.secondsPerLiquidityOutside = { v: new BN('2012333200') }
      tickUpper.secondsPerLiquidityOutside = { v: new BN('3012333310') }
      pool.currentTickIndex = 20

      const data: SecondsPerLiquidityInside = {
        tickLower,
        tickUpper,
        pool,
        currentTimestamp
      }

      const result = calculateSecondsPerLiquidityInside(data)
      assert.ok(result.eq(new BN(1000000110)))
    })
    it('case 4', async () => {
      tickLower.secondsPerLiquidityOutside = { v: new BN('201233320000') }
      tickUpper.secondsPerLiquidityOutside = { v: new BN('301233331000') }
      pool.currentTickIndex = 20

      const data: SecondsPerLiquidityInside = {
        tickLower,
        tickUpper,
        pool,
        currentTimestamp
      }

      const result = calculateSecondsPerLiquidityInside(data)
      assert.ok(result.eq(new BN(100000011000)))
    })
    it('case 5', async () => {
      tickLower.secondsPerLiquidityOutside = { v: new BN('201233320000') }
      tickUpper.secondsPerLiquidityOutside = { v: new BN('301233331000') }
      pool.currentTickIndex = -20

      const data: SecondsPerLiquidityInside = {
        tickLower,
        tickUpper,
        pool,
        currentTimestamp
      }

      const result = calculateSecondsPerLiquidityInside(data)
      assert.ok(result.eq(new BN('340282366920938463463374607331768200456')))
    })
  })
  describe('dailyFactorReward tests', () => {
    it('case 1', async () => {
      const reward = new BN(10000)
      const liquidity = { v: new BN(1000000) }
      const duration = new BN(10)

      const result = dailyFactorRewards(reward, liquidity, duration)
      assert.equal(result, 0.001)
    })
  })
  describe('reward APY tests', () => {
    it('case 1', async () => {
      const dailyFactorRewards = 0.001
      const duration = 10

      const result = rewardsAPY(dailyFactorRewards, duration)
      assert.equal(result, 43.790483176778205)
    })
  })
})
