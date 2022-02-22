pub use crate::uint::U256;
use core::convert::TryFrom;
use core::convert::TryInto;
use decimal::decimal;
use decimal::Decimal;

use decimal::*;

use anchor_lang::prelude::*;

#[decimal(24)]
#[zero_copy]
#[derive(Default, std::fmt::Debug, PartialEq)]
pub struct Price {
    pub v: u128,
}

#[decimal(12)]
#[zero_copy]
#[derive(Default, std::fmt::Debug, PartialEq)]
pub struct Liquidity {
    pub v: u128,
}

#[decimal(24)]
#[zero_copy]
#[derive(Default, std::fmt::Debug, PartialEq)]
pub struct FeeGrowth {
    pub v: u128,
}

#[decimal(0)]
#[zero_copy]
#[derive(Default, std::fmt::Debug, PartialEq)]
pub struct TokenAmount {
    pub v: u64,
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_denominator() {
        assert_eq!(Price::from_integer(1).get(), 1_000000_000000_000000_000000);
        assert_eq!(Liquidity::from_integer(1).get(), 1_000000_000000);
        assert_eq!(
            FeeGrowth::from_integer(1).get(),
            1_000000_000000_000000_000000
        );
        assert_eq!(TokenAmount::from_integer(1).get(), 1);
    }

    #[test]
    pub fn test_ops() {
        let result = TokenAmount::from_integer(1).big_mul(Price::from_integer(1));
        assert_eq!(result.get(), 1);
    }
}
