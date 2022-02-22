use crate::structs::token_amount::OldTokenAmount;
use crate::uint::U256;
use anchor_lang::prelude::*;
use integer_sqrt::IntegerSquareRoot;
use std::{
    convert::TryInto,
    fmt::Display,
    ops::{Add, Div, Mul, Sub},
};

pub const SCALE: u8 = 12;
pub const DENOMINATOR: u128 = 10u128.pow(SCALE as u32);

#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq, PartialOrd, Ord, AnchorDeserialize, AnchorSerialize)]
pub struct OldDecimal {
    pub v: u128,
}
// pub struct Decimal::new(pub u128);

impl Display for OldDecimal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}.{}",
            self.v.checked_div(DENOMINATOR).unwrap(),
            self.v % DENOMINATOR
        )
    }
}

impl OldDecimal {
    pub fn new(value: u128) -> OldDecimal {
        OldDecimal { v: value }
    }

    pub fn from_integer(integer: u128) -> OldDecimal {
        OldDecimal::new(integer * DENOMINATOR)
    }

    pub fn one() -> OldDecimal {
        OldDecimal::new(DENOMINATOR)
    }

    pub fn from_decimal(val: u128, scale: u8) -> OldDecimal {
        if SCALE > scale {
            OldDecimal::new(val * 10u128.pow((SCALE - scale).into()))
        } else {
            let denominator = 10u128.checked_pow((scale - SCALE).into()).unwrap();
            OldDecimal::new(val.checked_div(denominator).unwrap())
        }
    }

    pub fn is_zero(self) -> bool {
        self.v == 0
    }

    pub fn from_token_amount(amount: OldTokenAmount) -> OldDecimal {
        OldDecimal::from_integer(amount.0.into())
    }

    pub fn div_up(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            self.v
                .checked_mul(DENOMINATOR)
                .unwrap()
                .checked_add(other.v.checked_sub(1).unwrap())
                .unwrap()
                .checked_div(other.v)
                .unwrap(),
        )
    }

    pub fn sqrt(self) -> OldDecimal {
        OldDecimal::new(self.v.checked_mul(DENOMINATOR).unwrap().integer_sqrt())
    }

    pub fn to_token_floor(self) -> OldTokenAmount {
        OldTokenAmount(self.v.checked_div(DENOMINATOR).unwrap().try_into().unwrap())
    }

    pub fn to_token_ceil(self) -> OldTokenAmount {
        OldTokenAmount(
            self.v
                .checked_add(DENOMINATOR.checked_sub(1).unwrap())
                .unwrap()
                .checked_div(DENOMINATOR)
                .unwrap()
                .try_into()
                .unwrap(),
        )
    }

    pub fn big_mul(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            U256::from(self.v)
                .checked_mul(U256::from(other.v))
                .unwrap()
                .checked_div(U256::from(DENOMINATOR))
                .unwrap()
                .as_u128(),
        )
    }

    pub fn big_mul_up(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            U256::from(self.v)
                .checked_mul(U256::from(other.v))
                .unwrap()
                .checked_add(U256::from(DENOMINATOR.checked_sub(1).unwrap()))
                .unwrap()
                .checked_div(U256::from(DENOMINATOR))
                .unwrap()
                .as_u128(),
        )
    }

    pub fn big_div(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            U256::from(self.v)
                .checked_mul(U256::from(DENOMINATOR))
                .unwrap()
                .checked_div(U256::from(other.v))
                .unwrap()
                .as_u128(),
        )
    }

    pub fn big_div_up(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            U256::from(self.v)
                .checked_mul(U256::from(DENOMINATOR))
                .unwrap()
                .checked_add(U256::from(other.v.checked_sub(1).unwrap()))
                .unwrap()
                .checked_div(U256::from(other.v))
                .unwrap()
                .as_u128(),
        )
    }
}

pub trait Pow<T>: Sized {
    fn pow(self, exp: T) -> OldDecimal;
}

impl Add for OldDecimal {
    type Output = OldDecimal;
    fn add(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(self.v.checked_add(other.v).unwrap())
    }
}

impl Sub for OldDecimal {
    type Output = OldDecimal;
    fn sub(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(self.v.checked_sub(other.v).unwrap())
    }
}

impl Mul for OldDecimal {
    type Output = OldDecimal;
    fn mul(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            self.v
                .checked_mul(other.v)
                .unwrap()
                .checked_div(DENOMINATOR)
                .unwrap(),
        )
    }
}

impl Div for OldDecimal {
    type Output = OldDecimal;
    fn div(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            self.v
                .checked_mul(DENOMINATOR)
                .unwrap()
                .checked_div(other.v)
                .unwrap(),
        )
    }
}

impl Pow<i128> for OldDecimal {
    fn pow(self, exp: i128) -> OldDecimal {
        let one = OldDecimal::one();
        let one_u256 = U256::from(one.v);

        if exp == 0 {
            return one;
        }

        let mut current_exp = if exp > 0 { exp } else { -exp };
        let mut base = U256::from(self.v);
        let mut result = U256::from(one.v);

        while current_exp > 0 {
            if current_exp % 2 != 0 {
                result = result
                    .checked_mul(base)
                    .unwrap()
                    .checked_div(one_u256)
                    .unwrap();
            }
            current_exp /= 2;
            base = base
                .checked_mul(base)
                .unwrap()
                .checked_div(one_u256)
                .unwrap();
        }
        if exp < 0 {
            result = one_u256
                .checked_mul(DENOMINATOR.into())
                .unwrap()
                .checked_div(result)
                .unwrap();
        }
        OldDecimal::new(result.as_u128())
    }
}

pub trait MulUp<T> {
    fn mul_up(self, other: T) -> T;
}

impl MulUp<OldDecimal> for OldDecimal {
    fn mul_up(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            self.v
                .checked_mul(other.v)
                .unwrap()
                .checked_add(DENOMINATOR.checked_sub(1).unwrap())
                .unwrap()
                .checked_div(DENOMINATOR)
                .unwrap(),
        )
    }
}

impl MulUp<OldTokenAmount> for OldDecimal {
    fn mul_up(self, other: OldTokenAmount) -> OldTokenAmount {
        OldTokenAmount(
            self.v
                .checked_mul(other.0 as u128)
                .unwrap()
                .checked_add(DENOMINATOR.checked_sub(1).unwrap())
                .unwrap()
                .checked_div(DENOMINATOR)
                .unwrap()
                .try_into()
                .unwrap(),
        )
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_ops() {
        assert_eq!(
            OldDecimal::from_integer(0) + OldDecimal::from_integer(2),
            OldDecimal::from_integer(2)
        );
        assert_eq!(
            OldDecimal::from_integer(2) - OldDecimal::from_integer(1),
            OldDecimal::from_integer(1)
        );
        assert_eq!(
            OldDecimal::from_integer(2) * OldDecimal::from_integer(2),
            OldDecimal::from_integer(4)
        );
        assert_eq!(
            OldDecimal::from_integer(111) / OldDecimal::from_integer(37),
            OldDecimal::from_integer(3)
        );
    }

    #[test]
    fn test_ord() {
        assert!(OldDecimal::from_integer(1) < OldDecimal::from_integer(2));
        assert!(OldDecimal::from_integer(2) > OldDecimal::from_integer(1));
        assert!(OldDecimal::from_integer(1) <= OldDecimal::from_integer(2));
        assert!(OldDecimal::from_integer(1) >= OldDecimal::from_integer(1));
        assert!(OldDecimal::from_integer(1) == OldDecimal::from_integer(1));
        assert!(OldDecimal::from_integer(1) != OldDecimal::from_integer(2));
    }

    #[test]
    fn test_mul_up() {
        // mul of little
        {
            let a = OldDecimal::new(1);
            let b = OldDecimal::new(1);
            assert_eq!(a.mul_up(b), OldDecimal::new(1));
        }
        // mul calculable without precision loss
        {
            let a = OldDecimal::from_integer(1);
            let b = OldDecimal::from_integer(3) / OldDecimal::new(10);
            assert_eq!(a.mul_up(b), b);
        }
        {
            let a = OldDecimal::from_integer(1);
            let b = OldTokenAmount(1);
            assert_eq!(a.mul_up(b), OldTokenAmount(1));
        }
        {
            let a = OldDecimal::from_integer(3) / OldDecimal::from_integer(10);
            let b = OldTokenAmount(3);
            assert_eq!(a.mul_up(b), OldTokenAmount(1));
        }
    }

    #[test]
    fn test_div_up() {
        // div of zero
        {
            let a = OldDecimal::new(0);
            let b = OldDecimal::new(1);
            assert_eq!(a.div_up(b), OldDecimal::new(0));
        }
        // div check rounding up
        {
            let a = OldDecimal::new(1);
            let b = OldDecimal::from_integer(2);
            assert_eq!(a.div_up(b), OldDecimal::new(1));
        }
        // div big number
        {
            let a = OldDecimal::new(200_000_000_001);
            let b = OldDecimal::from_integer(2);
            assert_eq!(a.div_up(b), OldDecimal::new(100_000_000_001));
        }
        {
            let a = OldDecimal::new(42);
            let b = OldDecimal::from_integer(10);
            assert_eq!(a.div_up(b), OldDecimal::new(5));
        }
    }

    #[test]
    fn test_sqrt() {
        assert!(OldDecimal::from_integer(9)
            .sqrt()
            .gt(&OldDecimal::new(DENOMINATOR * 7 / 5)));
        assert!(OldDecimal::from_integer(2)
            .sqrt()
            .lt(&OldDecimal::new(DENOMINATOR * 3 / 2)));
    }

    #[test]
    fn test_pow() {
        // Zero base
        {
            let base = OldDecimal::new(0);
            let exp = 100;
            let result = base.pow(exp);
            assert_eq!(result, OldDecimal::new(0));
        }
        // Zero exponent
        {
            let base = OldDecimal::from_integer(10);
            let exp = 0;
            let result = base.pow(exp);
            let expected = OldDecimal::from_integer(1);
            assert_eq!(result, expected);
        }
        // 2^17
        {
            let base = OldDecimal::from_integer(2);
            let exp = 17;
            let result = base.pow(exp);
            // should be 131072
            let expected = OldDecimal::from_integer(131072);
            assert_eq!(result, expected);
        }
        // 1.00000002^525600
        {
            let base = OldDecimal::from_decimal(1_000_000_02, 8);
            let exp = 525600;
            let result = base.pow(exp);
            // expected 1.010567433635
            // real     1.0105674450753...
            let expected = OldDecimal::new(1010567433635);
            assert_eq!(result, expected);
        }
        // 1.000000015^2
        {
            let base = OldDecimal::from_decimal(1_000_000_015, 9);
            let exp = 2;
            let result = base.pow(exp);
            // expected 1.000000030000
            // real     1.0000000300000002...
            let expected = OldDecimal::new(1000000030000);
            assert_eq!(result, expected);
        }
        // 1^525600
        {
            let base = OldDecimal::from_integer(1);
            let exp = 525600;
            let result = base.pow(exp);
            // expected not change value
            let expected = OldDecimal::from_integer(1);
            assert_eq!(result, expected);
        }
        // 1^(-1)
        {
            let base = OldDecimal::from_integer(1);
            let exp = -1;
            let result = base.pow(exp);
            let expected = OldDecimal::from_integer(1);
            assert_eq!(result, expected);
        }
        // 2^(-3)
        {
            let base = OldDecimal::from_integer(2);
            let exp = -12;
            let result = base.pow(exp);
            let expected = OldDecimal::new(244140625);
            assert_eq!(result, expected);
        }
        // 3^(-5)
        {
            let base = OldDecimal::from_integer(3);
            let exp = -5;
            let result = base.pow(exp);
            // expected 4.115226337
            // real     4.11522633744855967...
            let expected = OldDecimal::new(4115226337);
            assert_eq!(result, expected);
        }
        // 0.03^(-2)
        {
            let base = OldDecimal::from_decimal(0_03, 2);
            let exp = -2;
            let result = base.pow(exp);
            let expected = OldDecimal::new(1111111111111111);
            assert_eq!(result, expected);
        }
        // 0.99^(-365)
        {
            let base = OldDecimal::from_decimal(0_99, 2);
            let exp = -365;
            let result = base.pow(exp);
            // expected 3.9188078734077
            // real     3.9188078730559...
            let expected = OldDecimal::new(39188078734077);
            assert_eq!(result, expected);
        }
        // 1.001^(-100000)
        {
            let base = OldDecimal::from_decimal(1_000_1, 4);
            let exp = -100_000;
            let result = base.pow(exp);
            // expected 0.000045422634
            // real     0.0000454226338...
            let expected = OldDecimal::new(45422634);
            assert_eq!(result, expected);
        }
    }

    #[test]
    fn test_to_token() {
        // equal
        {
            let d = OldDecimal::from_integer(1);

            assert_eq!(d.to_token_floor(), OldTokenAmount(1));
            assert_eq!(d.to_token_ceil(), OldTokenAmount(1));
        }
        // little over
        {
            let d = OldDecimal::from_integer(1) + OldDecimal::new(1);

            assert_eq!(d.to_token_floor(), OldTokenAmount(1));
            assert_eq!(d.to_token_ceil(), OldTokenAmount(2));
        }
        // little below
        {
            let d = OldDecimal::from_integer(2) - OldDecimal::new(1);

            assert_eq!(d.to_token_floor(), OldTokenAmount(1));
            assert_eq!(d.to_token_ceil(), OldTokenAmount(2));
        }
    }

    #[test]
    fn test_big_mul() {
        // precision
        {
            let a = OldDecimal::from_integer(1);
            let b = OldDecimal::from_integer(1);
            let c = a.big_mul(b);
            assert_eq!(c, OldDecimal::from_integer(1));
        }
        // simple
        {
            let a = OldDecimal::from_integer(2);
            let b = OldDecimal::from_integer(3);
            let c = a.big_mul(b);
            assert_eq!(c, OldDecimal::from_integer(6));
        }
        // big
        {
            let a = OldDecimal::new(2u128.pow(127));
            let b = OldDecimal::from_integer(1);
            let c = a.big_mul(b);
            assert_eq!(c, a);
        }
        // random
        {
            let a = OldDecimal::new(87932487422289);
            let b = OldDecimal::from_integer(982383286787);
            let c = a.big_mul(b);
            // 87932487422289 * 982383286787
            assert_eq!(c, OldDecimal::new(86383406009264805062995443));
        }
    }

    #[test]
    fn test_big_mul_up() {
        // mul of little
        {
            let a = OldDecimal::new(1);
            let b = OldDecimal::new(1);
            assert_eq!(a.big_mul_up(b), OldDecimal::new(1));
        }
        // mul calculable without precision loss
        {
            let a = OldDecimal::from_integer(1);
            let b = OldDecimal::from_integer(3) / OldDecimal::new(10);
            assert_eq!(a.big_mul_up(b), b);
        }
        {
            let a = OldDecimal::from_integer(3) / OldDecimal::from_integer(10);
            let b = OldDecimal::new(3);
            assert_eq!(a.big_mul_up(b), OldDecimal::new(1));
        }
        {
            let a = OldDecimal::new(2u128.pow(127) - 1);
            let b = OldDecimal::new(999999999999);
            let result = OldDecimal::new(170141183460299090548226834484152418424);
            assert_eq!(a.big_mul_up(b), result);
        }
    }

    #[test]
    fn test_big_div() {
        // decimals
        {
            let a = OldDecimal::new(1);
            let b = OldDecimal::from_integer(1);
            assert_eq!(a.big_div(b), OldDecimal::new(1));
        }
        // mul calculable without precision loss
        {
            let a = OldDecimal::from_integer(111);
            let b = OldDecimal::from_integer(37);
            assert_eq!(a.big_div(b), OldDecimal::from_integer(3));
        }
        {
            let a = OldDecimal::from_integer(1);
            let b = OldDecimal::from_integer(3);
            assert_eq!(a.big_div(b), OldDecimal::new(333333333333));
        }
        {
            let a = OldDecimal::new(2u128.pow(127));
            let b = OldDecimal::new(973_248708703324);
            let result = OldDecimal::new(174817784949492774410002348183691207);
            assert_eq!(a.big_div(b), result);
        }
    }

    #[test]
    fn test_big_div_up() {
        // decimals
        {
            let a = OldDecimal::new(1);
            let b = OldDecimal::from_integer(1);
            assert_eq!(a.big_div_up(b), OldDecimal::new(1));
        }
        // mul calculable without precision loss
        {
            let a = OldDecimal::from_integer(111);
            let b = OldDecimal::from_integer(37);
            assert_eq!(a.big_div_up(b), OldDecimal::from_integer(3));
        }
        {
            let a = OldDecimal::from_integer(1);
            let b = OldDecimal::from_integer(3);
            assert_eq!(a.big_div_up(b), OldDecimal::new(333333333334));
        }
        {
            let a = OldDecimal::new(2u128.pow(127));
            let b = OldDecimal::new(973_248708703324);
            let result = OldDecimal::new(174817784949492774410002348183691208);
            assert_eq!(a.big_div_up(b), result);
        }
    }
}
