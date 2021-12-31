import { BN } from '@project-serum/anchor'
import { assert } from 'chai'
import { Decimal, Tick, Tickmap } from './market'
import { DENOMINATOR, getMaxTick, getMinTick } from './utils'

export const TICK_LIMIT = 100_000
export const MAX_TICK = 221_818
export const MIN_TICK = -MAX_TICK
export const TICK_SEARCH_RANGE = 256

export interface SwapResult {
  nextPrice: Decimal
  amountIn: Decimal
  amountOut: Decimal
  feeAmount: Decimal
}

export const isInitialized = (tickmap: Tickmap, index: number, tickSpacing: number) => {
  if (index % tickSpacing !== 0) {
    throw Error("invalid arguments can't check tick")
  }
  const toIndex = Math.floor(index / tickSpacing) + TICK_LIMIT
  const byte = Math.floor(toIndex / 8)
  const bit = Math.floor(toIndex % 8)

  const value = tickmap.bitmap[byte] & (1 << bit)

  return value !== 0
}

export const fromInteger = (integer: number): { v: BN } => {
  return { v: new BN(integer).mul(DENOMINATOR) }
}

export const calculate_price_sqrt = (tick_index: number): Decimal => {
  const tick = Math.abs(tick_index)
  if (tick > MAX_TICK) {
    throw Error('tick over bounds')
  }
  let price = new BN(DENOMINATOR)

  if ((tick & 0x1) != 0) price = price.mul(new BN('1000049998750')).div(DENOMINATOR)
  if ((tick & 0x2) != 0) price = price.mul(new BN('1000100000000')).div(DENOMINATOR)
  if ((tick & 0x4) != 0) price = price.mul(new BN('1000200010000')).div(DENOMINATOR)
  if ((tick & 0x8) != 0) price = price.mul(new BN('1000400060004')).div(DENOMINATOR)
  if ((tick & 0x10) != 0) price = price.mul(new BN('1000800280056')).div(DENOMINATOR)
  if ((tick & 0x20) != 0) price = price.mul(new BN('1001601200560')).div(DENOMINATOR)
  if ((tick & 0x40) != 0) price = price.mul(new BN('1003204964963')).div(DENOMINATOR)
  if ((tick & 0x80) != 0) price = price.mul(new BN('1006420201726')).div(DENOMINATOR)
  if ((tick & 0x100) != 0) price = price.mul(new BN('1012881622442')).div(DENOMINATOR)
  if ((tick & 0x200) != 0) price = price.mul(new BN('1025929181080')).div(DENOMINATOR)
  if ((tick & 0x400) != 0) price = price.mul(new BN('1052530684591')).div(DENOMINATOR)
  if ((tick & 0x800) != 0) price = price.mul(new BN('1107820842005')).div(DENOMINATOR)
  if ((tick & 0x1000) != 0) price = price.mul(new BN('1227267017980')).div(DENOMINATOR)
  if ((tick & 0x2000) != 0) price = price.mul(new BN('1506184333421')).div(DENOMINATOR)
  if ((tick & 0x4000) != 0) price = price.mul(new BN('2268591246242')).div(DENOMINATOR)
  if ((tick & 0x8000) != 0) price = price.mul(new BN('5146506242525')).div(DENOMINATOR)
  if ((tick & 0x10000) != 0) price = price.mul(new BN('26486526504348')).div(DENOMINATOR)
  if ((tick & 0x20000) != 0) price = price.mul(new BN('701536086265529')).div(DENOMINATOR)

  if (tick_index < 0) {
    price = DENOMINATOR.mul(DENOMINATOR).div(price)
  }

  return { v: price }
}

export const sqrt = (num: BN): BN => {
  if (num.lt(new BN(0))) {
    throw new Error('Sqrt only works on non-negative inputs')
  }
  if (num.lt(new BN(2))) {
    return num
  }

  const smallCand = sqrt(num.shrn(2)).shln(1)
  const largeCand = smallCand.add(new BN(1))

  if (largeCand.mul(largeCand).gt(num)) {
    return smallCand
  } else {
    return largeCand
  }
}

export const calculatePriceAfterSlippage = (priceSqrt: Decimal, slippage: Decimal, up: boolean) => {
  // using sqrt of slippage, because price is a sqrt
  const multiplier = up ? slippage.v.add(DENOMINATOR) : DENOMINATOR.sub(slippage.v)
  const slippageSqrt = sqrt(multiplier.mul(DENOMINATOR))

  return { v: priceSqrt.v.mul(slippageSqrt).div(DENOMINATOR) }
}

export const calculateSwapStep = (
  currentPrice: Decimal,
  targetPrice: Decimal,
  liquidity: Decimal,
  amount: Decimal,
  byAmountIn: boolean,
  fee: Decimal
): SwapResult => {
  const aToB = currentPrice >= targetPrice

  let nextPrice: Decimal
  let amountIn: Decimal = { v: new BN(0) }
  let amountOut: Decimal = { v: new BN(0) }
  let feeAmount: Decimal

  if (byAmountIn) {
    const amountAfterFee: Decimal = {
      v: fromInteger(1).v.sub(fee.v).mul(amount.v).div(DENOMINATOR)
    }

    if (aToB) {
      amountIn = getDeltaX(targetPrice, currentPrice, liquidity, true)
    } else {
      amountIn = getDeltaY(targetPrice, currentPrice, liquidity, true)
    }
    if (amountAfterFee.v.gte(amountIn.v)) {
      nextPrice = targetPrice
    } else {
      nextPrice = getNextPriceFromInput(currentPrice, liquidity, amountAfterFee, aToB)
    }
  } else {
    if (aToB) {
      amountOut = getDeltaY(targetPrice, currentPrice, liquidity, false)
    } else {
      amountOut = getDeltaX(currentPrice, targetPrice, liquidity, false)
    }

    if (amount.v.gte(amountOut.v)) {
      nextPrice = targetPrice
    } else {
      nextPrice = getNextPriceFromOutput(currentPrice, liquidity, amount, aToB)
    }
  }

  const max = targetPrice.v.eq(nextPrice.v)

  if (aToB) {
    if (!(max && byAmountIn)) {
      amountIn = getDeltaX(nextPrice, currentPrice, liquidity, true)
    }
    if (!(max && !byAmountIn)) {
      amountOut = getDeltaY(nextPrice, currentPrice, liquidity, false)
    }
  } else {
    if (!(max && byAmountIn)) {
      amountIn = getDeltaY(currentPrice, nextPrice, liquidity, true)
    }
    if (!(max && !byAmountIn)) {
      amountOut = getDeltaX(currentPrice, nextPrice, liquidity, false)
    }
  }

  if (!byAmountIn && amountOut.v.gt(amount.v)) {
    amountOut = amount
  }

  if (byAmountIn && !nextPrice.v.eq(targetPrice.v)) {
    feeAmount = { v: amount.v.sub(amountIn.v) }
  } else {
    feeAmount = { v: amountIn.v.mul(fee.v).add(DENOMINATOR.subn(1)).div(DENOMINATOR) }
  }

  return {
    nextPrice,
    amountIn,
    amountOut,
    feeAmount
  }
}

const getDeltaX = (priceA: Decimal, priceB: Decimal, liquidity: Decimal, up: boolean): Decimal => {
  let deltaPrice: Decimal
  if (priceA > priceB) {
    deltaPrice = { v: priceA.v.sub(priceB.v) }
  } else {
    deltaPrice = { v: priceB.v.sub(priceA.v) }
  }

  const nominator: Decimal = { v: liquidity.v.mul(deltaPrice.v).div(DENOMINATOR) }

  if (up) {
    return {
      v: nominator.v
        .mul(DENOMINATOR)
        .add(priceA.v.mul(priceB.v).div(DENOMINATOR).subn(1))
        .div(priceA.v.mul(priceB.v).div(DENOMINATOR))
    }
  } else {
    return {
      v: nominator.v
        .mul(DENOMINATOR)
        .div(priceA.v.mul(priceB.v).add(DENOMINATOR.subn(1)).div(DENOMINATOR))
    }
  }
}

const getDeltaY = (priceA: Decimal, priceB: Decimal, liquidity: Decimal, up: boolean): Decimal => {
  let deltaPrice: Decimal
  if (priceA > priceB) {
    deltaPrice = { v: priceA.v.sub(priceB.v) }
  } else {
    deltaPrice = { v: priceB.v.sub(priceA.v) }
  }

  if (up) {
    return { v: liquidity.v.mul(deltaPrice.v).add(DENOMINATOR.subn(1)).div(DENOMINATOR) }
  } else {
    return { v: liquidity.v.mul(deltaPrice.v).div(DENOMINATOR) }
  }
}

const getNextPriceFromInput = (
  price: Decimal,
  liquidity: Decimal,
  amount: Decimal,
  aToB: boolean
): Decimal => {
  assert.isTrue(price.v.gt(new BN(0)))
  assert.isTrue(liquidity.v.gt(new BN(0)))

  if (aToB) {
    return getNextPriceXUp(price, liquidity, amount, true)
  } else {
    return getNextPriceYDown(price, liquidity, amount, true)
  }
}

const getNextPriceFromOutput = (
  price: Decimal,
  liquidity: Decimal,
  amount: Decimal,
  aToB: boolean
): Decimal => {
  assert.isTrue(price.v.gt(new BN(0)))
  assert.isTrue(liquidity.v.gt(new BN(0)))

  if (aToB) {
    return getNextPriceYDown(price, liquidity, amount, false)
  } else {
    return getNextPriceXUp(price, liquidity, amount, false)
  }
}

const getNextPriceXUp = (
  price: Decimal,
  liquidity: Decimal,
  amount: Decimal,
  add: boolean
): Decimal => {
  if (amount.v.eq(new BN(0))) {
    return price
  }

  const product: Decimal = { v: amount.v.mul(price.v).div(DENOMINATOR) }
  if (add) {
    if (product.v.mul(DENOMINATOR).div(amount.v).eq(price.v)) {
      const denominator: Decimal = { v: liquidity.v.add(product.v) }

      if (denominator.v.gte(liquidity.v)) {
        return {
          v: liquidity.v
            .mul(price.v)
            .add(DENOMINATOR.subn(1))
            .div(DENOMINATOR)
            .mul(DENOMINATOR)
            .add(denominator.v.subn(1))
            .div(denominator.v)
        }
      }
    }
    return {
      v: liquidity.v
        .mul(DENOMINATOR)
        .add(liquidity.v.mul(DENOMINATOR).div(price.v).add(amount.v).subn(1))
        .div(liquidity.v.mul(DENOMINATOR).div(price.v).add(amount.v))
    }
  } else {
    assert.isTrue(product.v.mul(DENOMINATOR).div(amount.v).eq(price.v) && liquidity.v.gt(product.v))
    return {
      v: liquidity.v
        .mul(price.v)
        .add(DENOMINATOR.subn(1))
        .div(DENOMINATOR)
        .mul(DENOMINATOR)
        .add(liquidity.v.sub(product.v).subn(1))
        .div(liquidity.v.sub(product.v))
    }
  }
}

const getNextPriceYDown = (
  price: Decimal,
  liquidity: Decimal,
  amount: Decimal,
  add: boolean
): Decimal => {
  if (add) {
    return { v: amount.v.mul(DENOMINATOR).div(liquidity.v).add(price.v) }
  } else {
    const quotient: Decimal = {
      v: amount.v.mul(DENOMINATOR).add(liquidity.v.subn(1)).div(liquidity.v)
    }
    assert.isTrue(price.v.gt(quotient.v))
    return { v: price.v.sub(quotient.v) }
  }
}

export const findClosestTicks = (
  ticks: number[],
  current: number,
  tickSpacing: number,
  limit: number,
  maxRange: number = Infinity,
  oneWay: 'up' | 'down' | undefined = undefined
) => {
  if (current % tickSpacing !== 0) {
    throw Error("invalid arguments can't find initialized ticks")
  }

  const currentIndex = Math.floor(current / tickSpacing) + TICK_LIMIT

  let above = currentIndex + 1
  let below = currentIndex

  let found: number[] = []

  let reachedTop = oneWay === 'down' ? true : false
  let reachedBottom = oneWay === 'up' ? true : false

  while (found.length < limit && above - below < maxRange * 2) {
    if (!reachedTop) {
      const valueAbove = ticks[Math.floor(above / 8)] & (1 << above % 8)
      if (valueAbove) found.push(above)
      reachedTop = above >= 2 * TICK_LIMIT
      above++
    }
    if (!reachedBottom) {
      const valueBelow = ticks[Math.floor(below / 8)] & (1 << below % 8)
      if (valueBelow) found.unshift(below)
      reachedBottom = below < 0
      below--
    }

    if (reachedTop && reachedBottom) {
      break
    }
  }

  // two can be added in the last iteration
  if (found.length > limit) found.pop()

  return found.map((i) => (i - TICK_LIMIT) * tickSpacing)
}

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

export const getX = (liquidity: BN, upperSqrtPrice: BN, currentSqrtPrice: BN): BN => {
  if (upperSqrtPrice.lte(new BN(0)) || currentSqrtPrice.lte(new BN(0))) {
    throw new Error('Price cannot be 0')
  }
  if (upperSqrtPrice.lt(currentSqrtPrice)) {
    throw new Error('Upper tick price cannot be lower than current tick price')
  }

  const denominator = currentSqrtPrice.mul(upperSqrtPrice).div(DENOMINATOR)
  const nominator = upperSqrtPrice.sub(currentSqrtPrice)

  return liquidity.mul(nominator).div(denominator)
}

export const getY = (liquidity: BN, currentSqrtPrice: BN, lowerSqrtPrice: BN): BN => {
  if (lowerSqrtPrice.lte(new BN(0)) || currentSqrtPrice.lte(new BN(0))) {
    throw new Error('Price cannot be 0')
  }
  if (lowerSqrtPrice.gt(currentSqrtPrice)) {
    throw new Error('Upper tick price cannot be lower than current tick price')
  }

  const difference = currentSqrtPrice.sub(lowerSqrtPrice)

  return liquidity.mul(difference).div(DENOMINATOR)
}

export const getLiquidityByX = (
  x: BN,
  lowerTick: number,
  upperTick: number,
  currentSqrtPrice: Decimal,
  roundingUp: boolean,
  tickSpacing?: number
) => {
  if ((lowerTick == -Infinity || upperTick == Infinity) && tickSpacing == undefined)
    throw new Error('tickSpacing is required for calculating full range liquidity')

  const lowerTickIndex = lowerTick != -Infinity ? lowerTick : getMinTick(tickSpacing)
  const upperTickIndex = upperTick != Infinity ? upperTick : getMaxTick(tickSpacing)

  const lowerSqrtPrice = calculate_price_sqrt(lowerTickIndex)
  const upperSqrtPrice = calculate_price_sqrt(upperTickIndex)

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
  roundingUp: boolean,
  tickSpacing?: number
) => {
  if ((lowerTick == -Infinity || upperTick == Infinity) && tickSpacing == undefined)
    throw new Error('tickSpacing is required for calculating full range liquidity')

  const lowerTickIndex = lowerTick != -Infinity ? lowerTick : getMinTick(tickSpacing)
  const upperTickIndex = upperTick != Infinity ? upperTick : getMaxTick(tickSpacing)

  const lowerSqrtPrice = calculate_price_sqrt(lowerTickIndex)
  const upperSqrtPrice = calculate_price_sqrt(upperTickIndex)

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

  if (upperSqrtPrice.v.lte(currentSqrtPrice.v)) {
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

export const calculateFeeGrowthInside = (
  lowerTick: Tick,
  upperTick: Tick,
  currentTick: number,
  feeGrowthGlobalX: Decimal,
  feeGrowthGlobalY: Decimal
): [Decimal, Decimal] => {
  const currentAboveLower = currentTick >= lowerTick.index
  const currentBelowUpper = currentTick < upperTick.index

  let feeGrowthBelowX: Decimal
  let feeGrowthBelowY: Decimal
  if (currentAboveLower) {
    feeGrowthBelowX = lowerTick.feeGrowthOutsideX
    feeGrowthBelowY = lowerTick.feeGrowthOutsideY
  } else {
    feeGrowthBelowX = { v: feeGrowthGlobalX.v.sub(lowerTick.feeGrowthOutsideX.v) }
    feeGrowthBelowY = { v: feeGrowthGlobalY.v.sub(lowerTick.feeGrowthOutsideY.v) }
  }

  let feeGrowthAboveX: Decimal
  let feeGrowthAboveY: Decimal
  if (currentBelowUpper) {
    feeGrowthAboveX = upperTick.feeGrowthOutsideX
    feeGrowthAboveY = upperTick.feeGrowthOutsideY
  } else {
    feeGrowthAboveX = { v: feeGrowthGlobalX.v.sub(upperTick.feeGrowthOutsideX.v) }
    feeGrowthAboveY = { v: feeGrowthGlobalY.v.sub(upperTick.feeGrowthOutsideY.v) }
  }

  const feeGrowthInsideX: Decimal = {
    v: feeGrowthGlobalX.v.sub(feeGrowthBelowX.v).sub(feeGrowthAboveX.v)
  }
  const feeGrowthInsideY: Decimal = {
    v: feeGrowthGlobalY.v.sub(feeGrowthBelowY.v).sub(feeGrowthAboveY.v)
  }

  return [feeGrowthInsideX, feeGrowthInsideY]
}
