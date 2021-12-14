import { MAX_TICK, TICK_LIMIT, TICK_SEARCH_RANGE } from "."
import { Tickmap } from "./market"

export const getSearchLimit = (currentTickIndex: number, tickSpacing: number, up: boolean): number => {
  if (currentTickIndex % tickSpacing != 0) {
    throw new Error("Tick not divisible by spacing")
  }

  const index = currentTickIndex / tickSpacing
  if (up) {
    return Math.min(Math.min(TICK_LIMIT - 1, index + TICK_SEARCH_RANGE), MAX_TICK / tickSpacing) * tickSpacing
  } else {
    return Math.max(Math.max((-TICK_LIMIT) + 1, index - TICK_SEARCH_RANGE), (-MAX_TICK) / tickSpacing) * tickSpacing
  }
}

export const getPreviousTick = (tickmap: Tickmap, currentTickIndex: number, tickSpacing: number): Number => {
  if (currentTickIndex % tickSpacing !== 0) {
    throw new Error("Tick not divisible by spacing")
  }

  let indexWithoutSpacing = currentTickIndex / tickSpacing
  let bitmapIndex = indexWithoutSpacing + TICK_LIMIT
  let limit = getSearchLimit(currentTickIndex, tickSpacing, false) + TICK_LIMIT

  let byteIndex = Math.floor(bitmapIndex / 8)
  let bitIndex = Math.abs(bitmapIndex % 8)

  while (byteIndex * 8 + bitIndex >= limit) {
    let mask = 1 << bitIndex
    let byte = tickmap.bitmap[byteIndex]
    if (byte % (mask << 1) > 0) {
      while ((byte & mask) === 0) {
        mask = mask >> 1
        bitIndex = bitIndex - 1
      }

      let index = byteIndex * 8 + bitIndex
      if (index >= limit) {
        let foundIndex = index - TICK_LIMIT
        if (foundIndex <= -TICK_LIMIT) {
          throw new Error("Tick is at limit")
        }
        return new Number(foundIndex * tickSpacing)
      } else {
        return new Number(null)
      }
    }

    byteIndex -= 1
    bitIndex = 7
  }
  return new Number(null)
}

export const getNextTick = (tickmap: Tickmap, currentTickIndex: number, tickSpacing: number): Number => {
  if (currentTickIndex % tickSpacing != 0) {
    throw new Error("Tick not divisible by spacing")
  }

  let indexWithoutSpacing = currentTickIndex / tickSpacing
  let bitmapIndex = indexWithoutSpacing + TICK_LIMIT + 1
  let limit = getSearchLimit(currentTickIndex, tickSpacing, true) + TICK_LIMIT

  let byteIndex = bitmapIndex / 8
  let bitIndex = Math.abs(bitmapIndex % 8)

  while ((byteIndex * 8 + bitIndex) <= limit) {
    let shifted = tickmap.bitmap[byteIndex] >> bitIndex

    if (shifted != 0) {
      while (shifted % 2 == 0) {
        shifted >>= 1
        bitIndex += 1
      }

      let index = byteIndex * 8 + bitIndex

      if (index <= limit) {
        let foundIndex = index - TICK_LIMIT
        if (foundIndex >= TICK_LIMIT) {
          throw new Error("Tick is at limit")
        }
        return new Number(foundIndex * tickSpacing)
      } else {
        return new Number(null)
      }
    }

    byteIndex = byteIndex + 1
    bitIndex = 0
  }

  return new Number(null)
}
