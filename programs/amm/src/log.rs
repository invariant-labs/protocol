use std::{convert::TryInto, ops::Div};

use crate::{decimal::Decimal, uint::U256};

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

    decimal
        .v
        .checked_mul(factor)
        .unwrap()
        .checked_div(Decimal::one().v)
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

pub fn log2_msb_x128(sqrt_price_x128: U256) -> U256 {
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
    println!("scale = {:?}", scale);

    if sqrt_price_x64 < scale {
        sign = false;
        // scale * scale / sqrt_price_x128
        sqrt_price_x64 = U256::from(scale)
            .checked_mul(U256::from(scale))
            .unwrap()
            .checked_div(U256::from(sqrt_price_x64))
            .unwrap()
            .try_into()
            .unwrap();
    }

    let msb = msb_x64(sqrt_price_x64.checked_div(scale).unwrap());
    let mut result = msb.checked_mul(scale).unwrap();
    let mut y: U256 = U256::from(sqrt_price_x64) >> msb;

    if y == U256::from(scale) {
        return (sign, sqrt_price_x64);
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
        // /= 2 can be to >>=
        delta >>= 1;
    }
    (sign, result)
}

pub fn log2_x128(mut sqrt_price_x128: U256, sign: bool) -> (bool, U256) {
    let scale: U256 = U256::from(1) << 128;
    let two = U256::from(2);
    let scale_2x: U256 = scale.checked_mul(two).unwrap();
    let half_scale: U256 = scale.checked_div(two).unwrap();

    // log2(x) = -log2(1/x)
    if !sign {
        // scale * scale / sqrt_price_x128
        sqrt_price_x128 = scale
            .checked_mul(scale)
            .unwrap()
            .checked_div(sqrt_price_x128)
            .unwrap();
    }

    // let msb = log2_msb_x128(sqrt_price_x128.checked_div(scale).unwrap());
    let msb = log2_msb_x128(sqrt_price_x128.checked_div(scale).unwrap());
    println!("msb: {:?}", msb);
    let mut result = msb.checked_mul(scale).unwrap();
    // y = x * 2^(-msb).

    let mut y = sqrt_price_x128 >> msb;
    // let mut y = sqrt_price_x128;

    // If y = 1, the fractional part is zero.
    println!("y = {:?}", y);
    if y == scale {
        return (sign, sqrt_price_x128);
    };

    // Calculate the fractional part via the iterative approximation.
    // The "delta >>= 1" part is equivalent to "delta /= 2", but shifting bits is faster.
    let mut delta = half_scale;
    while delta > U256::from(0) {
        y = y.checked_mul(y).unwrap().checked_div(scale).unwrap();
        println!("y = {:?}", y);

        if y >= scale_2x {
            result += delta;
            y >>= 1;
        }
        // /= 2 can be to >>=
        delta >>= 1;
    }
    (sign, result)
}

// PRICE to log
// 4 * 10^9
// 2.3 * 10^-10
// pub fn log10_floor(sqrt_price: Decimal) -> u32 {
//     log10(sqrt_price.v)
// }

// pub const fn log10(mut val: u128) -> u32 {
//     let mut log = 0;
//     if val >= 100_000_000_000_000_000_000_000_000_000_000 {
//         val /= 100_000_000_000_000_000_000_000_000_000_000;
//         log += 32;
//         return log + less_than_8(val as u32);
//     }
//     if val >= 10_000_000_000_000_000 {
//         val /= 10_000_000_000_000_000;
//         log += 16;
//     }
//     log + less_than_16(val as u64)
// }
// const fn less_than_16(mut val: u64) -> u32 {
//     let mut log = 0;
//     if val >= 100_000_000 {
//         val /= 100_000_000;
//         log += 8;
//     }
//     log + less_than_8(val as u32)
// }
// const fn less_than_8(mut val: u32) -> u32 {
//     let mut log = 0;
//     if val >= 10_000 {
//         val /= 10_000;
//         log += 4;
//     }
//     log + if val >= 1000 {
//         3
//     } else if val >= 100 {
//         2
//     } else if val >= 10 {
//         1
//     } else {
//         0
//     }
// }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::decimal::Decimal;

    #[test]
    fn test_decimal_to_binary() {
        // max_sqrt_price = ceil(sqrt(2^64 - 1))
        // min_sqrt_price = floor(sqrt_price(1/(2^64-1)))

        let max_sqrt_price = Decimal::new(4294967295999999999884);
        let min_sqrt_price = Decimal::new(232);

        // base: 2^128
        {
            let max_sqrt_price_x128 = decimal_to_x128(max_sqrt_price);
            let min_sqrt_price_x128 = decimal_to_x128(min_sqrt_price);

            let expected_max_sqrt_price_x128 =
                U256::from_dec_str("1461501637330902918164212078153454157894181088513").unwrap();
            let expected_min_sqrt_price_x128 =
                U256::from_dec_str("78945509125657723523502908924").unwrap();

            assert!(max_sqrt_price_x128.eq(&expected_max_sqrt_price_x128));
            assert!(min_sqrt_price_x128.eq(&expected_min_sqrt_price_x128));
        }
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
    fn test_log10() {
        // TEST CASE:
        Decimal::from_integer(1);
    }

    #[test]
    fn test_log2_floor_x128() {}

    #[test]
    fn test_log2_X128() {
        let sqrt_price_decimal = Decimal::from_integer(3);
        // 1020847100762815390390123822295304634368
        let sqrt_price_x128 = decimal_to_x128(sqrt_price_decimal);
        println!("x128: {:?}", sqrt_price_x128);

        let log2 = log2_x128(sqrt_price_x128, true);
        println!("log2: {:?}", log2);
    }

    #[test]
    fn test_log2_x64() {
        // log2 > 0 when x > 1
        {
            let sqrt_price_decimal = Decimal::from_integer(879);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let log2 = log2_x64(sqrt_price_x64);
            println!("log2 = {:?}", log2);
        }
        // log2 < 0 when x < 1
        {
            let sqrt_price_decimal = Decimal::from_decimal(59, 4);
            println!("sqrt_price_decimal = {:?}", sqrt_price_decimal);
            let sqrt_price_x64 = decimal_to_x64(sqrt_price_decimal);
            let log2 = log2_x64(sqrt_price_x64);
            println!("log2 = {:?}", log2);
        }
    }
}
