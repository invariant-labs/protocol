import { BN } from '@project-serum/anchor'
import { assert } from 'chai'
import { calculateReward, CalculateReward } from '../staker-sdk/src/utils'

describe('reward tests', () => {
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
