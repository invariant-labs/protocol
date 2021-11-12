import { BN } from '@project-serum/anchor'
import { DENOMINATOR } from '.'
import { Decimal } from './market'
import { calculate_price_sqrt } from './math'

export const getLiquidityByX = (
  x: BN,
  lowerTick: number,
  upperTick: number,
  currentTick: number
) => {
  const lowerSqrtPrice = calculate_price_sqrt(lowerTick)
  const upperSqrtPrice = calculate_price_sqrt(upperTick)
  const currentSqrtPrice = calculate_price_sqrt(currentTick)

  return getLiquidityByXPrice(x, lowerSqrtPrice, upperSqrtPrice, currentSqrtPrice)
}

export const getLiquidityByXPrice = (
  x: BN,
  lowerSqrtPrice: Decimal,
  upperSqrtPrice: Decimal,
  currentSqrtPrice: Decimal
): {
  liquidity: Decimal
  y: BN
} => {
  if (upperSqrtPrice.v.lt(currentSqrtPrice.v)) {
    throw new Error('cannot be determined liquidity')
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
  const y = currentSqrtPrice.v.sub(lowerSqrtPrice.v).mul(liquidity).div(DENOMINATOR)

  return {
    liquidity: { v: liquidity.mul(DENOMINATOR) },
    y
  }
}

// export const getLiquidityByYPrice = (
//   y: BN,
//   lowerSqrtPrice: Decimal,
//   upperSqrtPrice: Decimal,
//   currentSqrtPrice: Decimal
// ) => {

// }
