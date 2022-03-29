import { BN } from '@project-serum/anchor'
import { assert } from 'chai'
import { calculateReward, DENOMINATOR, LIQUIDITY_DENOMINATOR } from '../staker-sdk/src/utils'



describe('Calculate Reward tests', () => {
  it('test 1', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(1637002223) },
      endTime: { v: new BN(1640002223) },
      liquidity: { v: new BN(100000).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(4000000).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(10000000).mul(DENOMINATOR) },
      currentTime: { v: new BN(1637002232) }
    })
    assert.ok(result.eq(new BN(2)))
    assert.ok(secondsInside.eq(new BN(6)))
  })
  it('test 2', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(0) },
      endTime: { v: new BN(100) },
      liquidity: { v: new BN(2000000).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(10000000).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(35000000).mul(DENOMINATOR) },
      currentTime: { v: new BN(50) }
    })
    assert.ok(result.eq(new BN(500)))
    assert.ok(secondsInside.eq(new BN(50)))
  })
  it('test 3', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(10).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
      currentTime: { v: new BN(120) }
    })
    assert.ok(result.eq(new BN(200)))
    assert.ok(secondsInside.eq(new BN(20)))
  })
  it('test 4', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(100).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(1).mul(DENOMINATOR) },
      currentTime: { v: new BN(300) }
    })
    assert.ok(result.eq(new BN(500)))
    assert.ok(secondsInside.eq(new BN(100)))
  })
  it('test 5', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(100).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(1).mul(DENOMINATOR) },
      currentTime: { v: new BN(201) }
    })
    assert.ok(result.eq(new BN(990)))
    assert.ok(secondsInside.eq(new BN(100)))
  })
  it('test 6', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(10) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
      currentTime: { v: new BN(120) }
    })
    assert.ok(result.eq(new BN(111)))
    assert.ok(secondsInside.eq(new BN(10)))
  })
  it('test 7', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(0) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
      currentTime: { v: new BN(120) }
    })
    assert.ok(result.eq(new BN(0)))
    assert.ok(secondsInside.eq(new BN(10)))
  })
  it('test 8', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(2).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
      currentTime: { v: new BN(120) }
    })
    assert.ok(result.eq(new BN(0)))
    assert.ok(secondsInside.eq(new BN(0)))
  })
  it('test 9', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(0).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
      currentTime: { v: new BN(120) }
    })
    assert.ok(result.eq(new BN(0)))
    assert.ok(secondsInside.eq(new BN(0)))
  })
  it('test 10', () => {
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(1000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(100) },
      endTime: { v: new BN(200) },
      liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(2).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
      currentTime: { v: new BN(99) }
    })
    assert.ok(result.eq(new BN(0)))
    assert.ok(secondsInside.eq(new BN(0)))
  })
  it('test 11', () => {
    //result should be less than 1 token
    const { secondsInside, result } = calculateReward({
      totalRewardUnclaimed: { v: new BN(100000) },
      totalSecondsClaimed: { v: new BN(0) },
      startTime: { v: new BN(1637002223) },
      endTime: { v: new BN(1637002223) },
      liquidity: { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) },
      secondsPerLiquidityInsideInitial: { v: new BN(4000000).mul(DENOMINATOR) },
      secondsPerLiquidityInside: { v: new BN(10000000).mul(DENOMINATOR) },
      currentTime: { v: new BN(1637002232) }
    })
    assert.ok(result.eq(new BN(0)))
    assert.ok(secondsInside.eq(new BN(6)))
  })
})