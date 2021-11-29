import { BN } from '@project-serum/anchor'
import { assert } from 'chai'
import { Decimal, Tickmap } from './market'
import { DENOMINATOR } from './utils'

export const TICK_LIMIT = 100_000
export const MAX_TICK = 221_818
export const MIN_TICK = -MAX_TICK
export const TICK_SEARCH_RANGE = 256

interface SwapResult {
  nextPrice: Decimal,
  amountIn: Decimal,
  amountOut: Decimal,
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

export const findInitialized = (ticks: number[], from: number, to: number, tickSpacing: number) => {
  if (from > to || from % tickSpacing !== 0 || to % tickSpacing !== 0) {
    throw Error("invalid arguments can't find initialized ticks")
  }
  const fromIndex = Math.floor(from / tickSpacing) + TICK_LIMIT
  const toIndex = Math.floor(to / tickSpacing) + TICK_LIMIT

  let found: number[] = []

  let byte = Math.floor(fromIndex / 8)

  for (let i = byte; i < Math.floor((toIndex + 7) / 8); i++) {
    let bit = 8

    while (bit) {
      bit--
      if (ticks[i] & (1 << bit)) found.push(byte * 8 + bit - TICK_LIMIT)
    }
    byte++
  }
  return found.map((i) => i * tickSpacing)
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
    throw new Error('Sqrt only works on non-negtiave inputs')
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

export const calculateSwapStep = (currentPrice: Decimal, 
targetPrice: Decimal, 
liquidity: Decimal, 
amount: Decimal, 
byAmountIn: boolean, 
fee: Decimal): SwapResult => {
  const aToB = currentPrice >= targetPrice
  
  let nextPrice: Decimal
  let amountIn: Decimal = {v: new BN(0)}
  let amountOut: Decimal = {v: new BN(0)}
  let feeAmount: Decimal

  if (byAmountIn) {
    const amountAfterFee: Decimal = {v: fromInteger(1).v.sub(fee.v).mul(amount.v)}

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
    if(!(max && !byAmountIn)) {
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
    feeAmount = {v: amount.v.sub(amountIn.v)}
  } else {
    feeAmount = {v: amountIn.v.mul(fee.v).add(DENOMINATOR.subn(1)).sub(DENOMINATOR)}
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
    deltaPrice = {v: priceA.v.sub(priceB.v)}
  } else {
    deltaPrice = {v: priceB.v.sub(priceA.v)}
  }

  const nominator: Decimal = {v: liquidity.v.mul(deltaPrice.v).div(DENOMINATOR)}

  if (up) {
    return {v: nominator.v.mul(DENOMINATOR).add(priceA.v.mul(priceB.v).div(DENOMINATOR).subn(1)).div(priceA.v.mul(priceB.v).div(DENOMINATOR))}
  } else {
    return {v: nominator.v.mul(DENOMINATOR).div(priceA.v.mul(priceB.v).add(DENOMINATOR.subn(1)).div(DENOMINATOR))}
  }
}

const getDeltaY = (
  priceA: Decimal, 
  priceB: Decimal, 
  liquidity: Decimal, 
  up: boolean): Decimal => {
  let deltaPrice: Decimal
  if (priceA > priceB) {
    deltaPrice = {v: priceA.v.sub(priceB.v)}
  } else {
    deltaPrice = {v: priceB.v.sub(priceA.v)}
  }

  if (up) {
    return {v: liquidity.v.mul(deltaPrice.v).add(DENOMINATOR.subn(1)).div(DENOMINATOR)}
  } else {
    return {v: liquidity.v.mul(deltaPrice.v).div(DENOMINATOR)}
  }
}

const getNextPriceFromInput = (
  price: Decimal,
  liquidity: Decimal,
  amount: Decimal,
  aToB: boolean): Decimal => {
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

  const product: Decimal = {v: amount.v.mul(price.v).div(DENOMINATOR)}
  if (add) {
    if (product.v.mul(DENOMINATOR).div(amount.v).eq(price.v)) {
      const denominator: Decimal = {v: liquidity.v.add(product.v)}

      if (denominator.v.gte(liquidity.v)) {
        return {v: liquidity.v.mul(price.v).add(DENOMINATOR.subn(1)).div(DENOMINATOR)
          .mul(DENOMINATOR).add(denominator.v.subn(1)).div(denominator.v)}
      }
    }
    return {v: liquidity.v.mul(DENOMINATOR)
      .add(liquidity.v.mul(DENOMINATOR).div(price.v).add(amount.v).subn(1))
      .div(liquidity.v.mul(DENOMINATOR).div(price.v).add(amount.v))}
  } else {
    assert.isTrue(product.v.mul(DENOMINATOR).div(amount.v).eq(price.v) && liquidity.v.gt(product.v))
    return {v: liquidity.v.mul(price.v).add(DENOMINATOR.subn(1)).div(DENOMINATOR)
      .mul(DENOMINATOR).add(liquidity.v.sub(product.v).subn(1)).div(liquidity.v.sub(product.v))}
  }
}

const getNextPriceYDown = (
  price: Decimal,
  liquidity: Decimal,
  amount: Decimal,
  add: boolean
): Decimal => {
  if (add) {
    return {v: amount.v.mul(DENOMINATOR).div(liquidity.v).add(price.v)}
  } else {
    const quotient: Decimal = {v: amount.v.mul(DENOMINATOR).add(liquidity.v.subn(1)).div(liquidity.v)}
    assert.isTrue(price.v.gt(quotient.v))
    return {v: price.v.sub(quotient.v)}
  }
}
