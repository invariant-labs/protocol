import { calculate_price_sqrt } from '../sdk/src/math'
import { assert } from 'chai'
import { BN } from '@project-serum/anchor'

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
