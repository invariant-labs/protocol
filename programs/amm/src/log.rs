use crate::{
    decimal::{Decimal, DENOMINATOR},
    math::calculate_price_sqrt,
    structs::MAX_TICK,
    uint::U256,
};

const LOG_SCALE: u128 = 64;
const LOG_DOUBLE_SCALE: u128 = 128;
const LOG_ONE: u128 = 1 << LOG_SCALE;
const LOG_HALF: u128 = LOG_ONE >> 1;
const LOG_DOUBLE: u128 = LOG_ONE << 1;
const LOG2_SQRT_10001: u128 = 1330584781654115;
const LOG2_NEGATIVE_MAX_LOSE: u128 = 1200000000000000; // max accuracy in <-MAX_TICK, 0> domain
const LOG2_MIN_BINARY_POSITION: i32 = 14; // accuracy = 2^(-14)
const LOG2_ACCURACY: u128 = 1u128 << (63 - LOG2_MIN_BINARY_POSITION);

fn decimal_to_x64(decimal: Decimal) -> u128 {
    decimal.v * LOG_ONE / DENOMINATOR
}

fn align_tick_to_spacing(accurate_tick: i32, tick_spacing: i32) -> i32 {
    match accurate_tick > 0 {
        true => accurate_tick - (accurate_tick % tick_spacing),
        false => accurate_tick - (accurate_tick.rem_euclid(tick_spacing))
    }    
}

fn log2_floor_x64(mut sqrt_price_x64: u128) -> u128 {
    let mut msb = 0;

    if sqrt_price_x64 >= 1u128 << 64 {
        sqrt_price_x64 >>= 64;
        msb |= 64;
    };
    if sqrt_price_x64 >= 1u128 << 32 {
        sqrt_price_x64 >>= 32;
        msb |= 32;
    };
    if sqrt_price_x64 >= 1u128 << 16 {
        sqrt_price_x64 >>= 16;
        msb |= 16;
    };
    if sqrt_price_x64 >= 1u128 << 8 {
        sqrt_price_x64 >>= 8;
        msb |= 8;
    };
    if sqrt_price_x64 >= 1u128 << 4 {
        sqrt_price_x64 >>= 4;
        msb |= 4;
    };
    if sqrt_price_x64 >= 1u128 << 2 {
        sqrt_price_x64 >>= 2;
        msb |= 2;
    };
    if sqrt_price_x64 >= 1u128 << 1 {
        msb |= 1;
    };

    msb
}

fn log2_iterative_approximation_x64(mut sqrt_price_x64: u128) -> (bool, u128) {
    let one = U256::from(LOG_ONE);
    let two = U256::from(LOG_DOUBLE);
    let mut sign = true;

    // log2(x) = -log2(1/x), when x < 1
    if sqrt_price_x64 < LOG_ONE {
        sign = false;
        sqrt_price_x64 =
            ((U256::from(1) << LOG_DOUBLE_SCALE) / U256::from(sqrt_price_x64 + 1)).as_u128();
    }
    let log2_floor = log2_floor_x64(sqrt_price_x64 >> LOG_SCALE);
    let mut result = log2_floor << LOG_SCALE;
    let mut y: U256 = U256::from(sqrt_price_x64) >> log2_floor;

    if y == one {
        return (sign, result);
    };
    let mut delta = LOG_HALF;
    while delta > LOG2_ACCURACY {
        y = y * y / one;
        if y >= two {
            result |= delta;
            y >>= 1;
        }
        delta >>= 1;
    }
    (sign, result)
}

pub fn get_tick_at_sqrt_price(sqrt_price_decimal: Decimal, tick_spacing: u16) -> i32 {
    let sqrt_price_x64: u128 = decimal_to_x64(sqrt_price_decimal);
    let (log2_sign, log2_sqrt_price) = log2_iterative_approximation_x64(sqrt_price_x64);

    let abs_floor_tick: i32 = match log2_sign {
        true => log2_sqrt_price / LOG2_SQRT_10001,
        false => (log2_sqrt_price + LOG2_NEGATIVE_MAX_LOSE) / LOG2_SQRT_10001,
    } as i32;

    let nearer_tick = match log2_sign {
        true => abs_floor_tick,
        false => -abs_floor_tick,
    };
    let farther_tick = match log2_sign {
        true => abs_floor_tick + 1,
        false => -abs_floor_tick - 1,
    };
    let farther_tick_with_spacing = align_tick_to_spacing(farther_tick, tick_spacing as i32);
    let nearer_tick_with_spacing = align_tick_to_spacing(nearer_tick, tick_spacing as i32);
    if farther_tick_with_spacing == nearer_tick_with_spacing {
        return nearer_tick_with_spacing;
    };
    
    let accurate_tick = match log2_sign {
        true => {
            if farther_tick > MAX_TICK {
                return nearer_tick;
            }
            let farther_tick_sqrt_price_decimal = calculate_price_sqrt(farther_tick);
            match sqrt_price_decimal >= farther_tick_sqrt_price_decimal {
                true => farther_tick_with_spacing,
                false => nearer_tick_with_spacing,
            }
        }
        false => {
            let nearer_tick_sqrt_price_decimal = calculate_price_sqrt(nearer_tick);
            match nearer_tick_sqrt_price_decimal <= sqrt_price_decimal {
                true => nearer_tick_with_spacing,
                false => farther_tick_with_spacing,
            }
        }
    };
    match tick_spacing > 1 {
        true => align_tick_to_spacing(accurate_tick, tick_spacing as i32),
        false => accurate_tick,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{decimal::Decimal, structs::MAX_TICK};

    #[test]
    fn test_log2_x64() {
        // log2 of 1
        {
            let sqrt_price_decimal = Decimal::from_integer(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 0u128);
        }
        // log2 > 0 when x > 1
        {
            let sqrt_price_decimal = Decimal::from_integer(879);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 180402942073393643520);
        }
        // log2 < 0 when x < 1
        {
            let sqrt_price_decimal = Decimal::from_decimal(59, 4);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 136598680297774514176);
        }
        // log2 of max sqrt price
        {
            let max_sqrt_price = Decimal::new(4294967295999999999884);
            let sqrt_price_x64 = decimal_to_x64(max_sqrt_price);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 440307928368758652928);
        }
        // log2 of min sqrt price
        {
            let min_sqrt_price = calculate_price_sqrt(-MAX_TICK);
            let sqrt_price_x64 = decimal_to_x64(min_sqrt_price);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 295146779279445983232);
        }
        // log2 of sqrt(1.0001^(-19_999)) - 1
        {
            let mut sqrt_price_decimal = calculate_price_sqrt(-19_999);
            sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 26609518398318575616);
        }
        // log2 of sqrt(1.0001^(19_999)) + 1
        {
            let mut sqrt_price_decimal = calculate_price_sqrt(19_999);
            sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 26609518398318575616);
        }
    }

    #[test]
    fn test_get_tick_at_sqrt_price_x64() {
        // around 0 tick
        {
            // get tick at 1
            {
                let sqrt_price_decimal = Decimal::from_integer(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, 0);
            }
            // get tick slightly below 1
            {
                let sqrt_price_decimal = Decimal::new(999999999999);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, -1);
            }
            // get tick slightly above 1
            {
                let sqrt_price_decimal = Decimal::new(1000000000001);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, 0);
            }
        }
        // around 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(1);
            // get tick at sqrt(1.0001)
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, 1);
            }
            // get tick slightly below sqrt(1.0001)
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, 0);
            }
            // get tick slightly above sqrt(1.0001)
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, 1);
            }
        }
        // around -1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(-1);
            // get tick at sqrt(1.0001^(-1))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, -1);
            }
            // get tick slightly below sqrt(1.0001^(-1))
            {
                let sqrt_price_decimal = calculate_price_sqrt(-1) - Decimal::new(1);

                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, -2);
            }
            // get tick slightly above sqrt(1.0001^(-1))
            {
                let sqrt_price_decimal = calculate_price_sqrt(-1) + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, -1);
            }
        }
        // around max - 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(MAX_TICK - 1);
            // get tick at sqrt(1.0001^(MAX_TICK - 1))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, MAX_TICK - 1);
            }
            // get tick slightly below sqrt(1.0001^(MAX_TICK - 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, MAX_TICK - 2);
            }
            // get tick slightly above sqrt(1.0001^(MAX_TICK - 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, MAX_TICK - 1);
            }
        }
        // around min + 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(-(MAX_TICK - 1));
            // get tick at sqrt(1.0001^(-MAX_TICK + 1))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, -(MAX_TICK - 1));
            }
            // get tick slightly below sqrt(1.0001^(-MAX_TICK + 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, -MAX_TICK);
            }
            // get tick slightly above sqrt(1.0001^(-MAX_TICK + 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, -(MAX_TICK - 1));
            }
        }
        //get tick slightly below at max tick
        {
            let max_sqrt_price = Decimal::from_decimal(655354, 1);
            let sqrt_price_decimal = max_sqrt_price - Decimal::new(1);
            let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
            assert_eq!(tick, MAX_TICK);
        }
        // around 19_999 tick
        {
            let expected_tick = 19_999;
            let sqrt_price_decimal = calculate_price_sqrt(expected_tick);
            // get tick at sqrt(1.0001^19_999)
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, expected_tick);
            }
            // get tick slightly below sqrt(1.0001^19_999)
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);

                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, expected_tick - 1);
            }
            // get tick slightly above sqrt(1.0001^19_999)
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, expected_tick);
            }
        }
        // around -19_999 tick
        {
            let expected_tick = -19_999;
            let sqrt_price_decimal = calculate_price_sqrt(expected_tick);
            // get tick at sqrt(1.0001^(-19_999))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, expected_tick);
            }
            // get tick slightly below sqrt(1.0001^(-19_999))
            {
                // let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(150);
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, expected_tick - 1);
            }
            // get tick slightly above sqrt(1.0001^(-19_999))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                assert_eq!(tick, expected_tick);
            }
        }
        //get tick slightly above at min tick
        {
            let min_sqrt_price = Decimal::new(15258932);
            let sqrt_price_decimal = min_sqrt_price + Decimal::new(1);
            let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
            assert_eq!(tick, -MAX_TICK);
        }
    }

    #[test]
    fn test_align_tick_with_spacing() {
        // zero
        {
            let accurate_tick = 0;
            let tick_spacing = 3;

            let tick_with_spacing = align_tick_to_spacing(accurate_tick, tick_spacing);
            assert_eq!(tick_with_spacing, 0);
        }
        // positive
        {
            let accurate_tick = 14;
            let tick_spacing = 10;

            let tick_with_spacing = align_tick_to_spacing(accurate_tick, tick_spacing);
            assert_eq!(tick_with_spacing, 10);
        }
        // positive at tick
        {
            let accurate_tick = 20;
            let tick_spacing = 10;

            let tick_with_spacing = align_tick_to_spacing(accurate_tick, tick_spacing);
            assert_eq!(tick_with_spacing, 20); 
        }
        // negative
        {
            let accurate_tick = -14;
            let tick_spacing = 10;
    
            let tick_with_spacing = align_tick_to_spacing(accurate_tick, tick_spacing);
            assert_eq!(tick_with_spacing, -20);
        }
        // negative at tick
        {
            let accurate_tick = -120;
            let tick_spacing = 3;
    
            let tick_with_spacing = align_tick_to_spacing(accurate_tick, tick_spacing);
            assert_eq!(tick_with_spacing, -120);
        }
    }
    
    #[test]
    fn test_all_positive_ticks() {
        for n in 0..MAX_TICK {
            {
                let expected_tick = n;
                let sqrt_price_decimal = calculate_price_sqrt(expected_tick);
                // get tick at sqrt(1.0001^(n))
                {
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                    assert_eq!(tick, expected_tick);
                }
                // get tick slightly below sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                    assert_eq!(tick, expected_tick - 1);
                }
                // get tick slightly above sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                    assert_eq!(tick, expected_tick);
                }
            }
        }
    }

    #[test]
    fn test_all_negative_ticks() {
        for n in 0..MAX_TICK {
            {
                let expected_tick = -n;
                let sqrt_price_decimal = calculate_price_sqrt(expected_tick);
                // get tick at sqrt(1.0001^(n))
                {
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                    assert_eq!(tick, expected_tick);
                }
                // get tick slightly below sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                    assert_eq!(tick, expected_tick - 1);
                }
                // get tick slightly above sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, 1);
                    assert_eq!(tick, expected_tick);
                }
            }
        }
    }

    #[test]
    fn test_all_positive_tick_spacing_greater_than_1() {
        let tick_spacing: i32 = 3;
        for n in 0..MAX_TICK {
            {
                let input_tick = n;
                let sqrt_price_decimal = calculate_price_sqrt(input_tick);
                // get tick at sqrt(1.0001^(n))
                {
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, tick_spacing as u16);
                    let expected_tick = align_tick_to_spacing(input_tick, tick_spacing);
                    assert_eq!(tick, expected_tick);
                }
                // get tick slightly below sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, tick_spacing as u16);
                    let expected_tick = align_tick_to_spacing(input_tick - 1, tick_spacing);
                    assert_eq!(tick, expected_tick);
                }
                // get tick slightly above sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, tick_spacing as u16);
                    let expected_tick = align_tick_to_spacing(input_tick, tick_spacing);
                    assert_eq!(tick, expected_tick);
                }
            }
        }
    }

    #[test]
    fn test_all_negative_tick_spacing_greater_than_1() {
        let tick_spacing: i32 = 4;
        // for n in 0..MAX_TICK {
        for n in 0..4 {
            {
                let input_tick = -n;
                let sqrt_price_decimal = calculate_price_sqrt(input_tick);
                // get tick at sqrt(1.0001^(n))
                {
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, tick_spacing as u16);
                    let expected_tick = align_tick_to_spacing(input_tick, tick_spacing);
                    assert_eq!(tick, expected_tick);
                }
                // get tick slightly below sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, tick_spacing as u16);
                    let expected_tick = align_tick_to_spacing(input_tick - 1, tick_spacing);
                     assert_eq!(tick, expected_tick);
                }
                // get tick slightly above sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal, tick_spacing as u16);
                    let expected_tick = align_tick_to_spacing(input_tick, tick_spacing);
                    assert_eq!(tick, expected_tick);
                }
            }
        }
    }
}
