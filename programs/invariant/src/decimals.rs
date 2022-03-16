use core::convert::TryFrom;
use core::convert::TryInto;
pub use decimal::*;

use anchor_lang::prelude::*;

pub const PRICE_LIQUIDITY_DENOMINATOR: u128 = 1__0000_0000__0000_0000__00u128;

#[decimal(24)]
#[zero_copy]
#[derive(
    Default, std::fmt::Debug, PartialEq, Eq, PartialOrd, Ord, AnchorSerialize, AnchorDeserialize,
)]
pub struct Price {
    pub v: u128,
}

#[decimal(6)]
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

#[decimal(12)]
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

impl FeeGrowth {
    pub fn from_fee(liquidity: Liquidity, fee: TokenAmount) -> Self {
        FeeGrowth::new(
            U256::from(fee.get())
                .checked_mul(FeeGrowth::one())
                .unwrap()
                .checked_mul(Liquidity::one())
                .unwrap()
                .checked_div(liquidity.here())
                .unwrap()
                .try_into()
                .unwrap(),
        )
    }

    pub fn to_fee(self, liquidity: Liquidity) -> FixedPoint {
        FixedPoint::from_decimal(self.big_mul(liquidity))
    }
}

impl Price {
    pub fn big_div_values_to_token(nominator: U256, denominator: U256) -> Option<TokenAmount> {
        Some(TokenAmount::new(
            match nominator
                .checked_mul(Self::one::<U256>())
                .unwrap()
                .checked_div(denominator)
                .unwrap()
                .checked_div(Self::one::<U256>())
                .unwrap()
                .try_into()
            {
                Ok(v) => v,
                Err(_) => return None,
            },
        ))
    }

    pub fn big_div_values_to_token_up(nominator: U256, denominator: U256) -> Option<TokenAmount> {
        Some(TokenAmount::new({
            match nominator
                .checked_mul(Self::one::<U256>())
                .unwrap()
                .checked_add(denominator.checked_sub(U256::from(1u32)).unwrap())
                .unwrap()
                .checked_div(denominator)
                .unwrap()
                .checked_add(Self::almost_one::<U256>())
                .unwrap()
                .checked_div(Self::one::<U256>())
                .unwrap()
                .try_into()
            {
                Ok(v) => v,
                Err(_) => return None,
            }
        }))
    }

    pub fn big_div_values_up(nominator: U256, denominator: U256) -> Price {
        Price::new({
            nominator
                .checked_mul(Self::one::<U256>())
                .unwrap()
                .checked_add(denominator.checked_sub(U256::from(1u32)).unwrap())
                .unwrap()
                .checked_div(denominator)
                .unwrap()
                .try_into()
                .unwrap()
        })
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_denominator() {
        assert_eq!(Price::from_integer(1).get(), 1_000000_000000_000000_000000);
        assert_eq!(Liquidity::from_integer(1).get(), 1_000000);
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
    fn test_from_fee() {
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
            // real    5.42101086242752217003726400434970855712890625 × 10^-20
            // expected 54210
            assert_eq!(fee_growth, FeeGrowth::new(54210))
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
            assert_eq!(out, FixedPoint::from_decimal(amount));
        }
        // greater liquidity
        {
            let amount = TokenAmount(100);
            let liquidity_before = Liquidity::from_integer(1_000_000);
            let liquidity_after = Liquidity::from_integer(10_000_000);

            let fee_growth = FeeGrowth::from_fee(liquidity_before, amount);
            let out = fee_growth.to_fee(liquidity_after);
            assert_eq!(out, FixedPoint::from_integer(1000))
        }
        // huge liquidity
        {
            let amount = TokenAmount(100_000_000__000000);
            let liquidity = Liquidity::from_integer(2u128.pow(77));

            let fee_growth = FeeGrowth::from_fee(liquidity, amount);
            // real    6.61744490042422139897126953655970282852649688720703125 × 10^-22
            // expected 661744490042422
            assert_eq!(fee_growth, FeeGrowth::new(661744490042422));

            let out = fee_growth.to_fee(liquidity);
            // real    9.9999999999999978859343891977453174784 × 10^25
            // expected 99999999999999978859343891
            assert_eq!(out, FixedPoint::new(99999999999999978859343891))
        }
    }

    #[test]
    fn test_decimal_ops() {
        let liquidity = Liquidity::new(4_902_430_892__340393);
        let price: Price = Price::new(9833__489034_289032_430082_130832);

        // real:           4.8208000421189050674873214903955408904296976 × 10^13
        // expected price: 4_8208000421189050674873214903955408904
        // expected liq:   4_8208000421189050674

        let expected = Liquidity::new(48208000421189050674);
        assert_eq!(liquidity.big_mul(price), expected);
        assert_eq!(liquidity.big_mul_up(price), expected + Liquidity::new(1));

        let expected_price = Price::new(48208000421189050674873214903955408904);
        assert_eq!(price.big_mul(liquidity), expected_price);
        assert_eq!(price.big_mul_up(liquidity), expected_price + Price::new(1));
    }
}
