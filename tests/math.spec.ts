import { assert } from 'chai'
import { BN } from '@project-serum/anchor'
import { calculatePriceSqrt, DENOMINATOR, TICK_LIMIT } from '@invariant-labs/sdk'
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
  SwapResult
} from '@invariant-labs/sdk/src/math'
import { assertThrowsAsync, bigNumberToBuffer, toDecimal } from '@invariant-labs/sdk/src/utils'
import { calculatePriceAfterSlippage, findClosestTicks } from '@invariant-labs/sdk/src/math'
import { setInitialized } from './testUtils'
import { Decimal } from '@invariant-labs/sdk/src/market'

describe('Math', () => {
  describe('Test sqrt price calculation', () => {
    it('Test 20000', () => {
      let price = 20000
      let result = calculatePriceSqrt(price)
      // expected 2.718145925979
      assert.ok(result.v.eq(new BN('2718145925979')))
    })
    it('Test 200000', () => {
      let price = 200000
      let result = calculatePriceSqrt(price)
      // expected 22015.455979766288
      assert.ok(result.v.eq(new BN('22015455979766288')))
    })
    it('Test -20000', () => {
      let price = -20000
      let result = calculatePriceSqrt(price)
      // expected 0.367897834491
      assert.ok(result.v.eq(new BN('367897834491')))
    })
    it('Test -200000', () => {
      let price = -200000
      let result = calculatePriceSqrt(price)
      // expected 0.000045422634
      assert.ok(result.v.eq(new BN('45422634')))
    })
    it('Test 0', () => {
      let price = 0
      let result = calculatePriceSqrt(price)
      // expected 2.718145925979
      assert.ok(result.v.eq(new BN('1000000000000')))
    })
  })
  describe('calculate y, liquidity', () => {
    const tokenDecimal = 6
    const x = new BN(43 * 10 ** (tokenDecimal - 2)) // 0.43
    const currentTick = 100
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
      const expectedL = { v: new BN('432392997000000000000') }
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
      const expectedL = { v: new BN('13548826311611234766') }
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
      const expectedL = { v: new BN('2789052279103923275993666') }

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
      const expectedL = { v: new BN('584945290554346935615679') }
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
    let bitmap = new Array(TICK_LIMIT * 2).fill(0)

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
      assert.ok(result[0] == initialized[0])
    })

    it('near top limit', async () => {
      const initialized = [TICK_LIMIT]
      initialized.forEach(i => setInitialized(bitmap, i))

      const result = findClosestTicks(bitmap, 0, 1, 200)
      assert.ok(result.pop() == initialized[0])
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

    it('upperSqrtPrice > currentSqrtPrice', async () => {
      const upperTick = 110
      const currentTick = 80

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const x = getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v)

      assert.ok(x.eq(new BN(2985635497947)))
    })

    it('upperSqrtPrice = currentSqrtPrice', async () => {
      const upperTick = 80
      const currentTick = 80

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const x = getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v)

      assert.ok(x.eq(new BN(0)))
    })

    it('upperSqrtPrice < currentSqrtPrice', async () => {
      const currentTick = 110
      const upperTick = 80

      const upperSqrtPrice = calculatePriceSqrt(upperTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      try {
        getX(liquidity, upperSqrtPrice.v, currentSqrtPrice.v)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('upperSqrtPrice = 0', async () => {
      const upperSqrtPrice = new BN(0)
      const currentSqrtPrice = calculatePriceSqrt(10)

      try {
        getX(liquidity, upperSqrtPrice, currentSqrtPrice.v)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('currentSqrtPrice = 0', async () => {
      const currentSqrtPrice = new BN(0)
      const upperSqrtPrice = calculatePriceSqrt(10)

      try {
        getX(liquidity, upperSqrtPrice.v, currentSqrtPrice)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })
  })

  describe('calculate y having liquidity and price', () => {
    const liquidity = new BN(2000).mul(DENOMINATOR)

    it('lowerSqrtPrice < currentSqrtPrice', async () => {
      const lowerTick = 50
      const currentTick = 80

      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const y = getY(liquidity, currentSqrtPrice.v, lowerSqrtPrice.v)

      assert.ok(y.eq(new BN(3009615174000)))
    })

    it('lowerSqrtPrice = currentSqrtPrice', async () => {
      const lowerTick = 80
      const currentTick = 80

      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      const y = getY(liquidity, currentSqrtPrice.v, lowerSqrtPrice.v)

      assert.ok(y.eq(new BN(0)))
    })

    it('lowerSqrtPrice > currentSqrtPrice', async () => {
      const lowerTick = 80
      const currentTick = 50

      const lowerSqrtPrice = calculatePriceSqrt(lowerTick)
      const currentSqrtPrice = calculatePriceSqrt(currentTick)

      try {
        getY(liquidity, currentSqrtPrice.v, lowerSqrtPrice.v)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('lowerSqrtPrice = 0', async () => {
      const lowerSqrtPrice = new BN(0)
      const currentSqrtPrice = calculatePriceSqrt(0)

      try {
        getY(liquidity, currentSqrtPrice.v, lowerSqrtPrice)
      } catch (e: any) {
        assert.isTrue(true)
        return
      }

      assert.isTrue(false)
    })

    it('currentSqrtPrice = 0', async () => {
      const currentSqrtPrice = new BN(0)
      const lowerSqrtPrice = calculatePriceSqrt(0)

      try {
        getY(liquidity, currentSqrtPrice, lowerSqrtPrice.v)
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
      let price: Decimal = { v: DENOMINATOR }
      let target: Decimal = {
        v: sqrt(DENOMINATOR.mul(new BN('101')).div(new BN('100')).mul(DENOMINATOR))
      }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2000')) }
      let amount: BN = new BN('1')
      let fee = toDecimal(6, 4)

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
      let price: Decimal = { v: DENOMINATOR }
      let target: Decimal = {
        v: sqrt(DENOMINATOR.mul(new BN('101')).div(new BN('100')).mul(DENOMINATOR))
      }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2000')) }
      let amount: BN = new BN('20')
      let fee = toDecimal(6, 4)

      const result_in: SwapResult = calculateSwapStep(price, target, liquidity, amount, true, fee)
      const result_out: SwapResult = calculateSwapStep(price, target, liquidity, amount, false, fee)

      const expectedResult: SwapResult = {
        nextPrice: target,
        amountIn: new BN('10'),
        amountOut: new BN('9'),
        feeAmount: new BN('1')
      }

      assert.ok(result_in.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(result_in.amountIn.eq(expectedResult.amountIn))
      assert.ok(result_in.amountOut.eq(expectedResult.amountOut))
      assert.ok(result_in.feeAmount.eq(expectedResult.feeAmount))

      assert.ok(result_out.nextPrice.v.eq(expectedResult.nextPrice.v))
      assert.ok(result_out.amountIn.eq(expectedResult.amountIn))
      assert.ok(result_out.amountOut.eq(expectedResult.amountOut))
      assert.ok(result_out.feeAmount.eq(expectedResult.feeAmount))
    })

    it('amount in not capped', async () => {
      let price: Decimal = { v: DENOMINATOR.mul(new BN('101')).div(new BN('100')) }
      let target: Decimal = { v: DENOMINATOR.mul(new BN('10')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('300000000')) }
      let amount: BN = new BN('1000000')
      let fee = toDecimal(6, 4)

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
      let price: Decimal = { v: DENOMINATOR.mul(new BN('101')) }
      let target: Decimal = { v: DENOMINATOR.mul(new BN('100')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('5000000000000')) }
      let amount: BN = new BN('2000000')
      let fee = toDecimal(6, 4)

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
      let priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let priceB: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('0')) }

      let result = getDeltaX(priceA, priceB, liquidity, false)

      let expectedResult = new BN('0')
      assert.ok(result.eq(expectedResult))
    })
    it('equal at equal liquidity', async () => {
      let priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let priceB: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }

      let result = getDeltaX(priceA, priceB, liquidity, false)

      let expectedResult = new BN('1')
      assert.ok(result.eq(expectedResult))
    })

    it('big numbers', async () => {
      let priceA: Decimal = { v: new BN('234878324943782') }
      let priceB: Decimal = { v: new BN('87854456421658') }
      let liquidity: Decimal = { v: new BN('983983249092300399') }

      let result_down = getDeltaX(priceA, priceB, liquidity, false)
      let result_up = getDeltaX(priceA, priceB, liquidity, true)

      let expectedResultDown = new BN(7010)
      let expectedResultUp = new BN(7011)
      //7010.8199533090222620342346078676429792113623790285962379282493052
      assert.ok(result_down.eq(expectedResultDown))
      assert.ok(result_up.eq(expectedResultUp))
    })
  })
  describe('test getDeltaY', () => {
    it('zero at zero liquidity', async () => {
      let priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let priceB: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('0')) }

      let result = getDeltaY(priceA, priceB, liquidity, false)

      let expectedResult = new BN('0')
      assert.ok(result.eq(expectedResult))
    })
    it('equal at equal liquidity', async () => {
      let priceA: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let priceB: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }

      let result = getDeltaY(priceA, priceB, liquidity, false)

      let expectedResult = new BN('2')
      assert.ok(result.eq(expectedResult))
    })

    it('big numbers', async () => {
      let priceA: Decimal = { v: new BN('234878324943782') }
      let priceB: Decimal = { v: new BN('87854456421658') }
      let liquidity: Decimal = { v: new BN('983983249092300399') }

      let result_down = getDeltaY(priceA, priceB, liquidity, false)
      let result_up = getDeltaY(priceA, priceB, liquidity, true)

      let expectedResultDown = new BN(144669023)
      let expectedResultUp = new BN(144669024)

      assert.ok(result_down.eq(expectedResultDown))
      assert.ok(result_up.eq(expectedResultUp))
    })
  })
  describe('test getNextPriceXUp', () => {
    describe('add', () => {
      it('1', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        let amount: BN = new BN('1')

        let result = getNextPriceXUp(price, liquidity, amount, true)
        let expectedResult: Decimal = { v: new BN('500000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {})
      let price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      let amount: BN = new BN('3')

      let result = getNextPriceXUp(price, liquidity, amount, true)
      let expectedResult: Decimal = { v: new BN('400000000000') }

      assert.ok(result.v.eq(expectedResult.v))
      it('3', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3')) }
        let amount: BN = new BN('5')

        let result = getNextPriceXUp(price, liquidity, amount, true)
        let expectedResult: Decimal = { v: new BN('461538461539') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('4', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('24234')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3000')) }
        let amount: BN = new BN('5000')

        let result = getNextPriceXUp(price, liquidity, amount, true)
        let expectedResult: Decimal = { v: new BN('599985145206') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
    describe('subtract', () => {
      it('1', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        let amount: BN = new BN('1')

        let result = getNextPriceXUp(price, liquidity, amount, false)
        let expectedResult: Decimal = { v: new BN('2000000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('100000')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('500000000')) }
        let amount: BN = new BN('4000')

        let result = getNextPriceXUp(price, liquidity, amount, false)
        let expectedResult: Decimal = { v: new BN('500000000000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('3', async () => {
        let price: Decimal = { v: new BN('3333333333333') }
        let liquidity: Decimal = { v: new BN('222222222222222') }
        let amount: BN = new BN('37')

        let result = getNextPriceXUp(price, liquidity, amount, false)
        let expectedResult: Decimal = { v: new BN('7490636704119') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
  })
  describe('test getNextPriceYDown', () => {
    describe('add', () => {
      it('1', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        let amount: BN = new BN('1')

        let result = getNextPriceYDown(price, liquidity, amount, true)
        let expectedResult: Decimal = { v: new BN('2000000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {})
      let price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
      let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
      let amount: BN = new BN('3')

      let result = getNextPriceYDown(price, liquidity, amount, true)
      let expectedResult: Decimal = { v: new BN('2500000000000') }

      assert.ok(result.v.eq(expectedResult.v))
      it('3', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3')) }
        let amount: BN = new BN('5')

        let result = getNextPriceYDown(price, liquidity, amount, true)
        let expectedResult: Decimal = { v: new BN('3666666666666') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('4', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('24234')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('3000')) }
        let amount: BN = new BN('5000')

        let result = getNextPriceYDown(price, liquidity, amount, true)
        let expectedResult: Decimal = { v: new BN('24235666666666666') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
    describe('subtract', () => {
      it('1', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('1')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('2')) }
        let amount: BN = new BN('1')

        let result = getNextPriceYDown(price, liquidity, amount, false)
        let expectedResult: Decimal = { v: new BN('500000000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('2', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('100000')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('500000000')) }
        let amount: BN = new BN('4000')

        let result = getNextPriceYDown(price, liquidity, amount, false)
        let expectedResult: Decimal = { v: new BN('99999999992000000') }

        assert.ok(result.v.eq(expectedResult.v))
      })
      it('3', async () => {
        let price: Decimal = { v: DENOMINATOR.mul(new BN('3')) }
        let liquidity: Decimal = { v: DENOMINATOR.mul(new BN('222')) }
        let amount: BN = new BN('37')

        let result = getNextPriceYDown(price, liquidity, amount, false)
        let expectedResult: Decimal = { v: new BN('2833333333333') }

        assert.ok(result.v.eq(expectedResult.v))
      })
    })
  })
})
