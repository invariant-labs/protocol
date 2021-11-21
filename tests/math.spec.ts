import { assert } from 'chai'
import { BN } from '@project-serum/anchor'
import { calculate_price_sqrt, DENOMINATOR } from '@invariant-labs/sdk'
import { getLiquidityByX, getLiquidityByY } from '@invariant-labs/sdk/src/tick'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { calculatePriceAfterSlippage } from '@invariant-labs/sdk/src/math'

describe('Math', () => {
  describe('Test sqrt price calculation', () => {
    it('Test 20000', () => {
      let price = 20000
      let result = calculate_price_sqrt(price)
      // expected 2.718145925979
      assert.ok(result.v.eq(new BN('2718145925979')))
    })
    it('Test 200000', () => {
      let price = 200000
      let result = calculate_price_sqrt(price)
      // expected 22015.455979766288
      assert.ok(result.v.eq(new BN('22015455979766288')))
    })
    it('Test -20000', () => {
      let price = -20000
      let result = calculate_price_sqrt(price)
      // expected 0.367897834491
      assert.ok(result.v.eq(new BN('367897834491')))
    })
    it('Test -200000', () => {
      let price = -200000
      let result = calculate_price_sqrt(price)
      // expected 0.000045422634
      assert.ok(result.v.eq(new BN('45422634')))
    })
    it('Test 0', () => {
      let price = 0
      let result = calculate_price_sqrt(price)
      // expected 2.718145925979
      assert.ok(result.v.eq(new BN('1000000000000')))
    })
  })
  describe('calculate y, liquidity', () => {
    const tokenDecimal = 6
    const x = new BN(43 * 10 ** (tokenDecimal - 2)) // 0.43
    const currentTick = 100

    it('below current tick', async () => {
      const lowerTick = -50
      const upperTick = 10
      try {
        getLiquidityByX(x, lowerTick, upperTick, currentTick, true)
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
        currentTick,
        true
      )
      const { liquidity: roundDownLiquidity, y: roundDownY } = getLiquidityByX(
        x,
        lowerTick,
        upperTick,
        currentTick,
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
        currentTick,
        true
      )
      const { liquidity: roundDownLiquidity, y: roundDownY } = getLiquidityByX(
        x,
        lowerTick,
        upperTick,
        currentTick,
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

    it('below current tick', async () => {
      // rust results:
      const expectedL = { v: new BN('2789052279103923275993666') }

      const lowerTick = -22000
      const upperTick = -21000

      const { liquidity: roundUpLiquidity, x: roundUpX } = getLiquidityByY(
        y,
        lowerTick,
        upperTick,
        currentTick,
        true
      )
      const { liquidity: roundDownLiquidity, x: roundDownX } = getLiquidityByY(
        y,
        lowerTick,
        upperTick,
        currentTick,
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
        currentTick,
        true
      )
      const { liquidity: roundDownLiquidity, x: roundDownX } = getLiquidityByY(
        y,
        lowerTick,
        upperTick,
        currentTick,
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
        getLiquidityByY(y, lowerTick, upperTick, currentTick, true)
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
})
