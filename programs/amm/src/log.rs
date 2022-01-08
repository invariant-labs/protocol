use std::convert::TryInto;

use crate::{decimal::Decimal, math::calculate_price_sqrt, structs::MAX_TICK, uint::U256};

pub fn decimal_to_x128(decimal: Decimal) -> U256 {
    let factor = U256::from(1) << 128;

    U256::from(decimal.to_u256())
        .checked_mul(factor)
        .unwrap()
        .checked_div(Decimal::one().to_u256())
        .unwrap()
}

pub fn decimal_to_x64(decimal: Decimal) -> u128 {
    let factor = 1u128 << 64;

    U256::from(decimal.v)
        .checked_mul(U256::from(factor))
        .unwrap()
        .checked_div(U256::from(Decimal::one().v))
        .unwrap()
        .try_into()
        .unwrap()
}

pub fn msb_x64(sqrt_price_x64: u128) -> u128 {
    let mut msb = 0;
    let mut sqrt_price_x64 = sqrt_price_x64;

    if sqrt_price_x64 >= 1u128 << 64 {
        sqrt_price_x64 >>= 64;
        msb += 64;
    };
    if sqrt_price_x64 >= 1u128 << 32 {
        sqrt_price_x64 >>= 32;
        msb += 32;
    };
    if sqrt_price_x64 >= 1u128 << 16 {
        sqrt_price_x64 >>= 16;
        msb += 16;
    };
    if sqrt_price_x64 >= 1u128 << 8 {
        sqrt_price_x64 >>= 8;
        msb += 8;
    };
    if sqrt_price_x64 >= 1u128 << 4 {
        sqrt_price_x64 >>= 4;
        msb += 4;
    };
    if sqrt_price_x64 >= 1u128 << 2 {
        sqrt_price_x64 >>= 2;
        msb += 2;
    };
    if sqrt_price_x64 >= 1u128 << 1 {
        msb += 1;
    };

    msb
}

pub fn msb_x128(sqrt_price_x128: U256) -> U256 {
    let mut sqrt_price_x128 = sqrt_price_x128;
    let mut log2_msb = U256::from(0);

    if sqrt_price_x128 >= U256::from(1) << 128 {
        sqrt_price_x128 >>= 128;
        log2_msb += U256::from(128);
    };
    if sqrt_price_x128 >= U256::from(1) << 64 {
        sqrt_price_x128 >>= 64;
        log2_msb += U256::from(64);
    };
    if sqrt_price_x128 >= U256::from(1) << 32 {
        sqrt_price_x128 >>= 32;
        log2_msb += U256::from(32);
    };
    if sqrt_price_x128 >= U256::from(1) << 16 {
        sqrt_price_x128 >>= 16;
        log2_msb += U256::from(16);
    };
    if sqrt_price_x128 >= U256::from(1) << 8 {
        sqrt_price_x128 >>= 8;
        log2_msb += U256::from(8);
    };
    if sqrt_price_x128 >= U256::from(1) << 4 {
        sqrt_price_x128 >>= 4;
        log2_msb += U256::from(4);
    };
    if sqrt_price_x128 >= U256::from(1) << 2 {
        sqrt_price_x128 >>= 2;
        log2_msb += U256::from(2);
    };
    if sqrt_price_x128 >= U256::from(1) << 1 {
        log2_msb += U256::from(1);
    };

    log2_msb
}

pub fn log2_x64(mut sqrt_price_x64: u128) -> (bool, u128) {
    let mut sign = true;
    let scale = 1u128 << 64;
    let scale_2x = scale << 1;
    let half_scale = scale >> 1;

    // log2(x) = -log2(1/x), when x < 1
    if sqrt_price_x64 < scale {
        sign = false;
        // scale^2 / sqrt_price_x128
        sqrt_price_x64 = U256::from(scale)
            .checked_mul(U256::from(scale))
            .unwrap()
            .checked_div(U256::from(sqrt_price_x64 + 1)) // div down
            .unwrap()
            .try_into()
            .unwrap();
    }

    let msb = msb_x64(sqrt_price_x64.checked_div(scale).unwrap());
    let mut result = msb.checked_mul(scale).unwrap();
    let mut y: U256 = U256::from(sqrt_price_x64) >> msb;

    if y == U256::from(scale) {
        return (sign, result);
    };
    let mut delta = half_scale;
    while delta > 0 {
        y = y
            .checked_mul(y)
            .unwrap()
            .checked_div(U256::from(scale))
            .unwrap();

        if y >= U256::from(scale_2x) {
            result += delta;
            y >>= 1;
        }
        delta >>= 1;
    }
    (sign, result)
}

pub fn get_tick_at_sqrt_price_x64(sqrt_price_x64: u128, sqrt_price_decimal: Decimal) -> i32 {
    let log2_10001: u128 = 1330584781654115; // ceil(13305847816541147572934375639175128356511292535011910917895)
    let (log_sign, log2_sqrt_price) = log2_x64(sqrt_price_x64);

    // accuracy = +825494534704448554 [0.04475 tick]
    let abs_floor_tick: i32 = log2_sqrt_price
        .checked_div(log2_10001)
        .unwrap()
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
            if sqrt_price_decimal >= farther_tick_sqrt_price_decimal {
                farther_tick
            } else {
                nearer_tick
            }
        }
        false => {
            let nearer_tick_sqrt_price_decimal = calculate_price_sqrt(nearer_tick);
            if nearer_tick_sqrt_price_decimal <= sqrt_price_decimal {
                nearer_tick
            } else {
                farther_tick
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{decimal::Decimal, structs::MAX_TICK};

    #[test]
    fn test_decimal_to_binary() {
        // max_sqrt_price = ceil(sqrt(2^64 - 1))
        // min_sqrt_price = floor(sqrt_price(1/(2^64-1)))
        let max_sqrt_price = Decimal::new(4294967295999999999884);
        let min_sqrt_price = Decimal::new(232);

        // base: 2^128
        // {
        //     let max_sqrt_price_x128 = decimal_to_x128(max_sqrt_price);
        //     let min_sqrt_price_x128 = decimal_to_x128(min_sqrt_price);

        //     let expected_max_sqrt_price_x128 =
        //         U256::from_dec_str("1461501637330902918164212078153454157894181088513").unwrap();
        //     let expected_min_sqrt_price_x128 =
        //         U256::from_dec_str("78945509125657723523502908924").unwrap();

        //     assert!(max_sqrt_price_x128.eq(&expected_max_sqrt_price_x128));
        //     assert!(min_sqrt_price_x128.eq(&expected_min_sqrt_price_x128));
        // }
        // base: 2^96
        {
            let max_sqrt_price_x96 = decimal_to_x128(max_sqrt_price) >> 32;
            let min_sqrt_price_x96 = decimal_to_x128(min_sqrt_price) >> 32;

            let expected_max_sqrt_price_x96 =
                U256::from_dec_str("340282366920938463454184140580113548295").unwrap();

            let expected_min_sqrt_price_x96 = U256::from_dec_str("18380933703309326321").unwrap();

            assert!(max_sqrt_price_x96.eq(&expected_max_sqrt_price_x96));
            assert!(min_sqrt_price_x96.eq(&expected_min_sqrt_price_x96));
        }
    }

    #[test]
    fn test_log2_x64() {
        // log2 of 1
        {
            let sqrt_price_decimal = Decimal::from_integer(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 0u128);
        }
        // log2 > 0 when x > 1
        {
            let sqrt_price_decimal = Decimal::from_integer(879);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 180403980057034186507);
        }
        // log2 < 0 when x < 1
        {
            let sqrt_price_decimal = Decimal::from_decimal(59, 4);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 136599418782046619094);
        }
        // log2 of max sqrt price
        {
            let max_sqrt_price = Decimal::new(4294967295999999999884);
            let sqrt_price_x64 = decimal_to_x64(max_sqrt_price);
            let (sign, value) = log2_x64(sqrt_price_x64);
            assert_eq!(sign, true);
            assert_eq!(value, 590295810358705651711);
        }
        // log2 of min sqrt price
        {
            let min_sqrt_price = calculate_price_sqrt(-MAX_TICK);
            let sqrt_price_x64 = decimal_to_x64(min_sqrt_price);
            let (sign, value) = log2_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 295147655881613622167);
        }
        // log2 of sqrt(1.0001^(-19_999)) - 1
        {
            let mut sqrt_price_decimal = calculate_price_sqrt(-19_999);
            sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_x64(sqrt_price_x64);
            assert_eq!(sign, false);
            assert_eq!(value, 26610365040054024053);
        }
        // log2 of sqrt(1.0001^(19_999)) + 1
        {
            let mut sqrt_price_decimal = calculate_price_sqrt(19_999);
            sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let (sign, value) = log2_x64(sqrt_price_x64);
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
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, 0);
            }
            // get tick slightly below 1
            {
                let sqrt_price_decimal = Decimal::new(999999999999);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, -1);
            }
            // get tick slightly above 1
            {
                let sqrt_price_decimal = Decimal::new(1000000000001);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, 0);
            }
        }
        // around 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(1);
            // get tick at sqrt(1.0001)
            {
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, 1);
            }
            // get tick slightly below sqrt(1.0001)
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, 0);
            }
            // get tick slightly above sqrt(1.0001)
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, 1);
            }
        }
        // around -1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(-1);
            // get tick at sqrt(1.0001^(-1))
            {
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, -1);
            }
            // get tick slightly below sqrt(1.0001^(-1))
            {
                let sqrt_price_decimal = calculate_price_sqrt(-1) - Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, -2);
            }
            // get tick slightly above sqrt(1.0001^(-1))
            {
                let sqrt_price_decimal = calculate_price_sqrt(-1) + Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, -1);
            }
        }
        // around max - 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(MAX_TICK - 1);
            // get tick at sqrt(1.0001^(MAX_TICK - 1))
            {
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, MAX_TICK - 1);
            }
            // get tick slightly below sqrt(1.0001^(MAX_TICK - 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, MAX_TICK - 2);
            }
            // get tick slightly above sqrt(1.0001^(MAX_TICK - 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, MAX_TICK - 1);
            }
        }
        // around min + 1 tick
        {
            let sqrt_price_decimal = calculate_price_sqrt(-(MAX_TICK - 1));
            // get tick at sqrt(1.0001^(-MAX_TICK + 1))
            {
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, -(MAX_TICK - 1));
            }
            // get tick slightly below sqrt(1.0001^(-MAX_TICK + 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, -MAX_TICK);
            }
            // get tick slightly above sqrt(1.0001^(-MAX_TICK + 1))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, -(MAX_TICK - 1));
            }
        }
        //get tick slightly below at max tick
        {
            let max_sqrt_price = Decimal::from_decimal(655354, 1);
            let sqrt_price_decimal = max_sqrt_price - Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
            assert_eq!(tick, MAX_TICK);
        }

        // around -19_999 tick
        {
            let expected_tick = -19_999;
            let sqrt_price_decimal = calculate_price_sqrt(expected_tick);
            // get tick at sqrt(1.0001^(-19_999))
            {
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, expected_tick);
            }
            // get tick slightly below sqrt(1.0001^(-19_999))
            {
                // let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(150);
                let sqrt_price_decimal = sqrt_price_decimal - Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, expected_tick - 1);
            }
            // get tick slightly above sqrt(1.0001^(-19_999))
            {
                let sqrt_price_decimal = sqrt_price_decimal + Decimal::new(1);
                let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
                let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
                assert_eq!(tick, expected_tick);
            }
        }
        //get tick slightly above at min tick
        {
            let min_sqrt_price = Decimal::new(15258932);
            let sqrt_price_decimal = min_sqrt_price + Decimal::new(1);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let tick = get_tick_at_sqrt_price_x64(sqrt_price_x64, sqrt_price_decimal);
            assert_eq!(tick, -MAX_TICK);
        }
    }
}
