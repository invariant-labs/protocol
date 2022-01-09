use std::convert::TryInto;

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
const LOG2_SQRT_10001: u128 = 1330584781654115; // ceil

pub fn decimal_to_x64(decimal: Decimal) -> u128 {
    decimal
        .v
        .checked_mul(LOG_ONE)
        .unwrap()
        .checked_div(DENOMINATOR)
        .unwrap()
        .try_into()
        .unwrap()
}

pub fn log2_floor_x64(mut sqrt_price_x64: u128) -> u128 {
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

pub fn log2_iterative_approximation_x64(mut sqrt_price_x64: u128) -> (bool, u128) {
    let one = U256::from(LOG_ONE);
    let mut sign = true;

    // log2(x) = -log2(1/x), when x < 1
    if sqrt_price_x64 < LOG_ONE {
        sign = false;
        sqrt_price_x64 = (U256::from(1) << LOG_DOUBLE_SCALE)
            .checked_div(U256::from(sqrt_price_x64 + 1)) // div down
            .unwrap()
            .try_into()
            .unwrap();
    }

    let log2_floor = log2_floor_x64(sqrt_price_x64 >> LOG_SCALE);
    let mut result = log2_floor << LOG_SCALE;
    let mut y: U256 = U256::from(sqrt_price_x64) >> log2_floor;

    if y == one {
        return (sign, result);
    };

    let two = U256::from(LOG_DOUBLE);
    let mut delta = LOG_HALF;
    while delta > 0 {
        y = y.checked_mul(y).unwrap().checked_div(one).unwrap();

        if y >= two {
            result |= delta;
            y >>= 1;
        }
        delta >>= 1;
    }
    (sign, result)
}

pub fn get_tick_at_sqrt_price(sqrt_price_decimal: Decimal) -> i32 {
    let sqrt_price_x64: u128 = decimal_to_x64(sqrt_price_decimal);
    let (log_sign, log2_sqrt_price) = log2_iterative_approximation_x64(sqrt_price_x64);

    let abs_floor_tick: i32 = match log_sign {
        true => log2_sqrt_price.checked_div(LOG2_SQRT_10001).unwrap(),
        false => log2_sqrt_price
            .checked_add(40000000000) // max accuracy due to inverse log in (-MAX_TICK, 0) domain
            .unwrap()
            .checked_div(LOG2_SQRT_10001)
            .unwrap(),
    }
    .try_into()
    .unwrap();

    let nearer_tick = match log_sign {
        true => abs_floor_tick,
        false => -abs_floor_tick,
    };
    let farther_tick = match log_sign {
        true => abs_floor_tick + 1,
        false => -abs_floor_tick - 1,
    };

    return match log_sign {
        true => {
            if farther_tick > MAX_TICK {
                return nearer_tick;
            }
            let farther_tick_sqrt_price_decimal = calculate_price_sqrt(farther_tick);
            match sqrt_price_decimal >= farther_tick_sqrt_price_decimal {
                true => farther_tick,
                false => nearer_tick,
            }
        }
        false => {
            let nearer_tick_sqrt_price_decimal = calculate_price_sqrt(nearer_tick);
            match nearer_tick_sqrt_price_decimal <= sqrt_price_decimal {
                true => nearer_tick,
                false => farther_tick,
            }
        }
    };
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
            assert_eq!(value, 180403980057034186507);
        }
        // log2 < 0 when x < 1
        {
            let sqrt_price_decimal = Decimal::from_decimal(59, 4);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 136599418782046619094);
        }
        // log2 of max sqrt price
        {
            let max_sqrt_price = Decimal::new(4294967295999999999884);
            let sqrt_price_x64 = decimal_to_x64(max_sqrt_price);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 590295810358705651711);
        }
        // log2 of min sqrt price
        {
            let min_sqrt_price = calculate_price_sqrt(-MAX_TICK);
            let sqrt_price_x64 = decimal_to_x64(min_sqrt_price);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 295147655881613622167);
        }
        // log2 of sqrt(1.0001^(-19_999)) - 1
        {
            let mut sqrt_price_decimal = calculate_price_sqrt(-19_999);
            sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 26610365040054024053);
        }
        // log2 of sqrt(1.0001^(19_999)) + 1
        {
            let mut sqrt_price_decimal = calculate_price_sqrt(19_999);
            sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_iterative_approximation_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 26610365039928226786);
        }
    }

    #[test]
    fn test_get_tick_at_sqrt_price_x64() {
        // around 0 tick
        {
            // get tick at 1
            {
                let sqrt_price_decimal = Decimal::from_integer(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, 0);
            }
            // get tick slightly below 1
            {
                let sqrt_price_decimal = Decimal::new(999999999999);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, -1);
            }
            // get tick slightly above 1
            {
                let sqrt_price_decimal = Decimal::new(1000000000001);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, 0);
            }
        }
        // around 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(1);
            // get tick at sqrt(1.0001)
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, 1);
            }
            // get tick slightly below sqrt(1.0001)
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, 0);
            }
            // get tick slightly above sqrt(1.0001)
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, 1);
            }
        }
        // around -1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(-1);
            // get tick at sqrt(1.0001^(-1))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, -1);
            }
            // get tick slightly below sqrt(1.0001^(-1))
            {
                let sqrt_price_decimal = calculate_price_sqrt(-1) - Decimal::new(1);

                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, -2);
            }
            // get tick slightly above sqrt(1.0001^(-1))
            {
                let sqrt_price_decimal = calculate_price_sqrt(-1) + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, -1);
            }
        }
        // around max - 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(MAX_TICK - 1);
            // get tick at sqrt(1.0001^(MAX_TICK - 1))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, MAX_TICK - 1);
            }
            // get tick slightly below sqrt(1.0001^(MAX_TICK - 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, MAX_TICK - 2);
            }
            // get tick slightly above sqrt(1.0001^(MAX_TICK - 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, MAX_TICK - 1);
            }
        }
        // around min + 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(-(MAX_TICK - 1));
            // get tick at sqrt(1.0001^(-MAX_TICK + 1))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, -(MAX_TICK - 1));
            }
            // get tick slightly below sqrt(1.0001^(-MAX_TICK + 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, -MAX_TICK);
            }
            // get tick slightly above sqrt(1.0001^(-MAX_TICK + 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, -(MAX_TICK - 1));
            }
        }
        //get tick slightly below at max tick
        {
            let max_sqrt_price = Decimal::from_decimal(655354, 1);
            let sqrt_price_decimal = max_sqrt_price - Decimal::new(1);
            let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
            assert_eq!(tick, MAX_TICK);
        }
        // around 19_999 tick
        {
            let expected_tick = 19_999;
            let sqrt_price_decimal = calculate_price_sqrt(expected_tick);
            // get tick at sqrt(1.0001^19_999)
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, expected_tick);
            }
            // get tick slightly below sqrt(1.0001^19_999)
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);

                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, expected_tick - 1);
            }
            // get tick slightly above sqrt(1.0001^19_999)
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, expected_tick);
            }
        }
        // around -19_999 tick
        {
            let expected_tick = -19_999;
            let sqrt_price_decimal = calculate_price_sqrt(expected_tick);
            // get tick at sqrt(1.0001^(-19_999))
            {
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, expected_tick);
            }
            // get tick slightly below sqrt(1.0001^(-19_999))
            {
                // let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(150);
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, expected_tick - 1);
            }
            // get tick slightly above sqrt(1.0001^(-19_999))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                assert_eq!(tick, expected_tick);
            }
        }
        //get tick slightly above at min tick
        {
            let min_sqrt_price = Decimal::new(15258932);
            let sqrt_price_decimal = min_sqrt_price + Decimal::new(1);
            let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
            assert_eq!(tick, -MAX_TICK);
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
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                    assert_eq!(tick, expected_tick);
                }
                // get tick slightly below sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);

                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                    assert_eq!(tick, expected_tick - 1);
                }
                // get tick slightly above sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
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
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                    assert_eq!(tick, expected_tick);
                }
                // get tick slightly below sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                    assert_eq!(tick, expected_tick - 1);
                }
                // get tick slightly above sqrt(1.0001^n)
                {
                    let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                    let tick = get_tick_at_sqrt_price(sqrt_price_decimal);
                    assert_eq!(tick, expected_tick);
                }
            }
        }
    }
}
