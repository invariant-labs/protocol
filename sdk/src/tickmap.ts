import { BN } from '@project-serum/anchor'
import { MAX_TICK, TICK_LIMIT, TICK_SEARCH_RANGE } from '.'
import { Tickmap } from './market'

export const getSearchLimit = (currentTickIndex: BN, tickSpacing: BN, up: boolean): BN => {
  const index = currentTickIndex.div(tickSpacing)
  let limit: BN = new BN(0)
  if (up) {
    const arrayLimit = new BN(TICK_LIMIT).subn(1)
    const rangeLimit = index.add(new BN(TICK_SEARCH_RANGE))
    const priceLimit = new BN(MAX_TICK).div(tickSpacing)

    limit = BN.min(BN.min(arrayLimit, rangeLimit), priceLimit)
  } else {
    const arrayLimit = new BN(-TICK_LIMIT).addn(1)
    const rangeLimit = index.sub(new BN(TICK_SEARCH_RANGE))
    const priceLimit = new BN(-MAX_TICK).div(tickSpacing)

    limit = BN.max(BN.max(arrayLimit, rangeLimit), priceLimit)
  }
  return limit.mul(tickSpacing)
}

export const getPreviousTick = (
  tickmap: Tickmap,
  currentTickIndex: number,
  tickSpacing: number
): number | null => {
  if (currentTickIndex % tickSpacing !== 0) {
    throw new Error('Tick not divisible by spacing')
  }

  const indexWithoutSpacing = currentTickIndex / tickSpacing
  const bitmapIndex = indexWithoutSpacing + TICK_LIMIT
  const limit = getSearchLimit(new BN(currentTickIndex), new BN(tickSpacing), false).toNumber()

  let byteIndex = Math.floor(bitmapIndex / 8)
  let bitIndex = Math.abs(bitmapIndex % 8)

  while (byteIndex * 8 + bitIndex >= limit) {
    let mask = 1 << bitIndex
    const byte = tickmap.bitmap[byteIndex]
    if (byte % (mask << 1) > 0) {
      while ((byte & mask) === 0) {
        mask = mask >> 1
        bitIndex = bitIndex - 1
      }

      const index = byteIndex * 8 + bitIndex
      if (index >= limit) {
        const foundIndex = index - TICK_LIMIT
        if (foundIndex <= -TICK_LIMIT) {
          throw new Error('Tick is at limit')
        }
        return foundIndex * tickSpacing
      } else {
        return null
      }
    }

    byteIndex -= 1
    bitIndex = 7
  }
  return null
}

export const getNextTick = (
  tickmap: Tickmap,
  currentTickIndex: number,
  tickSpacing: number
): number | null => {
  if (currentTickIndex % tickSpacing !== 0) {
    throw new Error('Tick not divisible by spacing')
  }

  const indexWithoutSpacing = currentTickIndex / tickSpacing
  const bitmapIndex = indexWithoutSpacing + TICK_LIMIT + 1
  const limit = getSearchLimit(new BN(currentTickIndex), new BN(tickSpacing), true).toNumber()

  let byteIndex = Math.floor(bitmapIndex / 8)
  let bitIndex = Math.abs(bitmapIndex % 8)

  while (byteIndex * 8 + bitIndex <= limit) {
    let shifted = tickmap.bitmap[byteIndex] >> bitIndex

    if (shifted !== 0) {
      while (shifted % 2 === 0) {
        shifted >>= 1
        bitIndex += 1
      }

      const index = byteIndex * 8 + bitIndex

      if (index <= limit) {
        const foundIndex = index - TICK_LIMIT
        if (foundIndex >= TICK_LIMIT) {
          throw new Error('Tick is at limit')
        }
        return foundIndex * tickSpacing
      } else {
        return null
      }
    }

    byteIndex = byteIndex + 1
    bitIndex = 0
  }
  return null
}
