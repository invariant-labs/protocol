import { BN } from '@project-serum/anchor'
import { MAX_TICK, TICK_LIMIT, TICK_SEARCH_RANGE } from '.'
import { Tickmap, TickPosition } from './market'

export interface TickmapChange {
  [index: number]: 'added' | 'removed'
}

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
  const limit = getSearchLimit(new BN(currentTickIndex), new BN(tickSpacing), false)
  let { byte, bit } = tickToPosition(new BN(currentTickIndex), new BN(tickSpacing))
  const { byte: limitingByte, bit: limitingBit } = tickToPosition(limit, new BN(tickSpacing))

  while (byte > limitingByte || (byte === limitingByte && bit >= limitingBit)) {
    let mask = 1 << bit
    const value = tickmap.bitmap[byte]

    if (value % (mask << 1) > 0) {
      while ((value & mask) === 0) {
        mask >>= 1
        bit -= 1
      }

      if (byte > limitingByte || (byte === limitingByte && bit >= limitingBit)) {
        const index = byte * 8 + bit
        return (index - TICK_LIMIT) * tickSpacing
      } else {
        return null
      }
    }

    byte -= 1
    bit = 7
  }

  return null
}

export const getNextTick = (
  tickmap: Tickmap,
  currentTickIndex: number,
  tickSpacing: number
): number | null => {
  const limit: BN = getSearchLimit(new BN(currentTickIndex), new BN(tickSpacing), true)

  let { byte, bit } = tickToPosition(new BN(currentTickIndex + tickSpacing), new BN(tickSpacing))
  const { byte: limitingByte, bit: limitingBit } = tickToPosition(
    new BN(limit),
    new BN(tickSpacing)
  )

  while (byte < limitingByte || (byte === limitingByte && bit <= limitingBit)) {
    let shifted: number = tickmap.bitmap[byte] >> bit
    if (shifted !== 0) {
      while (shifted % 2 === 0) {
        shifted >>= 1
        bit += 1
      }

      if (byte < limitingByte || (byte === limitingByte && bit <= limitingBit)) {
        const index: number = byte * 8 + bit
        return (index - TICK_LIMIT) * tickSpacing
      } else {
        return null
      }
    }

    byte += 1
    bit = 0
  }

  return null
}

export const tickToPosition = (tick: BN, tickSpacing: BN): TickPosition => {
  if (!tick.mod(tickSpacing).eqn(0)) {
    throw new Error('Tick not divisible by spacing')
  }

  const bitmapIndex = tick.div(tickSpacing).addn(TICK_LIMIT)
  const byte = bitmapIndex.divn(8).toNumber()
  const bit = Math.abs(bitmapIndex.modn(8))

  return { byte, bit }
}

export const findTickmapChanges = (
  currentTickmap: number[],
  nextTickmap: number[],
  offset: number = -TICK_LIMIT
): TickmapChange => {
  if (currentTickmap.length !== nextTickmap.length) {
    throw new Error('bitmap length mismatch')
  }
  let tickmapChanges: TickmapChange = {}

  currentTickmap.forEach((currentByte, i) => {
    const nextByte = nextTickmap[i]
    if (currentByte !== nextByte) {
      const xor = currentByte ^ nextByte
      for (let bit = 0; bit < 8; bit++) {
        if ((xor & (1 << bit)) !== 0) {
          const added = (nextByte & (1 << bit)) !== 0
          tickmapChanges = {
            ...tickmapChanges,
            [i * 8 + bit + offset]: added ? 'added' : 'removed'
          }
        }
      }
    }
  })

  return tickmapChanges
}
