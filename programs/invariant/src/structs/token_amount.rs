use crate::old_decimal::{OldDecimal, DENOMINATOR};
use crate::uint::U256;
use std::ops::{Add, Sub};

#[derive(Default, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct OldTokenAmount(pub u64);

impl OldTokenAmount {
    pub fn is_zero(&self) -> bool {
        self.0 == 0
    }

    // this is a lossless operation so no 'up' version needed
    pub fn big_mul(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            U256::from(self.0)
                .checked_mul(U256::from(other.v))
                .unwrap()
                .as_u128(),
        )
    }

    pub fn big_div(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            U256::from(self.0)
                .checked_mul(U256::from(DENOMINATOR.checked_mul(DENOMINATOR).unwrap()))
                .unwrap()
                .checked_div(U256::from(other.v))
                .unwrap()
                .as_u128(),
        )
    }

    pub fn big_div_up(self, other: OldDecimal) -> OldDecimal {
        OldDecimal::new(
            U256::from(self.0)
                .checked_mul(U256::from(DENOMINATOR.checked_mul(DENOMINATOR).unwrap()))
                .unwrap()
                .checked_add(U256::from(other.v.checked_sub(1).unwrap()))
                .unwrap()
                .checked_div(U256::from(other.v))
                .unwrap()
                .as_u128(),
        )
    }
}

impl Add for OldTokenAmount {
    type Output = OldTokenAmount;

    fn add(self, other: OldTokenAmount) -> OldTokenAmount {
        OldTokenAmount(self.0.checked_add(other.0).unwrap())
    }
}

impl Sub for OldTokenAmount {
    type Output = OldTokenAmount;

    fn sub(self, other: OldTokenAmount) -> OldTokenAmount {
        OldTokenAmount(self.0.checked_sub(other.0).unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_big_mul() {
        // precision
        {
            let a = OldTokenAmount(1);
            let b = OldDecimal::from_integer(1);
            let c = a.big_mul(b);
            assert_eq!(c, OldDecimal::from_integer(1));
        }
        // simple
        {
            let a = OldTokenAmount(2);
            let b = OldDecimal::from_integer(3);
            let c = a.big_mul(b);
            assert_eq!(c, OldDecimal::from_integer(6));
        }
        // big
        {
            let a = OldTokenAmount(1);
            let b = OldDecimal::new(2u128.pow(127));
            let c = a.big_mul(b);
            assert_eq!(c, b);
        }
        // random
        {
            let a = OldTokenAmount(982383286787);
            let b = OldDecimal::new(87932487422289);
            let c = a.big_mul(b);
            // 87932487422289 * 982383286787
            assert_eq!(c, OldDecimal::new(86383406009264805062995443));
        }
    }

    #[test]
    fn test_big_div() {
        {
            let a = OldTokenAmount(1);
            let b = OldDecimal::from_integer(1000000000000);
            assert_eq!(a.big_div(b), OldDecimal::new(1));
        }
        {
            let a = OldTokenAmount(111);
            let b = OldDecimal::from_integer(37);
            assert_eq!(a.big_div(b), OldDecimal::from_integer(3));
            assert_eq!(a.big_div_up(b), OldDecimal::from_integer(3));
        }
        {
            let a = OldTokenAmount(1);
            let b = OldDecimal::from_integer(3);
            assert_eq!(a.big_div(b), OldDecimal::new(333333333333));
            assert_eq!(a.big_div_up(b), OldDecimal::new(333333333334));
        }
    }

    #[test]
    fn ops() {
        // Add
        {
            assert_eq!(OldTokenAmount(0) + OldTokenAmount(0), OldTokenAmount(0));
            assert_eq!(
                OldTokenAmount(10000000000) + OldTokenAmount(2345678910),
                OldTokenAmount(12345678910)
            );
        }
        // Sub
        {
            assert_eq!(OldTokenAmount(0) + OldTokenAmount(0), OldTokenAmount(0));
            assert_eq!(
                OldTokenAmount(12345678910) - OldTokenAmount(2345678910),
                OldTokenAmount(10000000000)
            );
        }
    }
}
