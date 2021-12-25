use anchor_lang::prelude::*;
use std::convert::TryInto;

pub const TICK_LIMIT: i32 = 100_000; // If you change it update length of array as well!
pub const TICK_SEARCH_RANGE: i32 = 256;
// const LEN_IN_BYTES: u64 = (TICK_LIMIT / 4) as u64; // Same as in struct but I get errors when i try to use const there
pub const MAX_TICK: i32 = 221_818; // log(1.0001, sqrt(2^64-1))

#[account(zero_copy)]
pub struct Tickmap {
    pub bitmap: [u8; 25000], // Tick limit / 4
}

impl Default for Tickmap {
    fn default() -> Self {
        Tickmap { bitmap: [0; 25000] }
    }
}

fn tick_to_position(tick: i32, tick_spacing: u16) -> (usize, u8) {
    // assert!(
    //     (tick % tick_spacing as i32) == 0,
    //     "tick not divisible by spacing"
    // );

    let bitmap_index = tick
        .checked_div(tick_spacing.try_into().unwrap())
        .unwrap()
        .checked_add(TICK_LIMIT)
        .unwrap();

    let byte: usize = (bitmap_index.checked_div(8).unwrap()).try_into().unwrap();
    let bit: u8 = (bitmap_index % 8).abs().try_into().unwrap();

    (byte, bit)
}

pub fn get_search_limit(tick: i32, tick_spacing: u16, up: bool) -> i32 {
    // assert!(
    //     (tick % tick_spacing as i32) == 0,
    //     "tick not divisible by spacing"
    // );
    let index = tick / tick_spacing as i32;
<<<<<<< HEAD

    let limit = if up {
=======
    if up {
>>>>>>> 313b7a94ebcb2178ba5c2b26ef4af4a0eda4151d
        // ticks are limited by amount of space in the bitmap...
        let array_limit = TICK_LIMIT.checked_sub(1).unwrap();
        // ...search range is limited to 256 at the time ...
        let range_limit = index.checked_add(TICK_SEARCH_RANGE).unwrap();
        // ...also ticks for prices over 2^64 aren't needed
        let price_limit = MAX_TICK.checked_div(tick_spacing as i32).unwrap();

        array_limit.min(range_limit).min(price_limit)
    } else {
        let array_limit = (-TICK_LIMIT).checked_add(1).unwrap();
        let range_limit = index.checked_sub(TICK_SEARCH_RANGE).unwrap();
        let price_limit = -MAX_TICK.checked_div(tick_spacing as i32).unwrap();

        array_limit.max(range_limit).max(price_limit)
<<<<<<< HEAD
    };

    limit.checked_mul(tick_spacing as i32).unwrap()
=======
    }
>>>>>>> 313b7a94ebcb2178ba5c2b26ef4af4a0eda4151d
}

impl Tickmap {
    pub fn flip(&mut self, value: bool, tick: i32, tick_spacing: u16) {
        assert!(
            self.get(tick, tick_spacing) != value,
            "tick initialize tick again"
        );
        // assert!(
        //     tick % tick_spacing as i32 == 0,
        //     "tick not divisible by spacing"
        // );

        let (byte, bit) = tick_to_position(tick, tick_spacing);

        self.bitmap[byte] ^= 1 << bit;
    }

    pub fn get(&self, tick: i32, tick_spacing: u16) -> bool {
        // assert!(
        //     (tick % tick_spacing as i32) == 0,
        //     "tick not divisible by spacing"
        // );

        let (byte, bit) = tick_to_position(tick, tick_spacing);
        let value = (self.bitmap[byte] >> bit) % 2;

        return if (value) == 1 { true } else { false };
    }

    pub fn next_initialized(&self, tick: i32, tick_spacing: u16) -> Option<i32> {
<<<<<<< HEAD
        assert!(
            (tick % tick_spacing as i32) == 0,
            "tick not divisible by spacing"
        );

        let limit = get_search_limit(tick, tick_spacing, true);
=======
        // assert!(
        //     (tick % tick_spacing as i32) == 0,
        //     "tick not divisible by spacing"
        // );
>>>>>>> 313b7a94ebcb2178ba5c2b26ef4af4a0eda4151d

        // add 1 to not check current tick
        let (mut byte, mut bit) = tick_to_position(tick + tick_spacing as i32, tick_spacing);
        let (limiting_byte, limiting_bit) = tick_to_position(limit, tick_spacing);

        while byte < limiting_byte || (byte == limiting_byte && bit <= limiting_bit) {
            // ignore some bits on first loop
            let mut shifted = self.bitmap[byte] >> bit;

            // go through all bits in byte until it is zero
            if shifted != 0 {
                while shifted.checked_rem(2).unwrap() == 0 {
                    shifted >>= 1;
                    bit = bit.checked_add(1).unwrap();
                }

                return if byte < limiting_byte || (byte == limiting_byte && bit <= limiting_bit) {
                    let index: i32 = byte
                        .checked_mul(8)
                        .unwrap()
                        .checked_add(bit.into())
                        .unwrap()
                        .try_into()
                        .unwrap();
                    Some(
                        index
                            .checked_sub(TICK_LIMIT)
                            .unwrap()
                            .checked_mul(tick_spacing.try_into().unwrap())
                            .unwrap(),
                    )
                } else {
                    None
                };
            }

            // go to the text byte
            byte = byte.checked_add(1).unwrap();
            bit = 0;
        }

        return None;
    }

    pub fn prev_initialized(&self, tick: i32, tick_spacing: u16) -> Option<i32> {
        // assert!(
        //     (tick % tick_spacing as i32) == 0,
        //     "tick not divisible by spacing"
        // );
        // don't subtract 1 to check the current tick
        let limit = get_search_limit(tick, tick_spacing, false);
        let (mut byte, mut bit) = tick_to_position(tick as i32, tick_spacing);
        let (limiting_byte, limiting_bit) = tick_to_position(limit, tick_spacing);

        while byte > limiting_byte || (byte == limiting_byte && bit >= limiting_bit) {
            let mut mask = 1u16.checked_shl(bit.try_into().unwrap()).unwrap();
            let value = self.bitmap[byte] as u16;

            if value.checked_rem(mask.checked_shl(1).unwrap()).unwrap() > 0 {
                while value & mask == 0 {
                    mask >>= 1;
                    bit = bit.checked_sub(1).unwrap();
                }

                return if byte > limiting_byte || (byte == limiting_byte && bit >= limiting_bit) {
                    let index: i32 = byte
                        .checked_mul(8)
                        .unwrap()
                        .checked_add(bit.into())
                        .unwrap()
                        .try_into()
                        .unwrap();

                    Some(
                        index
                            .checked_sub(TICK_LIMIT)
                            .unwrap()
                            .checked_mul(tick_spacing.try_into().unwrap())
                            .unwrap(),
                    )
                } else {
                    None
                };
            }

            // go to the text byte
            byte = byte.checked_sub(1).unwrap();
            bit = 7;
        }

        return None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flip() {
        let mut map = Tickmap::default();

        //zero
        {
            let index = 0;

            assert_eq!(map.get(index, 1), false);
            map.flip(true, index, 1);
            assert_eq!(map.get(index, 1), true);
            map.flip(false, index, 1);
            assert_eq!(map.get(index, 1), false);
        }
        // small
        {
            let index = 7;

            assert_eq!(map.get(index, 1), false);
            map.flip(true, index, 1);
            assert_eq!(map.get(index, 1), true);
            map.flip(false, index, 1);
            assert_eq!(map.get(index, 1), false);
        }
        // big
        {
            let index = TICK_LIMIT - 1;

            assert_eq!(map.get(index, 1), false);
            map.flip(true, index, 1);
            assert_eq!(map.get(index, 1), true);
            map.flip(false, index, 1);
            assert_eq!(map.get(index, 1), false);
        }
        // negative
        {
            let index = TICK_LIMIT - 40;

            assert_eq!(map.get(index, 1), false);
            map.flip(true, index, 1);
            assert_eq!(map.get(index, 1), true);
            map.flip(false, index, 1);
            assert_eq!(map.get(index, 1), false);
        }
        // tick spacing
        {
            let index = 20000;
            let tick_spacing = 1000;

            assert_eq!(map.get(index, tick_spacing), false);
            map.flip(true, index, tick_spacing);
            assert_eq!(map.get(index, tick_spacing), true);
            map.flip(false, index, tick_spacing);
            assert_eq!(map.get(index, tick_spacing), false);
        }
    }

    #[test]
    fn test_next_initialized() {
        // Simple
        {
            let mut map = Tickmap::default();
            map.flip(true, 5, 1);
            assert_eq!(map.next_initialized(0, 1), Some(5));
        }
        // Multiple
        {
            let mut map = Tickmap::default();
            map.flip(true, 50, 10);
            map.flip(true, 100, 10);
            assert_eq!(map.next_initialized(0, 10), Some(50));
            assert_eq!(map.next_initialized(50, 10), Some(100));
        }
        // Current is last
        {
            let mut map = Tickmap::default();

            map.flip(true, 0, 10);
            assert_eq!(map.next_initialized(0, 10), None);
        }
        // Just below limit
        {
            let mut map = Tickmap::default();

            map.flip(true, 0, 1);
            assert_eq!(map.next_initialized(-TICK_SEARCH_RANGE, 1), Some(0));
        }
        // At limit
        {
            let mut map = Tickmap::default();

            map.flip(true, 0, 1);
            assert_eq!(map.next_initialized(-TICK_SEARCH_RANGE - 1, 1), None);
        }
        // Farther than limit
        {
            let mut map = Tickmap::default();

            map.flip(true, TICK_LIMIT - 10, 1);
            assert_eq!(map.next_initialized(-TICK_LIMIT + 1, 1), None);
        }
        // Hitting the limit
        {
            let map = Tickmap::default();

            assert_eq!(map.next_initialized(MAX_TICK - 22, 4), None);
        }
        // Already at limit
        {
            let map = Tickmap::default();

            assert_eq!(map.next_initialized(MAX_TICK - 2, 4), None);
        }
    }

    #[test]
    fn test_prev_initialized() {
        // Simple
        {
            let mut map = Tickmap::default();
            map.flip(true, -5, 1);
            assert_eq!(map.prev_initialized(0, 1), Some(-5));
        }
        // Multiple
        {
            let mut map = Tickmap::default();
            map.flip(true, -50, 10);
            map.flip(true, -100, 10);
            assert_eq!(map.prev_initialized(0, 10), Some(-50));
            assert_eq!(map.prev_initialized(-50, 10), Some(-50));
        }
        // Current is last
        {
            let mut map = Tickmap::default();

            map.flip(true, 0, 10);
            assert_eq!(map.prev_initialized(0, 10), Some(0));
        }
        // Next is last
        {
            let mut map = Tickmap::default();

            map.flip(true, 10, 10);
            assert_eq!(map.prev_initialized(0, 10), None);
        }
        // Just below limit
        {
            let mut map = Tickmap::default();

            map.flip(true, 0, 1);
            assert_eq!(map.prev_initialized(TICK_SEARCH_RANGE, 1), Some(0));
        }
        // At limit
        {
            let mut map = Tickmap::default();

            map.flip(true, 0, 1);
            assert_eq!(map.prev_initialized(TICK_SEARCH_RANGE + 1, 1), None);
        }
        // Farther than limit
        {
            let mut map = Tickmap::default();

            map.flip(true, -TICK_LIMIT + 1, 1);
            assert_eq!(map.prev_initialized(TICK_LIMIT - 1, 1), None);
        }
    }

    #[test]
    fn test_get_search_limit() {
        // Simple up
        {
            let result = get_search_limit(0, 1, true);
            assert_eq!(result, TICK_SEARCH_RANGE);
        }
        // Simple down
        {
            let result = get_search_limit(0, 1, false);
            assert_eq!(result, -TICK_SEARCH_RANGE);
        }
        // Less simple up
        {
            let start = 60;
            let step = 12;
            let result = get_search_limit(start, step, true);
            let expected = start + TICK_SEARCH_RANGE * step as i32;
            assert_eq!(result, expected);
        }
        // Less simple down
        {
            let start = 60;
            let step = 12;
            let result = get_search_limit(start, step, false);
            let expected = start - TICK_SEARCH_RANGE * step as i32;
            assert_eq!(result, expected);
        }
        // Up to array limit
        {
            let step = 2u16;
            let result = get_search_limit(step as i32 * TICK_LIMIT - 10, step, true);
            let expected = step as i32 * (TICK_LIMIT - 1);
            assert_eq!(result, expected);
        }
        // Down to array limit
        {
            let step = 2u16;
            let result = get_search_limit(step as i32 * (-TICK_LIMIT + 1), step, false);
            let expected = step as i32 * -(TICK_LIMIT - 1);
            assert_eq!(result, expected);
        }
        // Up to price limit
        {
            let step = 4u16;
            let result = get_search_limit(MAX_TICK - 22, step, true);
            let expected = MAX_TICK - 2;
            assert_eq!(result, expected);
        }
        // At the price limit
        {
            let step = 4u16;
            let result = get_search_limit(MAX_TICK - 22, step, true);
            let expected = MAX_TICK - 2;
            assert_eq!(result, expected);
        }
    }
}
