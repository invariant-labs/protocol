use crate::old_decimal::{OldDecimal, DENOMINATOR, SCALE};
use crate::structs::OldTokenAmount;
use crate::uint::U256;
use anchor_lang::prelude::*;
use std::ops::{AddAssign, SubAssign};
use std::{
    convert::TryInto,
    ops::{Add, Sub},
};

const GROWTH_SCALE: u8 = 24;
const GROWTH_DENOMINATOR: u128 = 10u128.pow(GROWTH_SCALE as u32);

const SCALE_DIFF: u8 = GROWTH_SCALE - SCALE;
const DENOMINATOR_DIFF: u128 = 10u128.pow(SCALE_DIFF as u32);

#[derive(
    Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, AnchorDeserialize, AnchorSerialize,
)]
pub struct OldFeeGrowth {
    pub v: u128,
}

impl OldFeeGrowth {
    pub fn new(value: u128) -> OldFeeGrowth {
        OldFeeGrowth { v: value }
    }

    pub fn from_fee(liquidity: OldDecimal, amount: OldTokenAmount) -> OldFeeGrowth {
        let result: Result<u128, &str> = U256::from(amount.0)
            .checked_mul(U256::from(GROWTH_DENOMINATOR))
            .unwrap()
            .checked_mul(U256::from(DENOMINATOR))
            .unwrap()
            .checked_add(U256::from(liquidity.v.checked_sub(1).unwrap()))
            .unwrap()
            .checked_div(U256::from(liquidity.v))
            .unwrap()
            .try_into();

        assert!(result.is_ok(), "fee growth would overflow");

        OldFeeGrowth { v: result.unwrap() }
    }

    pub fn to_fee(self: OldFeeGrowth, liquidity: OldDecimal) -> OldDecimal {
        OldDecimal {
            v: U256::from(self.v)
                .checked_mul(U256::from(liquidity.v))
                .unwrap()
                .checked_div(U256::from(DENOMINATOR))
                .unwrap()
                .checked_div(U256::from(DENOMINATOR_DIFF))
                .unwrap()
                .as_u128(),
        }
    }

    pub fn zero() -> OldFeeGrowth {
        OldFeeGrowth { v: 0 }
    }

    pub fn from_integer(integer: u128) -> OldFeeGrowth {
        OldFeeGrowth {
            v: integer.checked_mul(GROWTH_DENOMINATOR).unwrap(),
        }
    }
}

impl AddAssign for OldFeeGrowth {
    fn add_assign(&mut self, other: Self) {
        self.v += other.v;
    }
}

impl SubAssign for OldFeeGrowth {
    fn sub_assign(&mut self, other: Self) {
        self.v -= other.v;
    }
}

impl Add for OldFeeGrowth {
    type Output = OldFeeGrowth;
    fn add(self, other: Self) -> OldFeeGrowth {
        OldFeeGrowth {
            v: self.v + other.v,
        }
    }
}

impl Sub for OldFeeGrowth {
    type Output = OldFeeGrowth;
    fn sub(self, other: Self) -> OldFeeGrowth {
        OldFeeGrowth {
            v: self.v - other.v,
        }
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_new() {
        // One
        {
            let fee_growth = OldFeeGrowth::from_fee(OldDecimal::from_integer(1), OldTokenAmount(1));
            assert_eq!(fee_growth.v, GROWTH_DENOMINATOR)
        }
        // Half
        {
            let fee_growth = OldFeeGrowth::from_fee(OldDecimal::from_integer(2), OldTokenAmount(1));
            assert_eq!(fee_growth.v, GROWTH_DENOMINATOR / 2)
        }
        // Little
        {
            let fee_growth = OldFeeGrowth::from_fee(
                OldDecimal::from_integer(u64::MAX.into()),
                OldTokenAmount(1),
            );
            assert_eq!(fee_growth.v, 54211)
        }
        // Fairly big
        {
            let fee_growth =
                OldFeeGrowth::from_fee(OldDecimal::from_integer(100), OldTokenAmount(1_000_000));
            assert_eq!(fee_growth.v, GROWTH_DENOMINATOR * 10000)
        }
    }

    #[test]
    fn test_ops() {
        assert_eq!(
            OldFeeGrowth::from_integer(0) + OldFeeGrowth::from_integer(2),
            OldFeeGrowth::from_integer(2)
        );
        assert_eq!(
            OldFeeGrowth::from_integer(2) - OldFeeGrowth::from_integer(1),
            OldFeeGrowth::from_integer(1)
        );
    }

    #[test]
    fn test_to_fee() {
        // equal
        {
            let amount = OldTokenAmount(100);
            let liquidity = OldDecimal::from_integer(1_000_000);

            let fee_growth = OldFeeGrowth::from_fee(liquidity, amount);
            let out = fee_growth.to_fee(liquidity);
            assert_eq!(out, OldDecimal::from_token_amount(amount));
        }
        // greater liquidity
        {
            let amount = OldTokenAmount(100);
            let liquidity_before = OldDecimal::from_integer(1_000_000);
            let liquidity_after = OldDecimal::from_integer(10_000_000);

            let fee_growth = OldFeeGrowth::from_fee(liquidity_before, amount);
            let out = fee_growth.to_fee(liquidity_after);
            assert_eq!(out, OldDecimal::from_integer(1000))
        }
    }
}
