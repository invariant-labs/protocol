pub use crate::uint::U256;
use core::convert::TryFrom;
use core::convert::TryInto;
pub use decimal::*;

use anchor_lang::prelude::*;

#[decimal(24)]
#[zero_copy]
#[derive(Default, std::fmt::Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Price {
    pub v: u128,
}

#[decimal(12)]
#[zero_copy]
#[derive(
    Default, std::fmt::Debug, PartialEq, Eq, PartialOrd, Ord, AnchorSerialize, AnchorDeserialize,
)]
pub struct Liquidity {
    pub v: u128,
}

#[decimal(24)]
#[zero_copy]
#[derive(Default, std::fmt::Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct FeeGrowth {
    pub v: u128,
}

impl FeeGrowth {
    pub fn from_fee(liquidity: Liquidity, fee: TokenAmount) -> Self {
        Self::from_decimal(fee).big_div_up(liquidity)
    }

    pub fn to_fee(self, liquidity: Liquidity) -> Liquidity {
        Liquidity::from_decimal(self.big_mul(liquidity))
    }
}

#[decimal(0)]
#[zero_copy]
#[derive(
    Default, std::fmt::Debug, PartialEq, Eq, PartialOrd, Ord, AnchorSerialize, AnchorDeserialize,
)]
pub struct FixedPoint {
    pub v: u128,
}

// legacy not serializable may implement later
#[decimal(0)]
#[derive(Default, std::fmt::Debug, PartialEq, Eq, PartialOrd, Ord, Clone, Copy)]
pub struct TokenAmount(pub u64);

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

    #[test]
    fn test_new() {
        // One
        {
            let fee_growth = FeeGrowth::from_fee(Liquidity::from_integer(1), TokenAmount(1));
            assert_eq!(fee_growth, FeeGrowth::from_integer(1));
        }
        // Half
        {
            let fee_growth = FeeGrowth::from_fee(Liquidity::from_integer(2), TokenAmount(1));
            assert_eq!(fee_growth, FeeGrowth::from_scale(5, 1))
        }
        // Little
        {
            let fee_growth = FeeGrowth::from_fee(Liquidity::from_integer(u64::MAX), TokenAmount(1));
            assert_eq!(fee_growth, FeeGrowth::new(54211))
        }
        // Fairly big
        {
            let fee_growth =
                FeeGrowth::from_fee(Liquidity::from_integer(100), TokenAmount(1_000_000));
            assert_eq!(fee_growth, FeeGrowth::from_integer(10000))
        }
    }

    #[test]
    fn test_to_fee() {
        // equal
        {
            let amount = TokenAmount(100);
            let liquidity = Liquidity::from_integer(1_000_000);

            let fee_growth = FeeGrowth::from_fee(liquidity, amount);
            let out = fee_growth.to_fee(liquidity);
            assert_eq!(out, Liquidity::from_decimal(amount));
        }
        // greater liquidity
        {
            let amount = TokenAmount(100);
            let liquidity_before = Liquidity::from_integer(1_000_000);
            let liquidity_after = Liquidity::from_integer(10_000_000);

            let fee_growth = FeeGrowth::from_fee(liquidity_before, amount);
            let out = fee_growth.to_fee(liquidity_after);
            assert_eq!(out, Liquidity::from_integer(1000))
        }
    }
}
