use crate::account::Tickmap;
use std::convert::TryInto;

// not counting tick_spacing

pub const TICK_LIMIT: i32 = 100_000; // If you change it update length of array as well!
pub const TICK_SEARCH_RANGE: i32 = 256;
// const LEN_IN_BYTES: u64 = (TICK_LIMIT / 4) as u64; // Same as in struct but I get errors when i try to use const there
pub const MAX_TICK: i32 = 221_818; // log(1.0001, sqrt(2^64-1))

pub fn get_search_limit(tick: i32, tick_spacing: u16, up: bool) -> i32 {
    assert!(
        (tick % tick_spacing as i32) == 0,
        "tick not divisible by spacing"
    );
    let index = tick / tick_spacing as i32;
    if up {
        (TICK_LIMIT.checked_sub(1).unwrap())
            .min(index.checked_add(TICK_SEARCH_RANGE).unwrap())
            .min(MAX_TICK.checked_div(tick_spacing as i32).unwrap())
            .checked_mul(tick_spacing.into())
            .unwrap()
    } else {
        ((-TICK_LIMIT).checked_add(1).unwrap())
            .max(index.checked_sub(TICK_SEARCH_RANGE).unwrap())
            .max(-MAX_TICK.checked_div(tick_spacing as i32).unwrap())
            .checked_mul(tick_spacing.into())
            .unwrap()
    }
}
impl Tickmap {
    pub fn set(&mut self, value: bool, tick: i32, tick_spacing: u16) {
        assert!(
            self.get(tick, tick_spacing) != value,
            "tick initialize tick again"
        );
        assert!(
            tick % tick_spacing as i32 == 0,
            "tick not divisible by spacing"
        );
        let bitmap_index = tick
            .checked_div(tick_spacing.try_into().unwrap())
            .unwrap()
            .checked_add(TICK_LIMIT)
            .unwrap();
        let byte: usize = (bitmap_index.checked_div(8).unwrap()).try_into().unwrap();
        let bit: u8 = (bitmap_index.checked_rem(8).unwrap())
            .abs()
            .try_into()
            .unwrap();

        self.bitmap[byte] ^= 1 << bit;
    }

    pub fn get(&self, tick: i32, tick_spacing: u16) -> bool {
        assert!(
            (tick % tick_spacing as i32) == 0,
            "tick not divisible by spacing"
        );
        let bitmap_index = tick
            .checked_div(tick_spacing.try_into().unwrap())
            .unwrap()
            .checked_add(TICK_LIMIT)
            .unwrap();
        let byte: usize = (bitmap_index.checked_div(8).unwrap()).try_into().unwrap();
        let bit: u8 = (bitmap_index.checked_rem(8).unwrap())
            .abs()
            .try_into()
            .unwrap();

        match (self.bitmap[byte] >> bit) % 2 {
            0 => false,
            1 => true,
            _ => panic!("Mod 2 will never return more than one."),
        }
    }

    pub fn next_initialized(&self, tick: i32, tick_spacing: u16) -> Option<i32> {
        assert!(
            (tick % tick_spacing as i32) == 0,
            "tick not divisible by spacing"
        );
        // add 1 to not check current tick
        let bitmap_index = tick
            .checked_div(tick_spacing.try_into().unwrap())
            .unwrap()
            .checked_add(TICK_LIMIT)
            .unwrap()
            .checked_add(1)
            .unwrap();
        let limit = get_search_limit(tick, tick_spacing, true)
            .checked_add(TICK_LIMIT)
            .unwrap();

        let mut byte_index: usize = (bitmap_index.checked_div(8).unwrap()).try_into().unwrap();
        let mut bit_index: u8 = (bitmap_index.checked_rem(8).unwrap())
            .abs()
            .try_into()
            .unwrap();

        while byte_index
            .checked_mul(8)
            .unwrap()
            .checked_add(bit_index.into())
            .unwrap()
            <= limit as usize
        {
            let mut shifted = self.bitmap[byte_index] >> bit_index;

            // go through all bits in byte until it is zero
            if shifted != 0 {
                while shifted.checked_rem(2).unwrap() == 0 {
                    shifted >>= 1;
                    bit_index = bit_index.checked_add(1).unwrap();
                }
                // Nothing bad would happen if found would be over limit but checking anyway
                let index: i32 = byte_index
                    .checked_mul(8)
                    .unwrap()
                    .checked_add(bit_index.into())
                    .unwrap()
                    .try_into()
                    .unwrap();

                return if index <= limit {
                    let found_index = index.checked_sub(TICK_LIMIT).unwrap();
                    assert!(found_index < TICK_LIMIT, "tick would be at limit");
                    Some(
                        found_index
                            .checked_mul(tick_spacing.try_into().unwrap())
                            .unwrap(),
                    )
                } else {
                    None
                };
            }

            // go to the text byte
            byte_index = byte_index.checked_add(1).unwrap();
            bit_index = 0;
        }

        return None;
    }

    pub fn prev_initialized(&self, tick: i32, tick_spacing: u16) -> Option<i32> {
        assert!(
            (tick % tick_spacing as i32) == 0,
            "tick not divisible by spacing"
        );
        // don't subtract 1 to check the current tick
        let bitmap_index = tick
            .checked_div(tick_spacing.try_into().unwrap())
            .unwrap()
            .checked_add(TICK_LIMIT)
            .unwrap();
        let limit = get_search_limit(tick, tick_spacing, false)
            .checked_add(TICK_LIMIT)
            .unwrap();

        let mut byte_index: usize = (bitmap_index.checked_div(8).unwrap()).try_into().unwrap();
        let mut bit_index: u8 = (bitmap_index.checked_rem(8).unwrap())
            .abs()
            .try_into()
            .unwrap();

        while byte_index
            .checked_mul(8)
            .unwrap()
            .checked_add(bit_index.into())
            .unwrap()
            >= limit as usize
        {
            let mut mask = 1u16.checked_shl(bit_index.try_into().unwrap()).unwrap();
            let byte = self.bitmap[byte_index] as u16;

            if byte.checked_rem(mask.checked_shl(1).unwrap()).unwrap() > 0 {
                while byte & mask == 0 {
                    mask >>= 1;
                    bit_index = bit_index.checked_sub(1).unwrap();
                }

                let index: i32 = byte_index
                    .checked_mul(8)
                    .unwrap()
                    .checked_add(bit_index.into())
                    .unwrap()
                    .try_into()
                    .unwrap();

                return if index >= limit {
                    let found_index = index.checked_sub(TICK_LIMIT).unwrap();
                    assert!(found_index > -TICK_LIMIT, "tick would be at limit");

                    Some(
                        found_index
                            .checked_mul(tick_spacing.try_into().unwrap())
                            .unwrap(),
                    )
                } else {
                    None
                };
            }

            // go to the text byte
            byte_index = byte_index.checked_sub(1).unwrap();
            bit_index = 7;
        }

        return None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set() {
        {
            let mut map = Tickmap::default();

            //zero
            {
                let index = 0;

                assert_eq!(map.get(index, 1), false);
                map.set(true, index, 1);
                assert_eq!(map.get(index, 1), true);
                map.set(false, index, 1);
                assert_eq!(map.get(index, 1), false);
            }
            // small
            {
                let index = 7;

                assert_eq!(map.get(index, 1), false);
                map.set(true, index, 1);
                assert_eq!(map.get(index, 1), true);
                map.set(false, index, 1);
                assert_eq!(map.get(index, 1), false);
            }
            // big
            {
                let index = TICK_LIMIT - 1;

                assert_eq!(map.get(index, 1), false);
                map.set(true, index, 1);
                assert_eq!(map.get(index, 1), true);
                map.set(false, index, 1);
                assert_eq!(map.get(index, 1), false);
            }
            // negative
            {
                let index = TICK_LIMIT - 40;

                assert_eq!(map.get(index, 1), false);
                map.set(true, index, 1);
                assert_eq!(map.get(index, 1), true);
                map.set(false, index, 1);
                assert_eq!(map.get(index, 1), false);
            }
            // tick spacing
            {
                let index = 20000;
                let tick_spacing = 1000;

                assert_eq!(map.get(index, tick_spacing), false);
                map.set(true, index, tick_spacing);
                assert_eq!(map.get(index, tick_spacing), true);
                map.set(false, index, tick_spacing);
                assert_eq!(map.get(index, tick_spacing), false);
            }
        }
    }

    #[test]
    fn test_next_initialized() {
        // Simple
        {
            let mut map = Tickmap::default();
            map.set(true, 5, 1);
            assert_eq!(map.next_initialized(0, 1), Some(5));
        }
        // Multiple
        {
            let mut map = Tickmap::default();
            map.set(true, 50, 10);
            map.set(true, 100, 10);
            assert_eq!(map.next_initialized(0, 10), Some(50));
            assert_eq!(map.next_initialized(50, 10), Some(100));
        }
        // Current is last
        {
            let mut map = Tickmap::default();

            map.set(true, 0, 10);
            assert_eq!(map.next_initialized(0, 10), None);
        }
        // Just below limit
        {
            let mut map = Tickmap::default();

            map.set(true, 0, 1);
            assert_eq!(map.next_initialized(-TICK_SEARCH_RANGE, 1), Some(0));
        }
        // At limit
        {
            let mut map = Tickmap::default();

            map.set(true, 0, 1);
            assert_eq!(map.next_initialized(-TICK_SEARCH_RANGE - 1, 1), None);
        }
        // Farther than limit
        {
            let mut map = Tickmap::default();

            map.set(true, TICK_LIMIT - 10, 1);
            assert_eq!(map.next_initialized(-TICK_LIMIT + 1, 1), None);
        }
    }

    #[test]
    fn test_prev_initialized() {
        // Simple
        {
            let mut map = Tickmap::default();
            map.set(true, -5, 1);
            assert_eq!(map.prev_initialized(0, 1), Some(-5));
        }
        // Multiple
        {
            let mut map = Tickmap::default();
            map.set(true, -50, 10);
            map.set(true, -100, 10);
            assert_eq!(map.prev_initialized(0, 10), Some(-50));
            assert_eq!(map.prev_initialized(-50, 10), Some(-50));
        }
        // Current is last
        {
            let mut map = Tickmap::default();

            map.set(true, 0, 10);
            assert_eq!(map.prev_initialized(0, 10), Some(0));
        }
        // Next is last
        {
            let mut map = Tickmap::default();

            map.set(true, 10, 10);
            assert_eq!(map.prev_initialized(0, 10), None);
        }
        // Just below limit
        {
            let mut map = Tickmap::default();

            map.set(true, 0, 1);
            assert_eq!(map.prev_initialized(TICK_SEARCH_RANGE, 1), Some(0));
        }
        // At limit
        {
            let mut map = Tickmap::default();

            map.set(true, 0, 1);
            assert_eq!(map.prev_initialized(TICK_SEARCH_RANGE + 1, 1), None);
        }
        // Farther than limit
        {
            let mut map = Tickmap::default();

            map.set(true, -TICK_LIMIT + 1, 1);
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
        // Up to limit
        {
            let step = 2u16;
            let result = get_search_limit(step as i32 * TICK_LIMIT - 10, step, true);
            let expected = step as i32 * (TICK_LIMIT - 1);
            assert_eq!(result, expected);
        }
        // Down to limit
        {
            let step = 2u16;
            let result = get_search_limit(step as i32 * (-TICK_LIMIT + 1), step, false);
            let expected = step as i32 * -(TICK_LIMIT - 1);
            assert_eq!(result, expected);
        }
    }
}
