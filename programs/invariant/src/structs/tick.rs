use crate::old_decimal::OldDecimal;
use crate::*;
use anchor_lang::prelude::*;

use super::OldFeeGrowth;
use decimals::{FeeGrowth, Liquidity, Price};

#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct Tick {
    pub pool: Pubkey,
    pub index: i32,
    pub sign: bool, // true means positive
    pub liquidity_change: Liquidity,
    pub liquidity_gross: Liquidity,
    pub sqrt_price: Price,
    pub fee_growth_outside_x: FeeGrowth,
    pub fee_growth_outside_y: FeeGrowth,
    pub seconds_per_liquidity_outside: OldDecimal,
    pub seconds_outside: u64,
    pub bump: u8,
}

impl Tick {
    pub fn update(
        &mut self,
        liquidity_delta: Liquidity,
        is_upper: bool,
        is_deposit: bool,
    ) -> Result<()> {
        self.liquidity_gross =
            self.calculate_new_liquidity_gross_safely(is_deposit, liquidity_delta)?;

        self.update_liquidity_change(liquidity_delta, is_deposit ^ is_upper);
        Ok(())
    }

    fn update_liquidity_change(&mut self, liquidity_delta: Liquidity, add: bool) {
        if self.sign ^ add {
            if { self.liquidity_change } > liquidity_delta {
                self.liquidity_change = self.liquidity_change - liquidity_delta;
            } else {
                self.liquidity_change = liquidity_delta - self.liquidity_change;
                self.sign = !self.sign;
            }
        } else {
            self.liquidity_change = self.liquidity_change + liquidity_delta;
        }
    }

    fn calculate_new_liquidity_gross_safely(
        self,
        sign: bool,
        liquidity_delta: Liquidity,
    ) -> Result<Liquidity> {
        // validate in decrease liquidity case
        if !sign && { self.liquidity_gross } < liquidity_delta {
            return Err(ErrorCode::InvalidTickLiquidity.into());
        }

        let new_liquidity = match sign {
            true => self.liquidity_gross + liquidity_delta,
            false => self.liquidity_gross - liquidity_delta,
        };

        Ok(new_liquidity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_liquidity_change() {
        // update when tick sign and sign of liquidity change are the same
        {
            let mut tick = Tick {
                sign: true,
                liquidity_change: Liquidity::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Liquidity::from_integer(3);
            let add = true;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Liquidity::from_integer(5));
        }
        {
            let mut tick = Tick {
                sign: false,
                liquidity_change: Liquidity::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Liquidity::from_integer(3);
            let add = false;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, false);
            assert_eq!({ tick.liquidity_change }, Liquidity::from_integer(5));
        }
        // update when tick sign and sign of liquidity change are different
        {
            let mut tick = Tick {
                sign: true,
                liquidity_change: Liquidity::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Liquidity::from_integer(3);
            let add = false;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, false);
            assert_eq!({ tick.liquidity_change }, Liquidity::from_integer(1));
        }
        {
            let mut tick = Tick {
                sign: false,
                liquidity_change: Liquidity::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Liquidity::from_integer(3);
            let add = true;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Liquidity::from_integer(1));
        }
    }

    #[test]
    fn test_update() {
        // TODO: make sure works fine
        {
            let mut tick = Tick {
                index: 0,
                sign: true,
                liquidity_change: Liquidity::from_integer(2),
                liquidity_gross: Liquidity::from_integer(2),
                fee_growth_outside_x: FeeGrowth::from_integer(2),
                fee_growth_outside_y: FeeGrowth::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta: Liquidity = Liquidity::from_integer(1);
            let is_upper: bool = false;
            let is_deposit: bool = true;

            tick.update(liquidity_delta, is_upper, is_deposit).unwrap();

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Liquidity::from_integer(3));
            assert_eq!({ tick.liquidity_gross }, Liquidity::from_integer(3));
            assert_eq!({ tick.fee_growth_outside_x }, FeeGrowth::from_integer(2));
            assert_eq!({ tick.fee_growth_outside_y }, FeeGrowth::from_integer(2));
        }
        {
            let mut tick = Tick {
                index: 5,
                sign: true,
                liquidity_change: Liquidity::from_integer(3),
                liquidity_gross: Liquidity::from_integer(7),
                fee_growth_outside_x: FeeGrowth::from_integer(13),
                fee_growth_outside_y: FeeGrowth::from_integer(11),
                ..Default::default()
            };
            let liquidity_delta: Liquidity = Liquidity::from_integer(1);
            let is_upper: bool = true;
            let is_deposit: bool = true;

            tick.update(liquidity_delta, is_upper, is_deposit).unwrap();

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Liquidity::from_integer(2));
            assert_eq!({ tick.liquidity_gross }, Liquidity::from_integer(8));
            assert_eq!({ tick.fee_growth_outside_x }, FeeGrowth::from_integer(13));
            assert_eq!({ tick.fee_growth_outside_y }, FeeGrowth::from_integer(11));
        }
    }
}
