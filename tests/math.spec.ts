import { assert } from 'chai'
import { BN } from '@project-serum/anchor'
import { getLiquidityByX } from '@invariant-labs/sdk/src/tick'
import { calculate_price_sqrt } from '@invariant-labs/sdk'

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
  describe('calculate liquidity', () => {
    describe('positive liquidity delta (token rounding up)', async () => {
      // expected
      const decimal = 6
      const x = new BN(43 * 10 ** (decimal - 2)) // 0.43
      const currentTick = 100

      it('below current tick', async () => {
        const lowerTick = -50
        const upperTick = 10
        try {
          getLiquidityByX(x, lowerTick, upperTick, currentTick)
          assert.ok(false)
        } catch (e) {
          assert.ok(true)
        }
      })
      it('in current tick', async () => {
        // rust results:
        const expectedL = { v: new BN('432392997000000000000') }
        const expectedX = new BN(430000)
        const expectedY = new BN(434322)

        const lowerTick = 80
        const upperTick = 120
        const { liquidity, y } = getLiquidityByX(x, lowerTick, upperTick, currentTick)

        assert.ok(liquidity.v.eq(expectedL.v))
        assert.ok(expectedX.eq(x))
        // assert.ok(expectedY.eq(y))
      })
      it('above current tick', async () => {})
    })
    describe('negative liquidity delta (token rounding down)', async () => {})
  })
})
