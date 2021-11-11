import { BN } from '@project-serum/anchor'
import { Decimal } from './market'

// export const getLiquidityByX = (
//   x: BN,
//   lowerTick: number,
//   upperTick: number,
//   currentTick: number
// ) => {
//   // return L
//   // return x
// }

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
    const nominator = lowerSqrtPrice.v.mul(upperSqrtPrice.v)
    const denominator = upperSqrtPrice.v.sub(lowerSqrtPrice.v)
    const liquidity = x.mul(nominator).div(denominator)

    return {
      liquidity: { v: liquidity },
      y: new BN(0)
    }
  }

  const nominator = currentSqrtPrice.v.mul(upperSqrtPrice.v)
  const denominator = upperSqrtPrice.v.sub(currentSqrtPrice.v)
  const liquidity = x.mul(nominator).div(denominator)
  const y = currentSqrtPrice.v.sub(lowerSqrtPrice.v).mul(liquidity)

  return {
    liquidity: { v: liquidity },
    y
  }
}

// export const getLiquidityByY = () => {}
