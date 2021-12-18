use crate::{decimal::Decimal, uint::U256};

pub fn decimal_to_x128(decimal: Decimal) -> U256 {
    let factor = U256::from(1) << 128;

    U256::from(decimal.to_u256())
        .checked_mul(factor)
        .unwrap()
        .checked_div(Decimal::one().to_u256())
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::decimal::Decimal;

    #[test]
    fn test_decimal_to_binary() {
        // max_sqrt_price = ceil(sqrt(2^64 - 1))
        // min_sqrt_price = floor(sqrt_price(1/(2^64-1)))

        let max_sqrt_price = Decimal::new(4294967295999999999884);
        let min_sqrt_price = Decimal::new(329);

        let max_sqrt_price_x128 = decimal_to_x128(max_sqrt_price);
        let min_sqrt_price_x128 = decimal_to_x128(min_sqrt_price);

        let expected_max_sqrt_price_x128 =
            U256::from_dec_str("1461501637330902918164212078153454157894181088513").unwrap();
        let expected_min_sqrt_price_x128 =
            U256::from_dec_str("111952898716988754479450245845").unwrap();

        assert!(max_sqrt_price_x128.eq(&expected_max_sqrt_price_x128));
        assert!(min_sqrt_price_x128.eq(&expected_min_sqrt_price_x128));
    }
}
