import { BN } from '@project-serum/anchor'
import { DENOMINATOR } from '.'
import { Decimal } from './market'
import { calculate_price_sqrt } from './math'

const mulUp = (a: BN, b: BN) => {
  return a.mul(b).add(DENOMINATOR.subn(1)).div(DENOMINATOR)
}

const divUp = (a: BN, b: BN) => {
  return a.add(b).subn(1).div(b)
}

const calculateY = (priceDiff: BN, liquidity: BN, roundingUp: boolean) => {
  if (roundingUp) {
    return mulUp(priceDiff, liquidity)
  }
  return priceDiff.mul(liquidity).div(DENOMINATOR)
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
  currentTick: number,
  roundingUp: boolean
) => {
  const lowerSqrtPrice = calculate_price_sqrt(lowerTick)
  const upperSqrtPrice = calculate_price_sqrt(upperTick)
  const currentSqrtPrice = calculate_price_sqrt(currentTick)

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
    const liquidity = x.mul(nominator).div(denominator)

    return {
      liquidity: { v: liquidity.mul(DENOMINATOR) },
      y: new BN(0)
    }
  }

  const nominator = currentSqrtPrice.v.mul(upperSqrtPrice.v).div(DENOMINATOR)
  const denominator = upperSqrtPrice.v.sub(currentSqrtPrice.v)
  const liquidity = x.mul(nominator).div(denominator)
  const priceDiff = currentSqrtPrice.v.sub(lowerSqrtPrice.v)
  const y = calculateY(priceDiff, liquidity, roundingUp)

  return {
    liquidity: { v: liquidity.mul(DENOMINATOR) },
    y
  }
}

export const getLiquidityByY = (
  y: BN,
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  roundingUp: boolean
) => {
  const lowerSqrtPrice = calculate_price_sqrt(lowerTick)
  const upperSqrtPrice = calculate_price_sqrt(upperTick)
  const currentSqrtPrice = calculate_price_sqrt(currentTick)

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
