import { assert } from 'chai'
import { BN } from '@project-serum/anchor'
import {
  calculatePriceSqrt,
  DENOMINATOR,
  TICK_LIMIT,
  TICK_SEARCH_RANGE,
  MAX_TICK
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
  findClosestTicks
} from '@invariant-labs/sdk/src/math'
import {
  bigNumberToBuffer,
  calculateClaimAmount,
  calculateFeeGrowthInside,
  calculateTokensOwed,
  CloserLimit,
  FeeGrowthInside,
  getCloserLimit,
  GROWTH_DENOMINATOR,
  PositionClaimData,
  PRICE_DENOMINATOR,
  PRICE_SCALE,
  SimulateClaim,
  simulateSwap,
  SimulationResult,
  toDecimal,
  TokensOwed,
  U128MAX
} from '@invariant-labs/sdk/src/utils'
import { setInitialized } from './testUtils'
import { Decimal, Tick, Tickmap } from '@invariant-labs/sdk/src/market'
import { getSearchLimit, tickToPosition } from '@invariant-labs/sdk/src/tickmap'
import { Keypair } from '@solana/web3.js'
import { swapParameters } from './swap'

describe('Math', () => {
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
      const expectedL = { v: new BN('432392997000000000000000000000000') }
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
      console.log('###', roundUpLiquidity.v.toString())
      assert.ok(roundUpLiquidity.v.eq(expectedL.v))
      assert.ok(roundDownLiquidity.v.eq(expectedL.v))
      assert.ok(expectedRoundUpY.eq(roundUpY))
      assert.ok(expectedRoundDownY.eq(roundDownY))
    })
    it('above current tick', async () => {
      // rust results:
      const expectedL = { v: new BN('13548826311623850731629898846119') }
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
      const expectedL = { v: new BN('2789052279103923275993666509928764493') }

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
      const expectedL = { v: new BN('584945290554346935615679081218681355') }
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
  describe('calculate slippage', () => {
    it('no slippage up', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(0)

      const expected = 1e12

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('no slippage down', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(0)

      const expected = 1e12

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 1% up', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(1, 2)

      const expected = 1009999999999

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 1% down', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(1, 2)

      const expected = 989999999998

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,5% up', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(5, 3)

      const expected = 1004999999999

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,5% down', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(5, 3)

      const expected = 994999999999

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,00001% up', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(3, 7)

      const expected = 1000000299998

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 0,00001% down', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(3, 7)

      const expected = 999999699998

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 100% up', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(1)

      const expected = 1999999999999

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, true)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

      assert.equal(limit.toString(), expected.toString())
    })

    it('slippage of 100% down', async () => {
      const price = toDecimal(1)
      const slippage = toDecimal(1)

      const expected = 0

      const limitSqrt = calculatePriceAfterSlippage(price, slippage, false)
      const limit = limitSqrt.v.mul(limitSqrt.v).div(DENOMINATOR)

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
    const liquidity = new BN(2000).mul(DENOMINATOR)
    const lowerTick = 60
    const upperTick = 120

    it('current < lower', async () => {
      const currentTick = 50

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const x = getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(x.eq(new BN(5972765607079)))
    })

    it('lower < current < upper', async () => {
      const currentTick = 80

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const x = getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(x.eq(new BN(3979852584359)))
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
  })

  describe('calculate y having liquidity and price', () => {
    const liquidity = new BN(2000).mul(DENOMINATOR)
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
      assert.ok(y.eq(new BN(2006911652000)))
    })

    it('lowerSqrtPrice > currentSqrtPrice', async () => {
      const currentTick = 130

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const y = getY(liquidity, upperSqrtPrice.v, currentSqrtPrice.v, lowerSqrtPrice.v)
      assert.ok(y.eq(new BN(6026760410000)))
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
      const price: Decimal = { v: DENOMINATOR }
      const target: Decimal = {
        v: sqrt(DENOMINATOR.mul(new BN('101')).div(new BN('100')).mul(DENOMINATOR))
      }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2000')) }
      const amount: BN = new BN('1')
      const fee = toDecimal(6, 4)

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
      const price: Decimal = { v: DENOMINATOR }
      const target: Decimal = {
        v: sqrt(DENOMINATOR.mul(new BN('101')).div(new BN('100')).mul(DENOMINATOR))
      }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2000')) }
      const amount: BN = new BN('20')
      const fee = toDecimal(6, 4)

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
      const price: Decimal = { v: DENOMINATOR.mul(new BN('101')).div(new BN('100')) }
      const target: Decimal = { v: DENOMINATOR.mul(new BN('10')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('300000000')) }
      const amount: BN = new BN('1000000')
      const fee = toDecimal(6, 4)

      const result: SwapResult = calculateSwapStep(price, target, liquidity, amount, true, fee)

      const expectedResult: SwapResult = {
        nextPrice: { v: new BN('1013331333333') },
        amountIn: new BN('999400'),
        amountOut: new BN('976487'), // ((1.013331333333 - 1.01) * 300000000) / (1.013331333333 * 1.01)
        feeAmount: new BN('600')
      }

      assert.ok(result.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(result.amountIn.eq(expectedResult.amountIn))
      assert.ok(result.amountOut.eq(expectedResult.amountOut))
      assert.ok(result.feeAmount.eq(expectedResult.feeAmount))
    })
    it('amount out not capped', async () => {
      const price: Decimal = { v: DENOMINATOR.mul(new BN('101')) }
      const target: Decimal = { v: DENOMINATOR.mul(new BN('100')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('5000000000000')) }
      const amount: BN = new BN('2000000')
      const fee = toDecimal(6, 4)

      const result: SwapResult = calculateSwapStep(price, target, liquidity, amount, false, fee)

      const expectedResult: SwapResult = {
        nextPrice: { v: new BN('100999999600000') },
        amountIn: new BN('197'),
        amountOut: amount, // (5000000000000 * (101 - 100.9999996)) /  (101 * 100.9999996)
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
      const priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('0')) }

      const result = getDeltaX(priceA, priceB, liquidity, false)

      const expectedResult = new BN('0')
      assert.ok(result.eq(expectedResult))
    })
    it('equal at equal liquidity', async () => {
      const priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }

      const result = getDeltaX(priceA, priceB, liquidity, false)

      const expectedResult = new BN('1')
      assert.ok(result.eq(expectedResult))
    })

    it('big numbers', async () => {
      const priceA: Decimal = { v: new BN('234878324943782') }
      const priceB: Decimal = { v: new BN('87854456421658') }
      const liquidity: Decimal = { v: new BN('983983249092300399') }

      const resultDown = getDeltaX(priceA, priceB, liquidity, false)
      const resultUp = getDeltaX(priceA, priceB, liquidity, true)

      const expectedResultDown = new BN(7010)
      const expectedResultUp = new BN(7011)
      // 7010.8199533090222620342346078676429792113623790285962379282493052
      assert.ok(resultDown.eq(expectedResultDown))
      assert.ok(resultUp.eq(expectedResultUp))
    })
  })
  describe('test getDeltaY', () => {
    it('zero at zero liquidity', async () => {
      const priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('0')) }

      const result = getDeltaY(priceA, priceB, liquidity, false)

      const expectedResult = new BN('0')
      assert.ok(result.eq(expectedResult))
    })
    it('equal at equal liquidity', async () => {
      const priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const priceB: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }

      const result = getDeltaY(priceA, priceB, liquidity, false)

      const expectedResult = new BN('2')
      assert.ok(result.eq(expectedResult))
    })

    it('big numbers', async () => {
      const priceA: Decimal = { v: new BN('234878324943782') }
      const priceB: Decimal = { v: new BN('87854456421658') }
      const liquidity: Decimal = { v: new BN('983983249092300399') }

      const resultDown = getDeltaY(priceA, priceB, liquidity, false)
      const resultUp = getDeltaY(priceA, priceB, liquidity, true)

      const expectedResultDown = new BN(144669023)
      const expectedResultUp = new BN(144669024)

      assert.ok(resultDown.eq(expectedResultDown))
      assert.ok(resultUp.eq(expectedResultUp))
    })
  })
  describe('test getNextPriceXUp', () => {
    describe('add', () => {
      it('1', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        const amount: BN = new BN('1')

        const result = getNextPriceXUp(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('500000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {})
      const price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      const amount: BN = new BN('3')

      const result = getNextPriceXUp(price, liquidity, amount, true)
      const expectedResult: Decimal = { v: new BN('400000000000') }

      assert.ok(result.v.eq(expectedResult.v))
      it('3', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3')) }
        const amount: BN = new BN('5')

        const result = getNextPriceXUp(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('461538461539') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('4', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('24234')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3000')) }
        const amount: BN = new BN('5000')

        const result = getNextPriceXUp(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('599985145206') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
    describe('subtract', () => {
      it('1', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        const amount: BN = new BN('1')

        const result = getNextPriceXUp(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('2000000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('100000')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('500000000')) }
        const amount: BN = new BN('4000')

        const result = getNextPriceXUp(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('500000000000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('3', async () => {
        const price: Decimal = { v: new BN('3333333333333') }
        const liquidity: Decimal = { v: new BN('222222222222222') }
        const amount: BN = new BN('37')

        const result = getNextPriceXUp(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('7490636704119') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
  })
  describe('test getNextPriceYDown', () => {
    describe('add', () => {
      it('1', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        const amount: BN = new BN('1')

        const result = getNextPriceYDown(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('2000000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {})
      const price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      const amount: BN = new BN('3')

      const result = getNextPriceYDown(price, liquidity, amount, true)
      const expectedResult: Decimal = { v: new BN('2500000000000') }

      assert.ok(result.v.eq(expectedResult.v))
      it('3', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3')) }
        const amount: BN = new BN('5')

        const result = getNextPriceYDown(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('3666666666666') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('4', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('24234')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3000')) }
        const amount: BN = new BN('5000')

        const result = getNextPriceYDown(price, liquidity, amount, true)
        const expectedResult: Decimal = { v: new BN('24235666666666666') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
    describe('subtract', () => {
      it('1', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        const amount: BN = new BN('1')

        const result = getNextPriceYDown(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('500000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('100000')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('500000000')) }
        const amount: BN = new BN('4000')

        const result = getNextPriceYDown(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('99999999992000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('3', async () => {
        const price: Decimal = { v: DENOMINATOR.mul(new BN('3')) }
        const liquidity: Decimal = { v: DENOMINATOR.mul(new BN('222')) }
        const amount: BN = new BN('37')

        const result = getNextPriceYDown(price, liquidity, amount, false)
        const expectedResult: Decimal = { v: new BN('2833333333333') }

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
      const step = new BN(4)
      const limit = getSearchLimit(new BN(MAX_TICK - 22), step, true)
      const expected = new BN(MAX_TICK - 2)
      assert.ok(limit.eq(expected))
    })
    it('At the price limit', async () => {
      const step = new BN(4)
      const limit = getSearchLimit(new BN(MAX_TICK - 2), step, true)
      const expected = new BN(MAX_TICK - 2)
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
        liquidity: { v: new BN(1).mul(DENOMINATOR) },
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
        liquidity: { v: new BN(1).mul(DENOMINATOR) },
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
        liquidity: { v: new BN('01386cfed7bbff207000', 'hex') },
        feeGrowthInsideX: { v: new BN('ffffffffffffffffffc8ee8de34d553d', 'hex') },
        feeGrowthInsideY: { v: new BN('ffffffffffffffffffd3fd7d514848b6', 'hex') },
        tokensOwedX: { v: new BN(0) },
        tokensOwedY: { v: new BN(0) }
      }

      const lowerTick: Tick = {
        pool: Keypair.generate().publicKey,
        index: 21109,
        sign: true,
        liquidityChange: { v: new BN('0b12b681a4aba5c5ff51d0', 'hex') },
        liquidityGross: { v: new BN('0b12b681a4aba5c5ff51d0', 'hex') },
        sqrtPrice: { v: new BN('029cf3124f61', 'hex') },
        feeGrowthOutsideX: { v: new BN('0c4fee04dd2b3b8c', 'hex') },
        feeGrowthOutsideY: { v: new BN('01a99cb6b2bd6911e7', 'hex') },
        bump: 0
      }
      const upperTick: Tick = {
        pool: Keypair.generate().publicKey,
        index: 21129,
        sign: false,
        liquidityChange: { v: new BN('09fbe1e935b90af3ccf7d9', 'hex') },
        liquidityGross: { v: new BN('0b9af0d9def1a2deea57d9', 'hex') },
        sqrtPrice: { v: new BN('029d9e665157', 'hex') },
        feeGrowthOutsideX: { v: new BN('3b9f3a68b9c225', 'hex') },
        feeGrowthOutsideY: { v: new BN('2c0282aeb7b74a', 'hex') },
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
  describe('test simulateSwap', () => {
    it('Swap', async () => {
      const simulationResult: SimulationResult = simulateSwap(swapParameters)

      assert.ok(simulationResult.accumulatedAmountIn.eq(new BN(994)))
      assert.ok(simulationResult.accumulatedAmountOut.eq(new BN(993)))
      assert.ok(simulationResult.accumulatedFee.eq(new BN(6)))
      assert.ok(simulationResult.amountPerTick[0].eq(new BN(1000)))
      console.log(simulationResult.priceAfterSwap.toString())
      assert.ok(simulationResult.priceAfterSwap.eq(new BN('999006987055')))
    })
  })
})
