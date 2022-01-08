import { assert } from 'chai'
import { TICK_LIMIT } from '.'
import { Decimal } from './market'
import { calculatePriceSqrt, TICK_SEARCH_RANGE } from './math'

export const getTickFromPrice = (
  currentTick: number,
  tickSpacing: number,
  price: Decimal,
  xToY: boolean
): number => {
  assert.isTrue(currentTick % tickSpacing == 0)

  if (xToY) {
    return priceToTickInRange(
      price,
      Math.max(-TICK_LIMIT, currentTick - TICK_SEARCH_RANGE),
      currentTick,
      tickSpacing
    )
  } else {
    return priceToTickInRange(
      price,
      currentTick,
      Math.min(TICK_LIMIT, currentTick + TICK_SEARCH_RANGE),
      tickSpacing
    )
  }
}

const priceToTickInRange = (price: Decimal, low: number, high: number, step: number): number => {
  assert.ok(step != 0)

  low = Math.floor(low / step)
  high = Math.floor(high / step)
  let targetValue = price

  while (high - low > 1) {
    let mid = Math.floor((high - low) / 2) + low
    let val = calculatePriceSqrt(mid * step)

    if (val.v.eq(targetValue.v)) {
      return mid * step
    }

    if (val.v.lt(targetValue.v)) {
      low = mid
    }

    if (val.v.gt(targetValue.v)) {
      high = mid
    }
  }

  return low * step
}
