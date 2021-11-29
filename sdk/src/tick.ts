import { BN } from '@project-serum/anchor'
import { assert } from 'chai'
import { DENOMINATOR, MAX_TICK, TICK_LIMIT } from '.'
import { Decimal, Tick, Tickmap } from './market'
import { calculate_price_sqrt, TICK_SEARCH_RANGE } from './math'

const mulUp = (a: BN, b: BN) => {
  return a.mul(b).add(DENOMINATOR.subn(1)).div(DENOMINATOR)
}

const divUp = (a: BN, b: BN) => {
  return a.add(b).subn(1).div(b)
}

const calculateY = (priceDiff: BN, liquidity: BN, roundingUp: boolean) => {
  const shiftedLiquidity = liquidity.div(DENOMINATOR)

  if (roundingUp) {
    return mulUp(priceDiff, shiftedLiquidity)
  }
  return priceDiff.mul(shiftedLiquidity).div(DENOMINATOR)
}

const calculateX = (nominator: BN, denominator: BN, liquidity: BN, roundingUp: boolean) => {
  const common = liquidity.mul(nominator).div(denominator)
  if (roundingUp) {
    return divUp(common, DENOMINATOR)
  }
  return common.div(DENOMINATOR)
}

export const getLiquidityByX = (
  x: BN,
  lowerTick: number,
  upperTick: number,
  currentSqrtPrice: Decimal,
  roundingUp: boolean
) => {
  const lowerSqrtPrice = calculate_price_sqrt(lowerTick)
  const upperSqrtPrice = calculate_price_sqrt(upperTick)

  return getLiquidityByXPrice(x, lowerSqrtPrice, upperSqrtPrice, currentSqrtPrice, roundingUp)
}

export const getLiquidityByXPrice = (
  x: BN,
  lowerSqrtPrice: Decimal,
  upperSqrtPrice: Decimal,
  currentSqrtPrice: Decimal,
  roundingUp: boolean
): {
  liquidity: Decimal
  y: BN
} => {
  if (upperSqrtPrice.v.lt(currentSqrtPrice.v)) {
    throw new Error('liquidity cannot be determined')
  }

  if (currentSqrtPrice.v.lt(lowerSqrtPrice.v)) {
    const nominator = lowerSqrtPrice.v.mul(upperSqrtPrice.v).div(DENOMINATOR)
    const denominator = upperSqrtPrice.v.sub(lowerSqrtPrice.v)
    const liquidity = x.mul(nominator).mul(DENOMINATOR).div(denominator)

    return {
      liquidity: { v: liquidity },
      y: new BN(0)
    }
  }

  const nominator = currentSqrtPrice.v.mul(upperSqrtPrice.v).div(DENOMINATOR)
  const denominator = upperSqrtPrice.v.sub(currentSqrtPrice.v)
  const liquidity = x.mul(nominator).div(denominator).mul(DENOMINATOR)
  const priceDiff = currentSqrtPrice.v.sub(lowerSqrtPrice.v)
  const y = calculateY(priceDiff, liquidity, roundingUp)

  return {
    liquidity: { v: liquidity },
    y
  }
}

export const getLiquidityByY = (
  y: BN,
  lowerTick: number,
  upperTick: number,
  currentSqrtPrice: Decimal,
  roundingUp: boolean
) => {
  const lowerSqrtPrice = calculate_price_sqrt(lowerTick)
  const upperSqrtPrice = calculate_price_sqrt(upperTick)

  return getLiquidityByYPrice(y, lowerSqrtPrice, upperSqrtPrice, currentSqrtPrice, roundingUp)
}

export const getLiquidityByYPrice = (
  y: BN,
  lowerSqrtPrice: Decimal,
  upperSqrtPrice: Decimal,
  currentSqrtPrice: Decimal,
  roundingUp: boolean
) => {
  if (currentSqrtPrice.v.lt(lowerSqrtPrice.v)) {
    throw new Error('liquidity cannot be determined')
  }

  if (upperSqrtPrice.v.lt(currentSqrtPrice.v)) {
    const priceDiff = upperSqrtPrice.v.sub(lowerSqrtPrice.v)
    const liquidity = y.mul(DENOMINATOR).mul(DENOMINATOR).div(priceDiff)

    return {
      liquidity: { v: liquidity },
      x: new BN(0)
    }
  }

  const priceDiff = currentSqrtPrice.v.sub(lowerSqrtPrice.v)
  const liquidity = y.mul(DENOMINATOR).mul(DENOMINATOR).div(priceDiff)
  const denominator = currentSqrtPrice.v.mul(upperSqrtPrice.v).div(DENOMINATOR)
  const nominator = upperSqrtPrice.v.sub(currentSqrtPrice.v)
  const x = calculateX(nominator, denominator, liquidity, roundingUp)

  return {
    liquidity: { v: liquidity },
    x
  }
}

export const getTickFromPrice = (currentTick: number, tickSpacing: number, price: Decimal, xToY: boolean): number => {
  assert.isTrue(currentTick % tickSpacing == 0)

  if (xToY) {
    return priceToTickInRange(
      price, 
      Math.max(-TICK_LIMIT, currentTick - TICK_SEARCH_RANGE), 
      currentTick, 
      tickSpacing)
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

  low = low / step
  high = high / step
  let targetValue = price

  while (high - low > 1) {
    let mid = (high - low) / 2 + low
    let val = calculate_price_sqrt(mid * step)

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
