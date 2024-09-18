use crate::ErrorCode::{self};
use crate::*;
use anchor_lang::prelude::*;
use decimals::*;

#[account(zero_copy(unsafe))]
#[repr(packed)]
#[derive(PartialEq, Default, Debug, InitSpace)]
pub struct Tick {
    pub pool: Pubkey,
    pub index: i32,
    pub sign: bool, // true means positive
    pub liquidity_change: Liquidity,
    pub liquidity_gross: Liquidity,
    pub sqrt_price: Price,
    pub fee_growth_outside_x: FeeGrowth,
    pub fee_growth_outside_y: FeeGrowth,
    pub seconds_per_liquidity_outside: FixedPoint,
    pub seconds_outside: u64,
    pub bump: u8,
}

account_size!(Tick);

impl Tick {
    pub fn update(
        &mut self,
        liquidity_delta: Liquidity,
        max_liquidity_per_tick: Liquidity,
        is_upper: bool,
        is_deposit: bool,
    ) -> Result<()> {
        self.liquidity_gross = self.calculate_new_liquidity_gross_safely(
            is_deposit,
            liquidity_delta,
            max_liquidity_per_tick,
        )?;

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
        max_liquidity_per_tick: Liquidity,
    ) -> Result<Liquidity> {
        // validate in decrease liquidity case
        if !sign && { self.liquidity_gross } < liquidity_delta {
            return Err(ErrorCode::InvalidTickLiquidity.into());
        }
        let new_liquidity = match sign {
            true => self.liquidity_gross + liquidity_delta,
            false => self.liquidity_gross - liquidity_delta,
        };
        // validate in increase liquidity case
        if sign && new_liquidity >= max_liquidity_per_tick {
            return Err(ErrorCode::InvalidTickLiquidity.into());
        }

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
        let max_liquidity = Liquidity::new(u128::MAX);
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

            tick.update(liquidity_delta, max_liquidity, is_upper, is_deposit)
                .unwrap();

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

            tick.update(liquidity_delta, max_liquidity, is_upper, is_deposit)
                .unwrap();

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Liquidity::from_integer(2));
            assert_eq!({ tick.liquidity_gross }, Liquidity::from_integer(8));
            assert_eq!({ tick.fee_growth_outside_x }, FeeGrowth::from_integer(13));
            assert_eq!({ tick.fee_growth_outside_y }, FeeGrowth::from_integer(11));
        }
        // exceed max tick liquidity
        {
            let mut tick = Tick {
                // index: 5,
                sign: true,
                liquidity_change: Liquidity::from_integer(100_000),
                liquidity_gross: Liquidity::from_integer(100_000),
                fee_growth_outside_x: FeeGrowth::from_integer(1000),
                fee_growth_outside_y: FeeGrowth::from_integer(1000),
                ..Default::default()
            };

            let max_liquidity_per_tick = calculate_max_liquidity_per_tick(1);
            let liquidity_delta = max_liquidity_per_tick + Liquidity::new(1);
            let result = tick.update(liquidity_delta, max_liquidity_per_tick, false, true);
            assert!(result.is_err());
        }
    }
}
