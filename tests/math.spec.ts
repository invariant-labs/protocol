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
    describe('same decimal tokens', async () => {
      // expected
      const xDecimal = 6
      const yDecimal = 6
      const x = new BN(43 * 10 ** xDecimal - 2) // 0.43
      const currentTick = 100

      it('below current tick', async () => {
        const lowerTick = -50
        const upperTick = 10
        const { liquidity, y } = getLiquidityByX(x, lowerTick, upperTick, currentTick)
        console.log(liquidity.toString())
        console.log(y.toString())
      })
      it('in current tick', async () => {})
      it('above current tick', async () => {})
    })
    describe('difference decimal  tokens', async () => {})
  })
})
