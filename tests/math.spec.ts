import { assert, expect } from 'chai'
import { BN } from '@project-serum/anchor'
import {
  calculatePriceSqrt,
  DENOMINATOR,
  TICK_LIMIT,
  TICK_SEARCH_RANGE,
  MAX_TICK,
  MIN_TICK
} from '@invariant-labs/sdk'
import {
  calculateSwapStep,
  getDeltaX,
  getDeltaY,
  getLiquidityByX,
  getLiquidityByY,
  getNextPriceXUp,
  getNextPriceYDown,
  getX,
  getY,
  sqrt,
  SwapResult,
  calculatePriceAfterSlippage,
  findClosestTicks,
  isEnoughAmountToPushPrice,
  calculatePriceImpact,
  calculateMinReceivedTokensByAmountIn,
  getXfromLiquidity
} from '@invariant-labs/sdk/src/math'
import {
  bigNumberToBuffer,
  calculateClaimAmount,
  calculateConcentration,
  calculateFeeGrowthInside,
  calculateTickDelta,
  calculateTokensOwed,
  CloserLimit,
  dailyFactorPool,
  dailyFactorRewards,
  FeeGrowthInside,
  getCloserLimit,
  getConcentrationArray,
  getVolume,
  GROWTH_DENOMINATOR,
  poolAPY,
  PositionClaimData,
  PRICE_DENOMINATOR,
  PRICE_SCALE,
  rewardsAPY,
  SimulateClaim,
  simulateSwap,
  SimulationResult,
  TokensOwed,
  toPercent,
  toPrice,
  getTokensData,
  TokenData,
  U128MAX,
  ApyPositionRewardsParams,
  positionsRewardAPY,
  UserDailyRewardsParams,
  calculateUserDailyRewards,
  arithmeticalAvg,
  weightedArithmeticAvg
} from '@invariant-labs/sdk/src/utils'
import {
  createTickArray,
  jsonArrayToTicks,
  setInitialized,
  usdcUsdhPoolSnapshot
} from './testUtils'
import { Decimal, Tick, Tickmap } from '@invariant-labs/sdk/src/market'
import { getSearchLimit, tickToPosition } from '@invariant-labs/sdk/src/tickmap'
import { Keypair } from '@solana/web3.js'
import { swapParameters } from './swap'
import {
  ApyPoolParams,
  ApyRewardsParams,
  calculateTokensAndLiquidity,
  FEE_TIERS,
  LIQUIDITY_DENOMINATOR,
  parseFeeGrowthAndLiquidityOnTicksMap,
  toDecimal,
  WeeklyData
} from '@invariant-labs/sdk/lib/utils'
import { priceToTickInRange } from '@invariant-labs/sdk/src/tick'
import { getLiquidity, U64_MAX } from '@invariant-labs/sdk/lib/math'

describe('Math', () => {
  describe('arithmeticalAvg', () => {
    it('throws an error when called with 0 arguments', () => {
      expect(() => arithmeticalAvg()).to.throw()
    })
    it('returns the correct average for 1 numbers', () => {
      const sampleValue = new BN(32)
      const result = arithmeticalAvg(sampleValue)
      assert.ok(result.eq(sampleValue))
    })
    it('returns the correct average for 2 numbers', () => {
      const result = arithmeticalAvg(new BN(10), new BN(12))
      assert.ok(result.eq(new BN(11)))
    })
    it('returns the correct average for 3 numbers', () => {
      const result = arithmeticalAvg(new BN(10), new BN(50), new BN(12))
      assert.ok(result.eq(new BN(24)))
    })
    it('returns the correct average for 5 numbers', () => {
      const result = arithmeticalAvg(
        new BN(10),
        new BN(50),
        new BN(12),
        new BN(10024),
        new BN(11479)
      )
      assert.ok(result.eq(new BN(4315)))
    })
  })
  describe('weightedArithmeticAvg', () => {
    it('throws an error when called with 0 arguments', () => {
      expect(() => weightedArithmeticAvg()).to.throw()
    })

    it('returns the correct average for 1 value', () => {
      const sampleValue = new BN(32)
      const sampleWeight = new BN(15458215158)
      const result = weightedArithmeticAvg({ val: sampleValue, weight: sampleWeight })
      assert.ok(result.eq(sampleValue))
    })

    it('returns the correct average for 2 values with equal weights', () => {
      const result = weightedArithmeticAvg(
        { val: new BN(10), weight: new BN(12654) },
        { val: new BN(12), weight: new BN(12654) }
      )
      assert.ok(result.eq(new BN(11)))
    })

    it('returns the correct average for 2 values with different weights', () => {
      const result = weightedArithmeticAvg(
        { val: new BN(10), weight: new BN(3) },
        { val: new BN(12), weight: new BN(1) }
      )
      assert.ok(result.eq(new BN(10))) // average of 10.67 rounded down
    })

    it('returns the correct average for 3 values with different weights', () => {
      const result = weightedArithmeticAvg(
        { val: new BN(10), weight: new BN(2) },
        { val: new BN(50), weight: new BN(3) },
        { val: new BN(12), weight: new BN(1) }
      )
      assert.ok(result.eq(new BN(30))) // average of 30.(33) rounded down
    })

    it('returns the correct average for 5 values with different weights', () => {
      const result = weightedArithmeticAvg(
        { val: new BN(10), weight: new BN(1) },
        { val: new BN(50), weight: new BN(2) },
        { val: new BN(12), weight: new BN(3) },
        { val: new BN(10024), weight: new BN(4) },
        { val: new BN(11479), weight: new BN(5) }
      )
      assert.ok(result.eq(new BN(6509))) // average of 6509.1(3) rounded down
    })
  })
  describe('Test sqrt price calculation', () => {
    it('Test 20000', () => {
      const price = 20000
      const result = calculatePriceSqrt(price)
      // expected 2.718145925979
      assert.ok(result.v.eq(new BN('2718145925979' + '0'.repeat(PRICE_SCALE - 12))))
    })
    it('Test 200000', () => {
      const price = 200000
      const result = calculatePriceSqrt(price)
      // expected 22015.455979766288
      assert.ok(result.v.eq(new BN('22015455979766288' + '0'.repeat(PRICE_SCALE - 12))))
    })
    it('Test -20000', () => {
      const price = -20000
      const result = calculatePriceSqrt(price)
      // expected 0.367897834491
      assert.ok(result.v.eq(new BN('367897834491' + '0'.repeat(PRICE_SCALE - 12))))
    })
    it('Test -200000', () => {
      const price = -200000
      const result = calculatePriceSqrt(price)
      // expected 0.000045422634
      assert.ok(result.v.eq(new BN('45422634' + '0'.repeat(PRICE_SCALE - 12))))
    })
    it('Test 0', () => {
      const price = 0
      const result = calculatePriceSqrt(price)
      // expected 2.718145925979
      assert.ok(result.v.eq(new BN('1000000000000' + '0'.repeat(PRICE_SCALE - 12))))
    })
  })
  describe('calculate y, liquidity', () => {
    const tokenDecimal = 6
    const x = new BN(43 * 10 ** (tokenDecimal - 2)) // 0.43
    const currentSqrtPrice = calculatePriceSqrt(100)

    it('below current tick', async () => {
      const lowerTick = -50
      const upperTick = 10
      try {
        getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)
        assert.ok(false)
      } catch (e) {
        assert.ok(true)
      }
    })
    it('in current tick', async () => {
      // rust results:
      const expectedL = { v: new BN('432392997000000') }
      const expectedRoundUpY = new BN('434322')
      const expectedRoundDownY = new BN('434321')

      const lowerTick = 80
      const upperTick = 120
      const { liquidity: roundUpLiquidity, y: roundUpY } = getLiquidityByX(
        x,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const { liquidity: roundDownLiquidity, y: roundDownY } = getLiquidityByX(
        x,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )
      assert.ok(roundUpLiquidity.v.eq(expectedL.v))
      assert.ok(roundDownLiquidity.v.eq(expectedL.v))
      assert.ok(expectedRoundUpY.eq(roundUpY))
      assert.ok(expectedRoundDownY.eq(roundDownY))
    })
    it('above current tick', async () => {
      // rust results:
      const expectedL = { v: new BN('13548826311623') }
      const expectedY = new BN(0)

      const lowerTick = 150
      const upperTick = 800

      const { liquidity: roundUpLiquidity, y: roundUpY } = getLiquidityByX(
        x,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const { liquidity: roundDownLiquidity, y: roundDownY } = getLiquidityByX(
        x,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )

      assert.ok(roundUpLiquidity.v.eq(expectedL.v))
      assert.ok(roundDownLiquidity.v.eq(expectedL.v))
      assert.ok(roundUpY.eq(expectedY))
      assert.ok(roundDownY.eq(expectedY))
    })
  })
  describe('calculate x, liquidity', () => {
    const tokenDecimal = 9
    const y = new BN(476 * 10 ** (tokenDecimal - 1)) // 47.6
    const currentTick = -20000
    const currentSqrtPrice = calculatePriceSqrt(currentTick)

    it('below current tick', async () => {
      // rust results:
      const expectedL = { v: new BN('2789052279103923275') }

      const lowerTick = -22000
      const upperTick = -21000

      const { liquidity: roundUpLiquidity, x: roundUpX } = getLiquidityByY(
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const { liquidity: roundDownLiquidity, x: roundDownX } = getLiquidityByY(
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )

      assert.ok(expectedL.v.eq(roundUpLiquidity.v))
      assert.ok(expectedL.v.eq(roundDownLiquidity.v))
      assert.ok(roundUpX.eq(new BN(0)))
      assert.ok(roundDownX.eq(new BN(0)))
    })
    it('in current tick', async () => {
      // rust results:
      const expectedL = { v: new BN('584945290554346935') }
      const expectedXRoundUp = new BN('77539808126')
      const expectedXRoundDown = new BN('77539808125')

      const lowerTick = -25000
      const upperTick = -19000

      const { liquidity: roundUpLiquidity, x: roundUpX } = getLiquidityByY(
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const { liquidity: roundDownLiquidity, x: roundDownX } = getLiquidityByY(
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )

      assert.ok(expectedL.v.eq(roundUpLiquidity.v))
      assert.ok(expectedL.v.eq(roundDownLiquidity.v))
      assert.ok(expectedXRoundUp.eq(roundUpX))
      assert.ok(expectedXRoundDown.eq(roundDownX))
    })
    it('above current tick', async () => {
      const lowerTick = -10000
      const upperTick = 0
      try {
        getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)
        assert.ok(false)
      } catch (e) {
        assert.ok(true)
      }
    })
  })
  describe('calculate liquidity (without specifying on which token)', () => {
    const tokenDecimal = 9
    const y = new BN(476 * 10 ** (tokenDecimal - 1)) // 47.6
    const currentTick = -20000
    const currentSqrtPrice = calculatePriceSqrt(currentTick)

    it('below current tick', async () => {
      const lowerTick = -22000
      const upperTick = -21000

      const expectedX = new BN(0)
      const expectedL = { v: new BN('2789052279103923275') }
      const { liquidity: roundUpLiquidity, x: expectedRoundUpX } = getLiquidity(
        expectedX,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const { liquidity: roundDownLiquidity, x: expectedRoundDownX } = getLiquidity(
        expectedX,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )

      assert.ok(expectedL.v.eq(roundUpLiquidity.v))
      assert.ok(expectedL.v.eq(roundDownLiquidity.v))
      assert.ok(expectedRoundUpX.eq(new BN(0)))
      assert.ok(expectedRoundDownX.eq(new BN(0)))
    })
    //
    it('in current tick', async () => {
      // rust results:
      const expectedRoundUpL = { v: new BN('584945290554346935') }
      const expectedRoundDownL = { v: new BN('584945290552000000') }

      const expectedXRoundUp = new BN('77539808126')
      const expectedXRoundDown = new BN('77539808125')

      const lowerTick = -25000
      const upperTick = -19000

      const { liquidity: roundUpLiquidity, x: roundUpX } = getLiquidity(
        expectedXRoundUp,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const { liquidity: roundDownLiquidity, x: roundDownX } = getLiquidity(
        expectedXRoundDown,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )
      assert.ok(expectedRoundUpL.v.eq(roundUpLiquidity.v))
      assert.ok(expectedRoundDownL.v.eq(roundDownLiquidity.v))
      assert.ok(expectedXRoundUp.eq(roundUpX))
      assert.ok(expectedXRoundDown.eq(roundDownX))
    })
    it('above current tick', async () => {
      const lowerTick = 150
      const upperTick = 800
      const x = new BN(43 * 10 ** (tokenDecimal - 2)) // 0.43
      const sqrtPrice = calculatePriceSqrt(100)
      const expectedY = new BN(0)
      const expectedL = { v: new BN('13548826311623850') }

      const {
        liquidity: roundingUpLiquidity,
        x: expectedRoundingUpX,
        y: expectedRoundingUpY
      } = getLiquidity(x, expectedY, lowerTick, upperTick, sqrtPrice, true)

      const {
        liquidity: roundingDownLiquidity,
        x: expectedRoundingDownX,
        y: expectedRoundingDownY
      } = getLiquidity(x, expectedY, lowerTick, upperTick, sqrtPrice, false)

      assert.ok(roundingUpLiquidity.v.eq(expectedL.v))
      assert.ok(roundingDownLiquidity.v.eq(expectedL.v))
      assert.ok(expectedRoundingUpX.eq(x))
      assert.ok(expectedRoundingDownX.eq(x))
      assert.ok(expectedRoundingUpY.eq(expectedY))
      assert.ok(expectedRoundingDownY.eq(expectedY))
    })
  })
  describe('calculate slippage', () => {
    it('no slippage up', async () => {
      const price = toPrice(1)
      const slippage = toPercent(0)

      const expected = PRICE_DENOMINATOR

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('no slippage down', async () => {
      const price = toPrice(1)
      const slippage = toPercent(0)

      const expected = PRICE_DENOMINATOR

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 1% up', async () => {
      const price = toPrice(1)
      const slippage = toPercent(1, 2)

      const expected = new BN('1009999999999821057900544')

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 1% down', async () => {
      const price = toPrice(1)
      const slippage = toPercent(1, 2)

      const expected = new BN('989999999998766305655236')

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,5% up', async () => {
      const price = toPrice(1)
      const slippage = toPercent(5, 3)

      const expected = new BN('1004999999999657010652944')

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,5% down', async () => {
      const price = toPrice(1)
      const slippage = toPercent(5, 3)

      const expected = new BN('994999999999999667668569')

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,00001% up', async () => {
      const price = toPrice(1)
      const slippage = toPercent(3, 7)

      const expected = new BN('1000000299998022499700001')

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,00001% down', async () => {
      const price = toPrice(1)
      const slippage = toPercent(3, 7)

      const expected = new BN('999999699998022500300001')

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 100% up', async () => {
      const price = toPrice(1)
      const slippage = toPercent(1)

      const expected = new BN('1999999999999731161391129')

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 100% down', async () => {
      const price = toPrice(1)
      const slippage = toPercent(1)

      const expected = 0

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(PRICE_DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })
  })
  describe('find closest ticks', () => {
    const bitmap = new Array(TICK_LIMIT * 2).fill(0)

    it('simple', async () => {
      const initialized = [-20, -14, -3, -2, -1, 5, 99]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 0, 1, 200)
      const isEqual = initialized.join(',') === result.join(',')

      assert.ok(isEqual)
    })

    it('near bottom limit', async () => {
      const initialized = [-TICK_LIMIT + 1]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 0, 1, 200)
      assert.ok(result[0] === initialized[0])
    })

    it('near top limit', async () => {
      const initialized = [TICK_LIMIT]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 0, 1, 200)
      assert.ok(result.pop() === initialized[0])
    })

    it('with limit', async () => {
      const initialized = [998, 999, 1000, 1001, 1002, 1003]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 1000, 1, 3)
      const isEqual = [999, 1000, 1001].join(',') === result.join(',')
      assert.ok(isEqual)
    })

    it('with range', async () => {
      const initialized = [998, 999, 1000, 1001, 1002, 1003]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 1000, 1, 1000, 2)
      const isEqual = [999, 1000, 1001, 1002].join(',') === result.join(',')
      assert.ok(isEqual)
    })

    it('only up', async () => {
      const initialized = [998, 999, 1000, 1001, 1002, 1003]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 1000, 1, 1000, 10, 'up')
      const isEqual = [1001, 1002, 1003].join(',') === result.join(',')
      assert.ok(isEqual)
    })

    it('only down', async () => {
      const initialized = [998, 999, 1000, 1001, 1002, 1003]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 1000, 1, 1000, 10, 'down')
      const isEqual = [998, 999, 1000].join(',') === result.join(',')
      assert.ok(isEqual)
    })
  })
  describe('calculate x having price and liquidity', () => {
    const liquidity = new BN(2000).mul(LIQUIDITY_DENOMINATOR)
    const lowerTick = 60
    const upperTick = 120

    it('current < lower', async () => {
      const currentTick = 50

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const x = getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(x.eq(new BN(5)))
    })

    it('lower < current < upper', async () => {
      const currentTick = 80

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const x = getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(x.eq(new BN(3)))
    })

    it('current > upper', async () => {
      const currentTick = 130

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const x = getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(x.eqn(0))
    })

    it('upperSqrtPrice = 0', async () => {
      const upperSqrtPrice = new BN(0)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(10)

      try {
        getX(liquidity, upperSqrtPrice, currentSqrtPrice.v, lowerSqrtPrice.v)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('currentSqrtPrice = 0', async () => {
      const currentSqrtPrice = new BN(0)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const upperSqrtPrice = calculatePriceSqrt(upperTick)

      try {
        getX(liquidity, upperSqrtPrice.v, currentSqrtPrice, lowerSqrtPrice.v)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('lowerSqrtPrice = 0', async () => {
      const currentSqrtPrice = calculatePriceSqrt(20)
      const lowerSqrtPrice = new BN(0)
      const upperSqrtPrice = calculatePriceSqrt(10)

      try {
        getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })
    it('getXfromLiquidity', async () => {
      const upperSqrtPrice = calculatePriceSqrt(500)
      const lowerSqrtPrice = calculatePriceSqrt(-480)

      const x = getXfromLiquidity(liquidity, upperSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(x.eqn(97))
    })
    it('getXfromLiquidity 2', async () => {
      const upperSqrtPrice = calculatePriceSqrt(480)
      const lowerSqrtPrice = calculatePriceSqrt(470)

      const x = getXfromLiquidity(new BN(673755091404475), upperSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(x.eqn(328954))
    })
  })

  describe('calculate y having liquidity and price', () => {
    const liquidity = new BN(2000).mul(LIQUIDITY_DENOMINATOR)
    const lowerTick = 60
    const upperTick = 120

    it('current < lower', async () => {
      const currentTick = 50

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const y = getY(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(y.eq(new BN(0)))
    })

    it('lower < current < upper', async () => {
      const currentTick = 80

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const y = getY(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(y.eq(new BN(2)))
    })

    it('lowerSqrtPrice > currentSqrtPrice', async () => {
      const currentTick = 130

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const y = getY(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(y.eq(new BN(6)))
    })

    it('lowerSqrtPrice = 0', async () => {
      const lowerSqrtPrice = new BN(0)
      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const currentSqrtPrice = calculatePriceSqrt(0)

      try {
        getY(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('currentSqrtPrice = 0', async () => {
      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const currentSqrtPrice = new BN(0)
      const lowerSqrtPrice = calculatePriceSqrt(0)

      try {
        getY(liquidity, upperSqrtPrice.v, currentSqrtPrice, lowerSqrtPrice.v)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('upperSqrtPrice = 0', async () => {
      const upperSqrtPrice = new BN(0)
      const currentSqrtPrice = calculatePriceSqrt(-10)
      const lowerSqrtPrice = calculatePriceSqrt(0)

      try {
        getY(liquidity, upperSqrtPrice, currentSqrtPrice.v, lowerSqrtPrice.v)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })
  })
  describe('big number to little endian', () => {
    it('simple', async () => {
      const n = new BN(1)
      const buffer = bigNumberToBuffer(n, 32)

      const simpleBuffer = Buffer.alloc(4)
      simpleBuffer.writeInt32LE(n.toNumber())

      assert.equal(simpleBuffer.toString('hex'), buffer.toString('hex'))
    })

    it('random', async () => {
      const n = new BN(0x0380f79a)
      const buffer = bigNumberToBuffer(n, 32)

      const simpleBuffer = Buffer.alloc(4)
      simpleBuffer.writeInt32LE(n.toNumber())

      assert.equal(simpleBuffer.toString('hex'), buffer.toString('hex'))
    })
  })
  describe('test calculateSwapStep', () => {
    it('one token by amount in', async () => {
      const price: Decimal = { v: PRICE_DENOMINATOR }
      const target: Decimal = {
        v: sqrt(PRICE_DENOMINATOR.mul(new BN('101')).div(new BN('100')).mul(PRICE_DENOMINATOR))
      }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2000')) }
      const amount: BN = new BN('1')
      const fee = toPercent(6, 4)

      const result: SwapResult = calculateSwapStep(price, target, liquidity, amount, true, fee)

      const expectedResult: SwapResult = {
        nextPrice: price,
        amountIn: new BN('0'),
        amountOut: new BN('0'),
        feeAmount: new BN('1')
      }

      assert.ok(result.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(result.amountIn.eq(expectedResult.amountIn))
      assert.ok(result.amountOut.eq(expectedResult.amountOut))
      assert.ok(result.feeAmount.eq(expectedResult.feeAmount))
    })

    it('amount out capped at target price', async () => {
      const price: Decimal = { v: PRICE_DENOMINATOR }
      const target: Decimal = {
        v: sqrt(PRICE_DENOMINATOR.mul(new BN('101')).div(new BN('100')).mul(PRICE_DENOMINATOR))
      }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2000')) }
      const amount: BN = new BN('20')
      const fee = toPercent(6, 4)

      const resultIn: SwapResult = calculateSwapStep(price, target, liquidity, amount, true, fee)
      const resultOut: SwapResult = calculateSwapStep(price, target, liquidity, amount, false, fee)

      const expectedResult: SwapResult = {
        nextPrice: target,
        amountIn: new BN('10'),
        amountOut: new BN('9'),
        feeAmount: new BN('1')
      }

      assert.ok(resultIn.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(resultIn.amountIn.eq(expectedResult.amountIn))
      assert.ok(resultIn.amountOut.eq(expectedResult.amountOut))
      assert.ok(resultIn.feeAmount.eq(expectedResult.feeAmount))

      assert.ok(resultOut.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(resultOut.amountIn.eq(expectedResult.amountIn))
      assert.ok(resultOut.amountOut.eq(expectedResult.amountOut))
      assert.ok(resultOut.feeAmount.eq(expectedResult.feeAmount))
    })

    it('amount in not capped', async () => {
      const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('101')).div(new BN('100')) }
      const target: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('10')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('300000000')) }
      const amount: BN = new BN('1000000')
      const fee = toPercent(6, 4)

      const result: SwapResult = calculateSwapStep(price, target, liquidity, amount, true, fee)

      const expectedResult: SwapResult = {
        nextPrice: { v: new BN('1013331333333' + '3'.repeat(PRICE_SCALE - 12)) },
        amountIn: new BN('999400'),
        amountOut: new BN('976487'), // ((1.0133313333333333333333333333 - 1.01) * 300000000) / (1.0133313333333333333333333333 * 1.01)
        feeAmount: new BN('600')
      }

      assert.ok(result.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(result.amountIn.eq(expectedResult.amountIn))
      assert.ok(result.amountOut.eq(expectedResult.amountOut))
      assert.ok(result.feeAmount.eq(expectedResult.feeAmount))
    })
    it('amount out not capped', async () => {
      const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('101')) }
      const target: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('100')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('5000000000000')) }
      const amount: BN = new BN('2000000')
      const fee = toPercent(6, 4)

      const result: SwapResult = calculateSwapStep(price, target, liquidity, amount, false, fee)

      const expectedResult: SwapResult = {
        nextPrice: { v: new BN('100999999600000' + '0'.repeat(PRICE_SCALE - 12)) },
        amountIn: new BN('197'),
        amountOut: amount, // (5000000000000000000000000 * (101 - 100.9999996)) /  (101 * 100.9999996)
        feeAmount: new BN('1')
      }

      assert.ok(result.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(result.amountIn.eq(expectedResult.amountIn))
      assert.ok(result.amountOut.eq(expectedResult.amountOut))
      assert.ok(result.feeAmount.eq(expectedResult.feeAmount))
    })
  })
  describe('test getDeltaX', () => {
    it('zero at zero liquidity', async () => {
      const priceA: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('0')) }

      const result = getDeltaX(priceA, priceB, liquidity, false) ?? U64_MAX

      const expectedResult = new BN('0')
      assert.ok(result.eq(expectedResult))
    })
    it('equal at equal liquidity', async () => {
      const priceA: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('2')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2')) }

      const result = getDeltaX(priceA, priceB, liquidity, false) ?? U64_MAX

      const expectedResult = new BN('1')
      assert.ok(result.eq(expectedResult))
    })

    it('big numbers', async () => {
      const priceA: Decimal = { v: new BN('234878324943782000000000000') }
      const priceB: Decimal = { v: new BN('87854456421658000000000000') }
      const liquidity: Decimal = { v: new BN('983983249092') }

      const resultDown = getDeltaX(priceA, priceB, liquidity, false) ?? U64_MAX
      const resultUp = getDeltaX(priceA, priceB, liquidity, true) ?? U64_MAX

      const expectedResultDown = new BN(7010)
      const expectedResultUp = new BN(7011)
      // 7010.8199533090222620342346078676429792113623790285962379282493052
      assert.ok(resultDown.eq(expectedResultDown))
      assert.ok(resultUp.eq(expectedResultUp))
    })
  })
  describe('test getDeltaY', () => {
    it('zero at zero liquidity', async () => {
      const priceA: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('0')) }

      const result = getDeltaY(priceA, priceB, liquidity, false) ?? U64_MAX

      const expectedResult = new BN('0')
      assert.ok(result.eq(expectedResult))
    })
    it('equal at equal liquidity', async () => {
      const priceA: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('2')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2')) }

      const result = getDeltaY(priceA, priceB, liquidity, false) ?? U64_MAX

      const expectedResult = new BN('2')
      assert.ok(result.eq(expectedResult))
    })

    it('big numbers', async () => {
      const priceA: Decimal = { v: new BN('234878324943782000000000000') }
      const priceB: Decimal = { v: new BN('87854456421658000000000000') }
      const liquidity: Decimal = { v: new BN('983983249092') }

      const resultDown = getDeltaY(priceA, priceB, liquidity, false) ?? U64_MAX
      const resultUp = getDeltaY(priceA, priceB, liquidity, true) ?? U64_MAX

      const expectedResultDown = new BN(144669023)
      const expectedResultUp = new BN(144669024)

      assert.ok(resultDown.eq(expectedResultDown))
      assert.ok(resultUp.eq(expectedResultUp))
    })

    it('overflow', async () => {
      const priceA: Decimal = { v: PRICE_DENOMINATOR }
      const priceB: Decimal = { v: PRICE_DENOMINATOR.muln(2) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN(2).pow(new BN(64))) }

      const resultDown = getDeltaY(priceA, priceB, liquidity, false)
      const resultUp = getDeltaY(priceA, priceB, liquidity, true)

      assert.ok(resultDown === null)
      assert.ok(resultUp === null)
    })

    it('huge liquidity', async () => {
      const priceA: Decimal = { v: PRICE_DENOMINATOR }
      const priceB: Decimal = { v: PRICE_DENOMINATOR.addn(1000000) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN(2).pow(new BN(80))) }

      const resultDown = getDeltaY(priceA, priceB, liquidity, false)
      const resultUp = getDeltaY(priceA, priceB, liquidity, true)

      assert.ok(resultDown !== null)
      assert.ok(resultUp !== null)
    })
  })
  describe('test getNextPriceXUp', () => {
    describe('add', () => {
      it('1', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('1')) }
        const amount: BN = new BN('1')

        const result = getNextPriceXUp(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('500000000000' + '0'.repeat(PRICE_SCALE - 12)) }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {})
      const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2')) }
      const amount: BN = new BN('3')

      const result = getNextPriceXUp(price, liquidity, amount, true)
      const expectedResult: Decimal = { v: new BN('400000000000' + '0'.repeat(PRICE_SCALE - 12)) }

      assert.ok(result.v.eq(expectedResult.v))
      it('3', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('2')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('3')) }
        const amount: BN = new BN('5')

        const result = getNextPriceXUp(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('461538461538461538461539') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('4', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('24234')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('3000')) }
        const amount: BN = new BN('5000')

        const result = getNextPriceXUp(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('599985145205615112277488') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
    describe('subtract', () => {
      it('1', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2')) }
        const amount: BN = new BN('1')

        const result = getNextPriceXUp(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: PRICE_DENOMINATOR.muln(2) }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('100000')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('500000000')) }
        const amount: BN = new BN('4000')

        const result = getNextPriceXUp(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: PRICE_DENOMINATOR.muln(500000) }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('3', async () => {
        const price: Decimal = { v: new BN('3333333333333' + '3'.repeat(PRICE_SCALE - 12)) }
        const liquidity: Decimal = { v: new BN('222222222') }
        const amount: BN = new BN('37')

        const result = getNextPriceXUp(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('7490636713462104974072145') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
  })
  describe('test getNextPriceYDown', () => {
    describe('add', () => {
      it('1', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('1')) }
        const amount: BN = new BN('1')

        const result = getNextPriceYDown(price, liquidity, amount, true)
        const expectedResult: Decimal = {
          v: new BN('2000000000000' + '0'.repeat(PRICE_SCALE - 12))
        }
        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {})
      const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2')) }
      const amount: BN = new BN('3')

      const result = getNextPriceYDown(price, liquidity, amount, true)
      const expectedResult: Decimal = { v: new BN('2500000000000' + '0'.repeat(PRICE_SCALE - 12)) }
      assert.ok(result.v.eq(expectedResult.v))
      it('3', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('2')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('3')) }
        const amount: BN = new BN('5')

        const result = getNextPriceYDown(price, liquidity, amount, true)
        const expectedResult: Decimal = {
          v: new BN('3666666666666' + '6'.repeat(PRICE_SCALE - 12))
        }
        assert.ok(result.v.eq(expectedResult.v))
      })
      it('4', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('24234')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('3000')) }
        const amount: BN = new BN('5000')

        const result = getNextPriceYDown(price, liquidity, amount, true)
        const expectedResult: Decimal = {
          v: new BN('24235666666666666' + '6'.repeat(PRICE_SCALE - 12))
        }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
    describe('subtract', () => {
      it('1', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('2')) }
        const amount: BN = new BN('1')

        const result = getNextPriceYDown(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('500000000000' + '0'.repeat(PRICE_SCALE - 12)) }
        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('100000')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('500000000')) }
        const amount: BN = new BN('4000')

        const result = getNextPriceYDown(price, liquidity, amount, false)
        const expectedResult: Decimal = {
          v: new BN('99999999992000000' + '0'.repeat(PRICE_SCALE - 12))
        }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('3', async () => {
        const price: Decimal = { v: PRICE_DENOMINATOR.mul(new BN('3')) }
        const liquidity: Decimal = { v: LIQUIDITY_DENOMINATOR.mul(new BN('222')) }
        const amount: BN = new BN('37')

        const result = getNextPriceYDown(price, liquidity, amount, false)
        const expectedResult: Decimal = {
          v: new BN('2833333333333' + '3'.repeat(PRICE_SCALE - 12))
        }
        assert.ok(result.v.eq(expectedResult.v))
      })
    })
  })
  describe('test getSearchLimit', () => {
    it('Simple up', async () => {
      const limit = getSearchLimit(new BN(0), new BN(1), true)
      assert.ok(limit.eq(new BN(TICK_SEARCH_RANGE)))
    })
    it('Simple down', async () => {
      const limit = getSearchLimit(new BN(0), new BN(1), false)
      assert.ok(limit.eq(new BN(-TICK_SEARCH_RANGE)))
    })
    it('Less simple up', async () => {
      const start = new BN(60)
      const step = new BN(12)
      const limit = getSearchLimit(start, step, true)
      const expected = new BN(TICK_SEARCH_RANGE).mul(step).add(start)
      assert.ok(limit.eq(expected))
    })
    it('Less simple down', async () => {
      const start = new BN(60)
      const step = new BN(12)
      const limit = getSearchLimit(start, step, false)
      const expected = new BN(-TICK_SEARCH_RANGE).mul(step).add(start)
      assert.ok(limit.eq(expected))
    })
    it('Up to array limit', async () => {
      const step = new BN(2)
      const limit = getSearchLimit(step.mul(new BN(TICK_LIMIT)).subn(10), step, true)
      const expected = step.mul(new BN(TICK_LIMIT - 1))
      assert.ok(limit.eq(expected))
    })
    it('Down to array limit', async () => {
      const step = new BN(2)
      const limit = getSearchLimit(step.mul(new BN(-TICK_LIMIT + 1)), step, false)
      const expected = step.mul(new BN(-(TICK_LIMIT - 1)))
      assert.ok(limit.eq(expected))
    })
    it('Up to price limit', async () => {
      const step = new BN(5)
      const limit = getSearchLimit(new BN(MAX_TICK - 22), step, true)
      const expected = new BN(MAX_TICK - 3)
      assert.ok(limit.eq(expected))
    })
    it('At the price limit', async () => {
      const step = new BN(5)
      const limit = getSearchLimit(new BN(MAX_TICK - 3), step, true)
      const expected = new BN(MAX_TICK - 3)
      assert.ok(limit.eq(expected))
    })
  })
  describe('test getCloserLimit', () => {
    it('tick limit closer', async () => {
      // let tickmap: Tickmap2 = new Tickmap2(25000)
      // await tickmap.flip(true, new BN(0), new BN(1))
      const tickmap: Tickmap = { bitmap: new Array(25000).map(i => (i = 0)) }
      const { byte, bit } = tickToPosition(new BN(0), new BN(1))
      tickmap.bitmap[byte] ^= 1 << bit

      const closerLimit: CloserLimit = {
        sqrtPriceLimit: { v: new BN(5).mul(PRICE_DENOMINATOR) },
        xToY: true,
        currentTick: 100,
        tickSpacing: 1,
        tickmap: tickmap
      }
      const expected = { v: new BN(5).mul(PRICE_DENOMINATOR) }
      const { swapLimit, limitingTick } = getCloserLimit(closerLimit)
      assert.ok(swapLimit.v.eq(expected.v))
      assert.equal(limitingTick, null)
    })
    it('trade limit closer', async () => {
      // let tickmap: Tickmap2 = new Tickmap2(25000)
      // await tickmap.flip(true, new BN(0), new BN(1))

      const tickmap: Tickmap = { bitmap: new Array(25000).map(i => (i = 0)) }
      const { byte, bit } = tickToPosition(new BN(0), new BN(1))
      tickmap.bitmap[byte] ^= 1 << bit

      const closerLimit: CloserLimit = {
        sqrtPriceLimit: { v: new BN(5).mul(new BN(10).pow(new BN(23))) },
        xToY: true,
        currentTick: 100,
        tickSpacing: 1,
        tickmap: tickmap
      }

      const { swapLimit, limitingTick } = getCloserLimit(closerLimit)

      const expected = { v: new BN(1).mul(PRICE_DENOMINATOR) }

      assert.ok(swapLimit.v.eq(expected.v))
      assert.equal(limitingTick?.index, 0)
      assert.equal(limitingTick?.initialized, true)
    })
    it('other direction', async () => {
      const tickmap: Tickmap = { bitmap: new Array(25000).map(i => (i = 0)) }
      const { byte, bit } = tickToPosition(new BN(0), new BN(1))
      tickmap.bitmap[byte] ^= 1 << bit

      // let tickmap: Tickmap2 = new Tickmap2(25000)
      // await tickmap.flip(true, new BN(0), new BN(1))
      const closerLimit: CloserLimit = {
        sqrtPriceLimit: { v: new BN(2).mul(PRICE_DENOMINATOR) },
        xToY: false,
        currentTick: -5,
        tickSpacing: 1,
        tickmap: tickmap
      }

      const { swapLimit, limitingTick } = getCloserLimit(closerLimit)

      const expected = { v: new BN(1).mul(PRICE_DENOMINATOR) }

      assert.ok(swapLimit.v.eq(expected.v))
      assert.equal(limitingTick?.index, 0)
      assert.equal(limitingTick?.initialized, true)
    })
    it('other direction', async () => {
      // let tickmap: Tickmap2 = new Tickmap2(25000)
      // await tickmap.flip(true, new BN(0), new BN(1))

      const tickmap: Tickmap = { bitmap: new Array(25000).map(i => (i = 0)) }
      const { byte, bit } = tickToPosition(new BN(0), new BN(1))
      tickmap.bitmap[byte] ^= 1 << bit

      const closerLimit: CloserLimit = {
        sqrtPriceLimit: { v: new BN(1).mul(new BN(10).pow(new BN(23))) },
        xToY: false,
        currentTick: -100,
        tickSpacing: 10,
        tickmap: tickmap
      }

      const { swapLimit, limitingTick } = getCloserLimit(closerLimit)

      const expected = { v: new BN(1).mul(new BN(10).pow(new BN(23))) }

      assert.ok(swapLimit.v.eq(expected.v))
      assert.equal(limitingTick, null)
    })
  })
  describe('test calculateFeeGrowthInside', () => {
    const feeGrowthGlobalX = { v: new BN(15).mul(GROWTH_DENOMINATOR) }
    const feeGrowthGlobalY = { v: new BN(15).mul(GROWTH_DENOMINATOR) }

    const lowerTick: Tick = {
      pool: Keypair.generate().publicKey,
      index: -2,
      sign: true,
      liquidityChange: { v: new BN(0) },
      liquidityGross: { v: new BN(0) },
      sqrtPrice: { v: new BN(0) },
      feeGrowthOutsideX: { v: new BN(0) },
      feeGrowthOutsideY: { v: new BN(0) },
      secondsPerLiquidityOutside: { v: new BN(0) },
      bump: 0
    }
    const upperTick: Tick = {
      pool: Keypair.generate().publicKey,
      index: 2,
      sign: true,
      liquidityChange: { v: new BN(0) },
      liquidityGross: { v: new BN(0) },
      sqrtPrice: { v: new BN(0) },
      feeGrowthOutsideX: { v: new BN(0) },
      feeGrowthOutsideY: { v: new BN(0) },
      secondsPerLiquidityOutside: { v: new BN(0) },
      bump: 0
    }

    it('Current tick inside range', async () => {
      const feeGrowthParams: FeeGrowthInside = {
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: 0,
        feeGrowthGlobalX: feeGrowthGlobalX,
        feeGrowthGlobalY: feeGrowthGlobalY
      }
      const [tokensOwedXTotal, tokensOwedYTotal] = calculateFeeGrowthInside(feeGrowthParams)

      const expectedX = new BN(15).mul(GROWTH_DENOMINATOR)
      const expectedY = new BN(15).mul(GROWTH_DENOMINATOR)
      assert.ok(tokensOwedXTotal.eq(expectedX))
      assert.ok(tokensOwedYTotal.eq(expectedY))
    })
    it('Current tick below range', async () => {
      const feeGrowthParams: FeeGrowthInside = {
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: -4,
        feeGrowthGlobalX: feeGrowthGlobalX,
        feeGrowthGlobalY: feeGrowthGlobalY
      }
      const [tokensOwedXTotal, tokensOwedYTotal] = calculateFeeGrowthInside(feeGrowthParams)

      assert.ok(tokensOwedXTotal.eq(new BN(0)))
      assert.ok(tokensOwedYTotal.eq(new BN(0)))
    })
    it('Current tick upper range', async () => {
      const feeGrowthParams: FeeGrowthInside = {
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: 4,
        feeGrowthGlobalX: feeGrowthGlobalX,
        feeGrowthGlobalY: feeGrowthGlobalY
      }
      const [tokensOwedXTotal, tokensOwedYTotal] = calculateFeeGrowthInside(feeGrowthParams)

      assert.ok(tokensOwedXTotal.eq(new BN(0)))
      assert.ok(tokensOwedYTotal.eq(new BN(0)))
    })
    it('Subtracts upper tick if below', async () => {
      upperTick.index = 2
      upperTick.feeGrowthOutsideX = { v: new BN(2).mul(GROWTH_DENOMINATOR) }
      upperTick.feeGrowthOutsideY = { v: new BN(3).mul(GROWTH_DENOMINATOR) }

      const feeGrowthParams: FeeGrowthInside = {
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: 0,
        feeGrowthGlobalX: feeGrowthGlobalX,
        feeGrowthGlobalY: feeGrowthGlobalY
      }
      const [feeGrowthInsideX, feeGrowthInsideY] = calculateFeeGrowthInside(feeGrowthParams)

      const expectedX = new BN(13).mul(GROWTH_DENOMINATOR)
      const expectedY = new BN(12).mul(GROWTH_DENOMINATOR)
      assert.ok(feeGrowthInsideX.eq(expectedX))
      assert.ok(feeGrowthInsideY.eq(expectedY))
    })
    it('Subtracts lower tick if above', async () => {
      upperTick.index = 2
      upperTick.feeGrowthOutsideX = { v: new BN(0) }
      upperTick.feeGrowthOutsideY = { v: new BN(0) }

      lowerTick.index = -2
      lowerTick.feeGrowthOutsideX = { v: new BN(2).mul(GROWTH_DENOMINATOR) }
      lowerTick.feeGrowthOutsideY = { v: new BN(3).mul(GROWTH_DENOMINATOR) }

      const feeGrowthParams: FeeGrowthInside = {
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: 0,
        feeGrowthGlobalX: feeGrowthGlobalX,
        feeGrowthGlobalY: feeGrowthGlobalY
      }
      const [feeGrowthInsideX, feeGrowthInsideY] = calculateFeeGrowthInside(feeGrowthParams)

      const expectedX = new BN(13).mul(GROWTH_DENOMINATOR)
      const expectedY = new BN(12).mul(GROWTH_DENOMINATOR)
      assert.ok(feeGrowthInsideX.eq(expectedX))
      assert.ok(feeGrowthInsideY.eq(expectedY))
    })
    it('Test overflow', async () => {
      const feeGrowthGlobalX = { v: new BN(20).mul(GROWTH_DENOMINATOR) }
      const feeGrowthGlobalY = { v: new BN(20).mul(GROWTH_DENOMINATOR) }

      upperTick.index = -20
      upperTick.feeGrowthOutsideX = { v: new BN(15).mul(GROWTH_DENOMINATOR) }
      upperTick.feeGrowthOutsideY = { v: new BN(15).mul(GROWTH_DENOMINATOR) }

      lowerTick.index = -10
      lowerTick.feeGrowthOutsideX = { v: new BN(20).mul(GROWTH_DENOMINATOR) }
      lowerTick.feeGrowthOutsideY = { v: new BN(20).mul(GROWTH_DENOMINATOR) }

      const feeGrowthParams: FeeGrowthInside = {
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: 0,
        feeGrowthGlobalX: feeGrowthGlobalX,
        feeGrowthGlobalY: feeGrowthGlobalY
      }
      const [feeGrowthInsideX, feeGrowthInsideY] = calculateFeeGrowthInside(feeGrowthParams)

      const expectedX = U128MAX.sub(new BN(5).mul(GROWTH_DENOMINATOR)).add(new BN(1))
      const expectedY = U128MAX.sub(new BN(5).mul(GROWTH_DENOMINATOR)).add(new BN(1))

      assert.ok(feeGrowthInsideX.eq(expectedX))
      assert.ok(feeGrowthInsideY.eq(expectedY))
    })
  })
  describe('test calculateTokensOwed', () => {
    it('Zero liquidity zero tokens owed', async () => {
      const positionData: PositionClaimData = {
        liquidity: { v: new BN(0) },
        feeGrowthInsideX: { v: new BN(0) },
        feeGrowthInsideY: { v: new BN(0) },
        tokensOwedX: { v: new BN(0) },
        tokensOwedY: { v: new BN(0) }
      }

      const tokensOwedParams: TokensOwed = {
        position: positionData,
        feeGrowthInsideX: new BN(5).mul(GROWTH_DENOMINATOR),
        feeGrowthInsideY: new BN(5).mul(GROWTH_DENOMINATOR)
      }
      const [tokensOwedXTotal, tokensOwedYTotal] = calculateTokensOwed(tokensOwedParams)
      assert.ok(tokensOwedXTotal.eq(new BN(0)))
      assert.ok(tokensOwedYTotal.eq(new BN(0)))
    })
    it('zero liquidity fee should not change', async () => {
      const positionData: PositionClaimData = {
        liquidity: { v: new BN(0) },
        feeGrowthInsideX: { v: new BN(4).mul(GROWTH_DENOMINATOR) },
        feeGrowthInsideY: { v: new BN(4).mul(GROWTH_DENOMINATOR) },
        tokensOwedX: { v: new BN(100).mul(DENOMINATOR) },
        tokensOwedY: { v: new BN(100).mul(DENOMINATOR) }
      }

      const tokensOwedParams: TokensOwed = {
        position: positionData,
        feeGrowthInsideX: new BN(5).mul(GROWTH_DENOMINATOR),
        feeGrowthInsideY: new BN(5).mul(GROWTH_DENOMINATOR)
      }
      const [tokensOwedXTotal, tokensOwedYTotal] = calculateTokensOwed(tokensOwedParams)
      assert.ok(tokensOwedXTotal.eq(new BN(100)))
      assert.ok(tokensOwedYTotal.eq(new BN(100)))
    })
    it('fee should change', async () => {
      const positionData: PositionClaimData = {
        liquidity: { v: LIQUIDITY_DENOMINATOR },
        feeGrowthInsideX: { v: new BN(4).mul(GROWTH_DENOMINATOR) },
        feeGrowthInsideY: { v: new BN(4).mul(GROWTH_DENOMINATOR) },
        tokensOwedX: { v: new BN(100).mul(DENOMINATOR) },
        tokensOwedY: { v: new BN(100).mul(DENOMINATOR) }
      }

      const tokensOwedParams: TokensOwed = {
        position: positionData,
        feeGrowthInsideX: new BN(5).mul(GROWTH_DENOMINATOR),
        feeGrowthInsideY: new BN(5).mul(GROWTH_DENOMINATOR)
      }
      const [tokensOwedXTotal, tokensOwedYTotal] = calculateTokensOwed(tokensOwedParams)
      assert.ok(tokensOwedXTotal.eq(new BN(101)))
      assert.ok(tokensOwedYTotal.eq(new BN(101)))
    })
  })
  describe('test calculateClaimAmount', () => {
    it('Basic claim', async () => {
      const positionData: PositionClaimData = {
        liquidity: { v: new BN(1).mul(LIQUIDITY_DENOMINATOR) },
        feeGrowthInsideX: { v: new BN(4).mul(GROWTH_DENOMINATOR) },
        feeGrowthInsideY: { v: new BN(4).mul(GROWTH_DENOMINATOR) },
        tokensOwedX: { v: new BN(100).mul(DENOMINATOR) },
        tokensOwedY: { v: new BN(100).mul(DENOMINATOR) }
      }

      const lowerTick: Tick = {
        pool: Keypair.generate().publicKey,
        index: -2,
        sign: true,
        liquidityChange: { v: new BN(0) },
        liquidityGross: { v: new BN(0) },
        sqrtPrice: { v: new BN(0) },
        feeGrowthOutsideX: { v: new BN(0) },
        feeGrowthOutsideY: { v: new BN(0) },
        secondsPerLiquidityOutside: { v: new BN(0) },

        bump: 0
      }
      const upperTick: Tick = {
        pool: Keypair.generate().publicKey,
        index: 2,
        sign: true,
        liquidityChange: { v: new BN(0) },
        liquidityGross: { v: new BN(0) },
        sqrtPrice: { v: new BN(0) },
        feeGrowthOutsideX: { v: new BN(0) },
        feeGrowthOutsideY: { v: new BN(0) },
        secondsPerLiquidityOutside: { v: new BN(0) },

        bump: 0
      }

      const claim: SimulateClaim = {
        position: positionData,
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: 0,
        feeGrowthGlobalX: { v: new BN(20).mul(GROWTH_DENOMINATOR) },
        feeGrowthGlobalY: { v: new BN(20).mul(GROWTH_DENOMINATOR) }
      }

      const [tokensOwedXTotal, tokensOwedYTotal] = calculateClaimAmount(claim)
      assert.ok(tokensOwedXTotal.eq(new BN(116)))
      assert.ok(tokensOwedYTotal.eq(new BN(116)))
    })
    it('External data', async () => {
      const positionData: PositionClaimData = {
        liquidity: { v: new BN('1479A26FE2A3C0', 'hex') },
        feeGrowthInsideX: { v: new BN('ffffffffffffffffffc8ee8de34d553d', 'hex') },
        feeGrowthInsideY: { v: new BN('ffffffffffffffffffd3fd7d514848b6', 'hex') },
        tokensOwedX: { v: new BN(0) },
        tokensOwedY: { v: new BN(0) }
      }

      const lowerTick: Tick = {
        pool: Keypair.generate().publicKey,
        index: 21109,
        sign: true,
        liquidityChange: { v: new BN('B9C6974437BF7F6B', 'hex') },
        liquidityGross: { v: new BN('B9C6974437BF7F6B', 'hex') },
        sqrtPrice: { v: new BN('029cf3124f61', 'hex') },
        feeGrowthOutsideX: { v: new BN('0c4fee04dd2b3b8c', 'hex') },
        feeGrowthOutsideY: { v: new BN('01a99cb6b2bd6911e7', 'hex') },
        secondsPerLiquidityOutside: { v: new BN(0) },

        bump: 0
      }
      const upperTick: Tick = {
        pool: Keypair.generate().publicKey,
        index: 21129,
        sign: false,
        liquidityChange: { v: new BN('A780979938ACD0B8', 'hex') },
        liquidityGross: { v: new BN('C2B41DADE9987A38', 'hex') },
        sqrtPrice: { v: new BN('029d9e665157', 'hex') },
        feeGrowthOutsideX: { v: new BN('3b9f3a68b9c225', 'hex') },
        feeGrowthOutsideY: { v: new BN('2c0282aeb7b74a', 'hex') },
        secondsPerLiquidityOutside: { v: new BN(0) },

        bump: 0
      }

      const claim: SimulateClaim = {
        position: positionData,
        tickLower: lowerTick,
        tickUpper: upperTick,
        tickCurrent: 0,
        feeGrowthGlobalX: { v: new BN(20).mul(GROWTH_DENOMINATOR) },
        feeGrowthGlobalY: { v: new BN(20).mul(GROWTH_DENOMINATOR) }
      }

      const [tokensOwedXTotal, tokensOwedYTotal] = calculateClaimAmount(claim)
      assert.ok(tokensOwedXTotal.eq(new BN(5105)))
      assert.ok(tokensOwedYTotal.eq(new BN(176750)))
    })
  })
  describe('test calculatePriceImpact', () => {
    it('increasing price', () => {
      // price change       120 -> 599
      // real price impact  79.96661101836...%
      const startingSqrtPrice = new BN('10954451150103322269139395')
      const endingSqrtPrice = new BN('24474476501040834315678144')
      const priceImpact = calculatePriceImpact(startingSqrtPrice, endingSqrtPrice)
      assert.ok(priceImpact.eq(new BN('799666110184')))
    })
    it('decreasing price', () => {
      // price change       0.367-> 1.0001^(-221818)
      // real price impact  99.9999999365... %
      const startingSqrtPrice = new BN('605805249234438377196232')
      const endingSqrtPrice = new BN('15258932449895975601')
      const priceImpact = calculatePriceImpact(startingSqrtPrice, endingSqrtPrice)
      assert.ok(priceImpact.eq(new BN('999999999366')))
    })
  })
  describe('test minReceivedTokensByAmountIn', () => {
    describe('x to y', () => {
      const xToY = true
      const fee = new BN(DENOMINATOR).divn(10000) // 0.01%

      it('price > 1', () => {
        const targetPrice = new BN('12' + '0'.repeat(PRICE_SCALE - 1))
        const targetSqrtPrice = sqrt(targetPrice.mul(PRICE_DENOMINATOR))
        const amountIn = new BN(999)
        const minReceivedTokens = calculateMinReceivedTokensByAmountIn(
          targetSqrtPrice,
          xToY,
          amountIn,
          fee
        )
        assert.ok(minReceivedTokens.eq(new BN(1197)))
      })
      it('price < 1', () => {
        const targetPrice = new BN('94' + '0'.repeat(PRICE_SCALE - 5))
        const targetSqrtPrice = sqrt(targetPrice.mul(PRICE_DENOMINATOR))
        const amountIn = new BN(1200000000)
        const minReceivedTokens = calculateMinReceivedTokensByAmountIn(
          targetSqrtPrice,
          xToY,
          amountIn,
          fee
        )
        assert.ok(minReceivedTokens.eq(new BN(1127886)))
      })
    })
    describe('y to x', () => {
      const xToY = false
      const fee = new BN(DENOMINATOR).divn(2000) // 0.05%

      it('price > 1', () => {
        const targetPrice = new BN('99' + '0'.repeat(PRICE_SCALE - 1))
        const targetSqrtPrice = sqrt(targetPrice.mul(PRICE_DENOMINATOR))
        const amountIn = new BN(20000)
        const minReceivedTokens = calculateMinReceivedTokensByAmountIn(
          targetSqrtPrice,
          xToY,
          amountIn,
          fee
        )
        assert.ok(minReceivedTokens.eq(new BN(2018)))
      })
      it('price < 1', () => {
        const targetPrice = new BN('17' + '0'.repeat(PRICE_SCALE - 6))
        const targetSqrtPrice = sqrt(targetPrice.mul(PRICE_DENOMINATOR))
        const amountIn = new BN(4000)
        const minReceivedTokens = calculateMinReceivedTokensByAmountIn(
          targetSqrtPrice,
          xToY,
          amountIn,
          fee
        )
        assert.ok(minReceivedTokens.eq(new BN(235176469)))
      })
    })
  })
  describe('test simulateSwap', () => {
    it('Swap', async () => {
      const simulationResult: SimulationResult = simulateSwap(swapParameters)
      assert.ok(simulationResult.accumulatedAmountIn.eq(new BN(994)))
      assert.ok(simulationResult.accumulatedAmountOut.eq(new BN(993)))
      assert.ok(simulationResult.accumulatedFee.eq(new BN(6)))
      assert.ok(simulationResult.amountPerTick[0].eq(new BN(1000)))
      assert.equal(simulationResult.crossedTicks.length, 0)
      assert.ok(simulationResult.priceAfterSwap.eq(new BN('999006987054867461743028')))
      assert.ok(simulationResult.priceImpact.eq(new BN(1985039816)))
      assert.ok(simulationResult.minReceived.eq(new BN(886)))
    })
  })
  describe('test isEnoughAmountToPushPrice', () => {
    const currentPriceSqrt = calculatePriceSqrt(-20)
    const liquidity = { v: new BN('20006000000000000000') }
    const fee = toDecimal(6, 4)

    it('-20 crossing tick with 1 token amount by amount in', async () => {
      const amount = new BN('1')
      const byAmountIn = true
      const xToY = true

      const isEnoughAmountToCross = isEnoughAmountToPushPrice(
        amount,
        currentPriceSqrt,
        liquidity,
        fee,
        byAmountIn,
        xToY
      )
      assert.equal(isEnoughAmountToCross, false)
    })
    it('-20 crossing tick with 1 token amount by amount out', async () => {
      const amount = new BN(1)
      const byAmountIn = false
      const xToY = true

      const isEnoughAmountToCross = isEnoughAmountToPushPrice(
        amount,
        currentPriceSqrt,
        liquidity,
        fee,
        byAmountIn,
        xToY
      )
      assert.equal(isEnoughAmountToCross, true)
    })
    it('-20 crossing tick with 2 token amount by amount in', async () => {
      const amount = new BN(2)
      const byAmountIn = true
      const xToY = true

      const isEnoughAmountToCross = isEnoughAmountToPushPrice(
        amount,
        currentPriceSqrt,
        liquidity,
        fee,
        byAmountIn,
        xToY
      )
      assert.equal(isEnoughAmountToCross, true)
    })
    it('should always be enough amount to cross tick when pool liquidity is zero', async () => {
      const noLiquidity = { v: new BN('0') }
      const amount = new BN(1)
      const byAmountIn = false
      const xToY = true

      const isEnoughAmountToCross = isEnoughAmountToPushPrice(
        amount,
        currentPriceSqrt,
        noLiquidity,
        fee,
        byAmountIn,
        xToY
      )
      assert.equal(isEnoughAmountToCross, true)
    })
  })
  describe('test getTickFromPrice', () => {
    const tickSpacing = 1
    describe('around 0 tick', () => {
      it('get tick at 1', async () => {
        const sqrtPriceDecimal = { v: new BN(PRICE_DENOMINATOR) }
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, 0)
      })
      it('get tick slightly below 1', async () => {
        const sqrtPriceDecimal = { v: new BN(PRICE_DENOMINATOR.subn(1)) }
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, -1)
      })
      it('get tick slightly above 1', async () => {
        const sqrtPriceDecimal = { v: new BN(PRICE_DENOMINATOR.addn(1)) }
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, 0)
      })
    })
    describe('around 1 tick', () => {
      const sqrtPriceDecimal = calculatePriceSqrt(1)
      const tickSpacing = 1
      it('get tick at sqrt(1.0001)', async () => {
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, 1)
      })
      it('get tick slightly below sqrt(1.0001)', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.subn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, 0)
      })
      it('get tick slightly above sqrt(1.0001)', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.addn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, 1)
      })
    })
    describe('around -1 tick', () => {
      const sqrtPriceDecimal = calculatePriceSqrt(-1)
      const tickSpacing = 1
      it('get tick at sqrt(1.0001^(-1))', async () => {
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, -1)
      })
      it('get tick slightly below sqrt(1.0001^(-1))', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.subn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, -2)
      })
      it('get tick slightly above sqrt(1.0001^(-1))', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.addn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, -1)
      })
    })
    describe('around max - 1 tick', () => {
      const sqrtPriceDecimal = calculatePriceSqrt(MAX_TICK - 1)
      const tickSpacing = 1
      it('get tick at sqrt(1.0001^(MAX_TICK - 1))', async () => {
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, MAX_TICK - 1)
      })
      it('get tick slightly below sqrt(1.0001^(MAX_TICK - 1))', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.subn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, MAX_TICK - 2)
      })
      it('get tick slightly above sqrt(1.0001^(MAX_TICK - 1))', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.addn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, MAX_TICK - 1)
      })
    })
    describe('around min + 1 tick', () => {
      const sqrtPriceDecimal = calculatePriceSqrt(MIN_TICK + 1)
      const tickSpacing = 1
      it('get tick at sqrt(1.0001^(-MAX_TICK + 1))', async () => {
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, MIN_TICK + 1)
      })
      it('get tick slightly below sqrt(1.0001^(-MAX_TICK + 1))', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.subn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, MIN_TICK)
      })
      it('get tick slightly above sqrt(1.0001^(-MAX_TICK + 1))', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.addn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, MIN_TICK + 1)
      })
    })
    describe('get tick slightly below and above', () => {
      const maxSqrtPrice = calculatePriceSqrt(MAX_TICK)
      const minSqrtPrice = calculatePriceSqrt(MIN_TICK)

      const tickSpacing = 1
      it('below', async () => {
        const tick = priceToTickInRange(
          { v: maxSqrtPrice.v.subn(1) },
          -MAX_TICK,
          MAX_TICK + 1,
          tickSpacing
        )
        assert.equal(tick, MAX_TICK - 1)
      })
      it('above', async () => {
        const tick = priceToTickInRange(
          { v: minSqrtPrice.v.addn(1) },
          -MAX_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, MIN_TICK)
      })
    })
    describe('around 19_999 tick', () => {
      const tickSpacing = 1
      const expectedTick = 19_999
      const sqrtPriceDecimal = calculatePriceSqrt(expectedTick)

      it('get tick at sqrt(1.0001^19_999)', async () => {
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, expectedTick)
      })
      it('get tick slightly below sqrt(1.0001^19_999)', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.subn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, expectedTick - 1)
      })
      it('get tick slightly above sqrt(1.0001^19_999)', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.addn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, expectedTick)
      })
    })
    describe('around -19_999 tick', () => {
      const tickSpacing = 1
      const expectedTick = -19_999
      const sqrtPriceDecimal = calculatePriceSqrt(expectedTick)

      it('get tick at sqrt(1.0001^-19_999)', async () => {
        const tick = priceToTickInRange(sqrtPriceDecimal, MIN_TICK, MAX_TICK, tickSpacing)
        assert.equal(tick, expectedTick)
      })
      it('get tick slightly below sqrt(1.0001^-19_999)', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.subn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )
        assert.equal(tick, expectedTick - 1)
      })
      it('get tick slightly above sqrt(1.0001^-19_999)', async () => {
        const tick = priceToTickInRange(
          { v: sqrtPriceDecimal.v.addn(1) },
          MIN_TICK,
          MAX_TICK,
          tickSpacing
        )

        assert.equal(tick, expectedTick)
      })
    })
  })
  describe('test calculateConcentration', () => {
    it('max concentration', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const expectedResult = 1000.5348136431164

      const result = calculateConcentration(tickSpacing, maxConcentration, 0)
      assert.equal(result, expectedResult)
    })
    it('max concentration -1', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const expectedResult = 833.8623739844425

      const result = calculateConcentration(tickSpacing, maxConcentration, 1)
      assert.equal(result, expectedResult)
    })
    it('n = 1000', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const expectedResult = 5.492027214522115

      const result = calculateConcentration(tickSpacing, maxConcentration, 1000)
      assert.equal(result, expectedResult)
    })
  })
  describe('test test calculateTickDelta', () => {
    it('max concentration', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const concentration = 1000.5348136431164
      const expectedResult = 0

      const result = calculateTickDelta(tickSpacing, maxConcentration, concentration)
      assert.equal(result, expectedResult)
    })
    it('max concentration -1', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const concentration = 833.8623739844425
      const expectedResult = 1

      const result = calculateTickDelta(tickSpacing, maxConcentration, concentration)
      assert.equal(result, expectedResult)
    })
    it('n = 1000', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const concentration = 5.492027214522115
      const expectedResult = 1000

      const result = calculateTickDelta(tickSpacing, maxConcentration, concentration)
      assert.equal(result, expectedResult)
    })
  })

  describe('test getConcentrationArray', () => {
    it('high current tick ', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const expectedResult = 11

      const result = getConcentrationArray(tickSpacing, maxConcentration, 221752)

      assert.equal(result.length, expectedResult)
    })
    it('middle current tick ', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const expectedResult = 124

      const result = getConcentrationArray(tickSpacing, maxConcentration, 221300)
      assert.equal(result.length, expectedResult)
    })
    it('low current tick ', async () => {
      const tickSpacing = 4
      const maxConcentration = 10
      const expectedResult = 137

      const result = getConcentrationArray(tickSpacing, maxConcentration, 0)
      assert.equal(result.length, expectedResult)
    })
  })
  describe('dailyFactorPool tests', () => {
    it('case 1', async () => {
      const volume = 125000
      const tokenXamount = new BN(1000000)
      const feeTier = FEE_TIERS[7] // 0.3%

      const result = dailyFactorPool(tokenXamount, volume, feeTier)
      assert.equal(result, 0.00037125)
    })
  })
  describe('dailyFactorReward tests', () => {
    it('case 1', async () => {
      const reward = 100
      const tokenXAmount = new BN(1000_000000)
      const duration = 10
      const price = 1.3425
      const tokenDecimal = 6

      const result = dailyFactorRewards(reward, tokenXAmount, price, tokenDecimal, duration)
      assert.equal(result, 0.0074487895716946)
    })
  })
  describe('getVolume tests', () => {
    it('case 1', async () => {
      const previousSqrtPrice = calculatePriceSqrt(-500)
      const currentSqrtPrice = calculatePriceSqrt(500)
      const volume = getVolume(100_000000, 80_000000, previousSqrtPrice, currentSqrtPrice)
      assert.equal(volume, 180_000000)
    })
  })
  describe('pool APY tests', () => {
    it('case 1', async () => {
      const previous = createTickArray(1000)
      const activeTokens = new BN('12831423759')

      const current: Tick[] = previous.map(tick => ({
        ...tick,
        liquidityChange: {
          v: tick.liquidityChange.v.add(new BN(10000000).mul(LIQUIDITY_DENOMINATOR))
        },
        feeGrowthOutsideX: { v: tick.feeGrowthOutsideX.v.add(new BN(10)) }
      }))
      const weeklyData: WeeklyData = {
        weeklyFactor: [0.001, 0.002, 0.003, 0.004, 0.003, 0.002, 0.001],
        weeklyRange: [
          { tickLower: -800, tickUpper: 1000 },
          { tickLower: -700, tickUpper: 2000 },
          { tickLower: -600, tickUpper: 3000 },
          { tickLower: -500, tickUpper: 4000 },
          { tickLower: -600, tickUpper: 3000 },
          { tickLower: -700, tickUpper: 2000 },
          { tickLower: -800, tickUpper: 1000 }
        ],
        tokenXamount: new BN(0),
        volumeX: 0,
        apy: 0.037125
      }

      const paramsApy: ApyPoolParams = {
        feeTier: FEE_TIERS[3],
        currentTickIndex: 0,
        activeTokens,
        ticksPreviousSnapshot: previous,
        ticksCurrentSnapshot: current,
        weeklyData,
        volumeX: 50_000000,
        volumeY: 50_000000
      }
      // dailyFactor = [0.002, 0.003, 0.004, 0.003, 0.002, 0.001, 0.0000217622417796679]
      // avg(dailyFactor) = 0.002145966...
      // APY = 118.679796944...
      const poolApy = poolAPY(paramsApy)
      assert.ok(poolApy.apy > 118 && poolApy.apy < 119)
      assert.ok(poolApy.weeklyRange.length === 7)
      assert.ok(poolApy.weeklyRange[0].tickLower === -700)
      assert.ok(poolApy.weeklyRange[0].tickUpper === 2000)
    })
  })
  describe('reward APY tests', () => {
    const liquidity = new BN('1326751756584093466941')
    const tickSpacing = 1
    it('ticks from current snapshot', async () => {
      const paramsApy: ApyRewardsParams = {
        currentTickIndex: 45,
        currentLiquidity: liquidity,
        allLiquidityInTokens: new BN(79372943242),
        tickSpacing, // 1
        rewardInUsd: 1100,
        tokenPrice: 0.9995,
        tokenDecimal: 6,
        duration: 14
      }

      const reward = rewardsAPY(paramsApy)

      assert.equal(reward.apy, 0.4347050575407594)
      assert.equal(reward.apySingleTick, 0.5422869905571346)
    })
    it('zero liqudity', async () => {
      const paramsApy: ApyRewardsParams = {
        currentTickIndex: 0,
        currentLiquidity: new BN(0),
        allLiquidityInTokens: new BN(0),
        tickSpacing, //1
        rewardInUsd: 100,
        tokenPrice: 0.9995,
        tokenDecimal: 6,
        duration: 10
      }

      const reward = rewardsAPY(paramsApy)
      assert.equal(reward.apy, Infinity)
      assert.equal(reward.apySingleTick, Infinity)
    })
  })
  describe('position reward APY tests', () => {
    const poolLiquidity = new BN('232145105223137352120')
    const tickLower = 4
    const tickUpper = 5
    it('active position 20% of liquidity', async () => {
      const paramsApy: ApyPositionRewardsParams = {
        poolLiquidity,
        currentTickIndex: usdcUsdhPoolSnapshot.currentTickIndex,
        rewardInUsd: 1000,
        tokenPrice: 0.9995,
        tokenDecimal: 6,
        duration: 10,
        positionLiquidity: { v: poolLiquidity.divn(5) },
        lowerTickIndex: tickLower,
        upperTickIndex: tickUpper
      }

      const apy = positionsRewardAPY(paramsApy)
      assert.equal(apy, 21.980063906676584)
    })
    it('zero liquidity', async () => {
      const paramsApy: ApyPositionRewardsParams = {
        poolLiquidity: new BN(0),
        currentTickIndex: usdcUsdhPoolSnapshot.currentTickIndex,
        rewardInUsd: 3000,
        tokenPrice: 0.9995,
        tokenDecimal: 6,
        duration: 14,
        positionLiquidity: { v: new BN(1) },
        lowerTickIndex: tickLower,
        upperTickIndex: tickUpper
      }

      const apy = positionsRewardAPY(paramsApy)
      assert.equal(apy, Infinity)
    })
  })
  describe('calculate user daily rewards tests', () => {
    const poolLiquidity = new BN('232145105223137352120')
    it('active position 20% of liquidity', async () => {
      const tickLower = 4
      const tickUpper = 5

      const paramsApy: UserDailyRewardsParams = {
        poolLiquidity,
        currentTickIndex: usdcUsdhPoolSnapshot.currentTickIndex,
        rewardInTokens: 10000,
        userLiquidity: { v: poolLiquidity.divn(5) },
        duration: 10,
        lowerTickIndex: tickLower,
        upperTickIndex: tickUpper
      }

      const dailyRewards = calculateUserDailyRewards(paramsApy)
      //10000 tokens / 10 days * 20% of liquidity = 200 tokens
      assert.equal(dailyRewards, 200)
    })
    it('inactive position', async () => {
      const tickLower = 100
      const tickUpper = 110

      const paramsApy: UserDailyRewardsParams = {
        poolLiquidity,
        currentTickIndex: usdcUsdhPoolSnapshot.currentTickIndex,
        rewardInTokens: 10000,
        userLiquidity: { v: poolLiquidity.divn(5) },
        duration: 10,
        lowerTickIndex: tickLower,
        upperTickIndex: tickUpper
      }

      const dailyRewards = calculateUserDailyRewards(paramsApy)
      // position is inactive should return 0
      assert.equal(dailyRewards, 0)
    })
  })
  describe('test getTokenData', () => {
    it('check ticker and decimals', async () => {
      const tokenData = await getTokensData()
      const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      const token: TokenData = tokenData[usdc]
      assert.equal(token.ticker, 'USDC')
      assert.equal(token.decimals, 6)
      assert.equal(token.id, 'usd-coin')
    })
  })
})
