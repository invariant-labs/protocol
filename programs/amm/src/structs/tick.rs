use crate::decimal::Decimal;
use crate::*;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Tick {
    pub index: i32,
    pub sign: bool, // true means positive
    pub liquidity_change: Decimal,
    pub liquidity_gross: Decimal,
    pub sqrt_price: Decimal,
    pub fee_growth_outside_x: Decimal,
    pub fee_growth_outside_y: Decimal,
    pub seconds_per_liquidity_outside: Decimal,
    pub seconds_outside: u64,
    pub bump: u8,
}

impl Tick {
    pub fn update(
        self: &mut Self,
        current_index: i32,
        liquidity_delta: Decimal,
        fee_growth_global_x: Decimal,
        fee_growth_global_y: Decimal,
        is_upper: bool,
        is_deposit: bool,
    ) -> Result<()> {
        if self.liquidity_gross.v == 0 && self.index <= current_index {
            self.fee_growth_outside_x = fee_growth_global_x;
            self.fee_growth_outside_y = fee_growth_global_y;
        }

        self.liquidity_gross =
            self.calculate_new_liquidity_gross_safely(is_deposit, liquidity_delta)?;

        self.update_liquidity_change(liquidity_delta, is_deposit ^ is_upper);
        Ok(())
    }

    fn update_liquidity_change(self: &mut Self, liquidity_delta: Decimal, add: bool) {
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
        self: Self,
        sign: bool,
        liquidity_delta: Decimal,
    ) -> Result<Decimal> {
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
                liquidity_change: Decimal::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Decimal::from_integer(3);
            let add = true;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Decimal::from_integer(5));
        }
        {
            let mut tick = Tick {
                sign: false,
                liquidity_change: Decimal::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Decimal::from_integer(3);
            let add = false;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, false);
            assert_eq!({ tick.liquidity_change }, Decimal::from_integer(5));
        }
        // update when tick sign and sign of liquidity change are different
        {
            let mut tick = Tick {
                sign: true,
                liquidity_change: Decimal::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Decimal::from_integer(3);
            let add = false;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, false);
            assert_eq!({ tick.liquidity_change }, Decimal::from_integer(1));
        }
        {
            let mut tick = Tick {
                sign: false,
                liquidity_change: Decimal::from_integer(2),
                ..Default::default()
            };
            let liquidity_delta = Decimal::from_integer(3);
            let add = true;
            tick.update_liquidity_change(liquidity_delta, add);

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Decimal::from_integer(1));
        }
    }

    #[test]
    fn test_update() {
        // TODO: make sure works fine
        {
            let mut tick = Tick {
                index: 0,
                sign: true,
                liquidity_change: Decimal::from_integer(2),
                liquidity_gross: Decimal::from_integer(2),
                fee_growth_outside_x: Decimal::from_integer(2),
                fee_growth_outside_y: Decimal::from_integer(2),
                ..Default::default()
            };
            let current_index: i32 = 0;
            let liquidity_delta: Decimal = Decimal::from_integer(1);
            let fee_growth_outside_x: Decimal = Decimal::from_integer(1);
            let fee_growth_outside_y: Decimal = Decimal::from_integer(1);
            let is_upper: bool = false;
            let is_deposit: bool = true;

            tick.update(
                current_index,
                liquidity_delta,
                fee_growth_outside_x,
                fee_growth_outside_y,
                is_upper,
                is_deposit,
            )
            .unwrap();

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Decimal::from_integer(3));
            assert_eq!({ tick.liquidity_gross }, Decimal::from_integer(3));
            assert_eq!({ tick.fee_growth_outside_x }, Decimal::from_integer(2));
            assert_eq!({ tick.fee_growth_outside_y }, Decimal::from_integer(2));
        }
        {
            let mut tick = Tick {
                index: 5,
                sign: true,
                liquidity_change: Decimal::from_integer(3),
                liquidity_gross: Decimal::from_integer(7),
                fee_growth_outside_x: Decimal::from_integer(13),
                fee_growth_outside_y: Decimal::from_integer(11),
                ..Default::default()
            };
            let current_index: i32 = 0;
            let liquidity_delta: Decimal = Decimal::from_integer(1);
            let fee_growth_outside_x: Decimal = Decimal::from_integer(1);
            let fee_growth_outside_y: Decimal = Decimal::from_integer(1);
            let is_upper: bool = true;
            let is_deposit: bool = true;

            tick.update(
                current_index,
                liquidity_delta,
                fee_growth_outside_x,
                fee_growth_outside_y,
                is_upper,
                is_deposit,
            )
            .unwrap();

            assert_eq!(tick.sign, true);
            assert_eq!({ tick.liquidity_change }, Decimal::from_integer(2));
            assert_eq!({ tick.liquidity_gross }, Decimal::from_integer(8));
            assert_eq!({ tick.fee_growth_outside_x }, Decimal::from_integer(13));
            assert_eq!({ tick.fee_growth_outside_y }, Decimal::from_integer(11));
        }
    }
}
