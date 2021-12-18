use crate::{decimal::Decimal, uint::U256};

pub fn decimal_to_binary(decimal: Decimal) -> U256 {
    // 2^128/10^12 = 340282366920938463463374607.431768211456
    let w = U256::from("340282366920938463463374607431768211456");

    U256::from(decimal.to_u256())
        .checked_mul(w)
        .unwrap()
        .checked_div(Decimal::one().to_u256())
        .unwrap()
}

#[cfg(test)]
mod tests {

    #[test]
    fn test_decimal_to_binary() {
        // test for max and min [sqrt_price]
        println!("hello world!");
    }
}
