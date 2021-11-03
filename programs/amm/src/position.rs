use std::ops::Mul;

use anchor_lang::require;

use crate::math::get_delta_y;
use crate::*;

impl Pool {
    pub fn update_liquidity_safely(
        self: &mut Self,
        liquidity_delta: Decimal,
        add: bool,
    ) -> Result<()> {
        // validate in decrease liquidity case
        if !add && { self.liquidity } < liquidity_delta {
            return Err(ErrorCode::InvalidPoolLiquidity.into());
        };
        // pool liquidity can cannot be negative
        self.liquidity = match add {
            true => self.liquidity + liquidity_delta,
            false => self.liquidity - liquidity_delta,
        };

        Ok(())
    }
}

impl Position {
    pub fn update(
        self: &mut Self,
        sign: bool,
        liquidity_delta: Decimal,
        fee_growth_inside_x: Decimal,
        fee_growth_inside_y: Decimal,
    ) -> Result<()> {
        require!(
            liquidity_delta.v != 0 || self.liquidity.v != 0,
            ErrorCode::EmptyPositionPokes
        );

        // calculate accumulated fee
        let tokens_owed_x = self
            .liquidity
            .mul(fee_growth_inside_x - self.fee_growth_inside_x);
        let tokens_owed_y = self
            .liquidity
            .mul(fee_growth_inside_y - self.fee_growth_inside_y);

        self.liquidity = self.calculate_new_liquidity_safely(sign, liquidity_delta)?;
        self.fee_growth_inside_x = fee_growth_inside_x;
        self.fee_growth_inside_y = fee_growth_inside_y;
        self.tokens_owed_x = self.tokens_owed_x + tokens_owed_x;
        self.tokens_owed_y = self.tokens_owed_y + tokens_owed_y;

        Ok(())
    }

    pub fn initialized_id(self: &mut Self, pool: &mut Pool) {
        self.id = pool.position_iterator;
        pool.position_iterator += 1;
    }

    // for future use
    pub fn get_id(self: Self) -> String {
        let mut id = self.pool.to_string().to_owned();
        id.push_str({ self.id }.to_string().as_str());
        id
    }

    // TODO: add tests
    fn calculate_new_liquidity_safely(
        self: &mut Self,
        sign: bool,
        liquidity_delta: Decimal,
    ) -> Result<Decimal> {
        // validate in decrease liquidity case
        if !sign && { self.liquidity } < liquidity_delta {
            return Err(ErrorCode::InvalidPositionLiquidity.into());
        }

        Ok(match sign {
            true => self.liquidity + liquidity_delta,
            false => self.liquidity - liquidity_delta,
        })
    }
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

pub fn calculate_fee_growth_inside(
    tick_lower: Tick,
    tick_upper: Tick,
    tick_current: i32,
    fee_growth_global_x: Decimal,
    fee_growth_global_y: Decimal,
) -> (Decimal, Decimal) {
    // determine position relative to current tick
    let current_above_lower = tick_current >= tick_lower.index;
    let current_below_upper = tick_current < tick_upper.index;

    // calculate fee growth below
    let fee_growth_below_x = if current_above_lower {
        tick_lower.fee_growth_outside_x
    } else {
        fee_growth_global_x - tick_lower.fee_growth_outside_x
    };
    let fee_growth_below_y = if current_above_lower {
        tick_lower.fee_growth_outside_y
    } else {
        fee_growth_global_y - tick_lower.fee_growth_outside_y
    };

    // calculate fee growth above
    let fee_growth_above_x = if current_below_upper {
        tick_upper.fee_growth_outside_x
    } else {
        fee_growth_global_x - tick_upper.fee_growth_outside_x
    };
    let fee_growth_above_y = if current_below_upper {
        tick_upper.fee_growth_outside_y
    } else {
        fee_growth_global_y - tick_upper.fee_growth_outside_y
    };

    // calculate fee growth inside
    let fee_growth_inside_x = fee_growth_global_x - fee_growth_below_x - fee_growth_above_x;
    let fee_growth_inside_y = fee_growth_global_y - fee_growth_below_y - fee_growth_above_y;

    (fee_growth_inside_x, fee_growth_inside_y)
}

pub fn calculate_amount_delta(
    pool: &mut Pool,
    liquidity_delta: Decimal,
    liquidity_sign: bool,
    upper_tick: i32,
    lower_tick: i32,
) -> Result<(u64, u64)> {
    // assume that upper_tick > lower_tick
    let mut amount_x = Decimal::new(0);
    let mut amount_y = Decimal::new(0);

    if pool.current_tick_index < lower_tick {
        amount_x = get_delta_x(
            calculate_price_sqrt(lower_tick),
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        );
    } else if pool.current_tick_index < upper_tick {
        // calculating price_sqrt of current_tick is not required - can by pass
        amount_x = get_delta_x(
            pool.sqrt_price,
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        );
        amount_y = get_delta_y(
            calculate_price_sqrt(lower_tick),
            pool.sqrt_price,
            liquidity_delta,
            liquidity_sign,
        );

        pool.update_liquidity_safely(liquidity_delta, liquidity_sign)?;
    } else {
        amount_y = get_delta_y(
            calculate_price_sqrt(lower_tick),
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        )
    }

    // rounding up when depositing, down when withdrawing
    Ok(match liquidity_sign {
        true => (amount_x.to_token_ceil(), amount_y.to_token_ceil()),
        false => (amount_x.to_token_floor(), amount_y.to_token_floor()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_fee_growth_inside() {
        let fee_growth_global_x = Decimal::from_integer(15);
        let fee_growth_global_y = Decimal::from_integer(15);
        let mut tick_lower = Tick {
            index: -2,
            fee_growth_outside_x: Decimal::new(0),
            fee_growth_outside_y: Decimal::new(0),
            ..Default::default()
        };
        let mut tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: Decimal::from_integer(0),
            fee_growth_outside_y: Decimal::new(0),
            ..Default::default()
        };
        // current tick inside range
        // lower    current     upper
        // |        |           |
        // -2       0           2
        {
            // index and fee global
            let tick_current = 0;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::from_integer(15)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::from_integer(15)); // y fee growth inside
        }
        // current tick below range
        // current  lower       upper
        // |        |           |
        // -4       2           2
        {
            let tick_current = -4;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::new(0)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::new(0)); // y fee growth inside
        }

        // current tick upper range
        // lower    upper       current
        // |        |           |
        // -2       2           4
        {
            let tick_current = 4;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::new(0)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::new(0)); // y fee growth inside
        }

        // subtracts upper tick if below
        tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: Decimal::from_integer(2),
            fee_growth_outside_y: Decimal::from_integer(3),
            ..Default::default()
        };
        // current tick inside range
        // lower    current     upper
        // |        |           |
        // -2       0           2
        {
            let tick_current = 0;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::from_integer(13)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::from_integer(12)); // y fee growth inside
        }

        // subtracts lower tick if above
        tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: Decimal::new(0),
            fee_growth_outside_y: Decimal::new(0),
            ..Default::default()
        };
        tick_lower = Tick {
            index: -2,
            fee_growth_outside_x: Decimal::from_integer(2),
            fee_growth_outside_y: Decimal::from_integer(3),
            ..Default::default()
        };
        // current tick inside range
        // lower    current     upper
        // |        |           |
        // -2       0           2
        {
            let tick_current = 0;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::from_integer(13)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::from_integer(12)); // y fee growth inside
        }
    }

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
    fn test_update_tick() {
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

    #[test]
    fn test_calculate_new_liquidity_safely() {
        // negative liquidity error
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(1),
                ..Default::default()
            };
            let sign: bool = false;
            let liquidity_delta: Decimal = Decimal::from_integer(2);

            let result = position.calculate_new_liquidity_safely(sign, liquidity_delta);

            assert!(result.is_err());
        }
        // adding liquidity
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(2),
                ..Default::default()
            };
            let sign: bool = true;
            let liquidity_delta: Decimal = Decimal::from_integer(2);

            let new_liquidity = position
                .calculate_new_liquidity_safely(sign, liquidity_delta)
                .unwrap();

            assert_eq!(new_liquidity, Decimal::from_integer(4));
        }
        // subtracting liquidity
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(2),
                ..Default::default()
            };
            let sign: bool = false;
            let liquidity_delta: Decimal = Decimal::from_integer(2);

            let new_liquidity = position
                .calculate_new_liquidity_safely(sign, liquidity_delta)
                .unwrap();

            assert_eq!(new_liquidity, Decimal::from_integer(0));
        }
    }

    #[test]
    fn test_update_position() {
        // Disable empty position pokes error
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(0),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = Decimal::from_integer(0);
            let fee_growth_inside_x = Decimal::from_integer(1);
            let fee_growth_inside_y = Decimal::from_integer(1);

            let result = position.update(
                sign,
                liquidity_delta,
                fee_growth_inside_x,
                fee_growth_inside_y,
            );

            assert!(result.is_err());
        }
        // zero liquidity fee shouldn't change
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(0),
                fee_growth_inside_x: Decimal::from_integer(4),
                fee_growth_inside_y: Decimal::from_integer(4),
                tokens_owed_x: Decimal::from_integer(100),
                tokens_owed_y: Decimal::from_integer(100),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = Decimal::from_integer(1);
            let fee_growth_inside_x = Decimal::from_integer(5);
            let fee_growth_inside_y = Decimal::from_integer(5);

            position
                .update(
                    sign,
                    liquidity_delta,
                    fee_growth_inside_x,
                    fee_growth_inside_y,
                )
                .unwrap();

            assert_eq!({ position.liquidity }, Decimal::from_integer(1));
            assert_eq!({ position.fee_growth_inside_x }, Decimal::from_integer(5));
            assert_eq!({ position.fee_growth_inside_y }, Decimal::from_integer(5));
            assert_eq!({ position.tokens_owed_x }, Decimal::from_integer(100));
            assert_eq!({ position.tokens_owed_y }, Decimal::from_integer(100));
        }
        // fee should change
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(1),
                fee_growth_inside_x: Decimal::from_integer(4),
                fee_growth_inside_y: Decimal::from_integer(4),
                tokens_owed_x: Decimal::from_integer(100),
                tokens_owed_y: Decimal::from_integer(100),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = Decimal::from_integer(1);
            let fee_growth_inside_x = Decimal::from_integer(5);
            let fee_growth_inside_y = Decimal::from_integer(5);

            position
                .update(
                    sign,
                    liquidity_delta,
                    fee_growth_inside_x,
                    fee_growth_inside_y,
                )
                .unwrap();

            assert_eq!({ position.liquidity }, Decimal::from_integer(2));
            assert_eq!({ position.fee_growth_inside_x }, Decimal::from_integer(5));
            assert_eq!({ position.fee_growth_inside_y }, Decimal::from_integer(5));
            assert_eq!({ position.tokens_owed_x }, Decimal::from_integer(101));
            assert_eq!({ position.tokens_owed_y }, Decimal::from_integer(101));
        }
    }

    #[test]
    fn test_update_liquidity_safely_pool() {
        // Invalid pool liquidity
        {
            let mut pool = Pool {
                liquidity: Decimal::new(0),
                ..Default::default()
            };
            let liquidity_delta = Decimal::one();
            let add = false;

            let result = pool.update_liquidity_safely(liquidity_delta, add);

            assert!(result.is_err());
        }
        // adding liquidity
        {
            let mut pool = Pool {
                liquidity: Decimal::one(),
                ..Default::default()
            };
            let liquidity_delta: Decimal = Decimal::from_integer(2);
            let add: bool = true;

            pool.update_liquidity_safely(liquidity_delta, add).unwrap();

            assert_eq!({ pool.liquidity }, Decimal::from_integer(3));
        }
        // subtracting liquidity
        {
            let mut pool = Pool {
                liquidity: Decimal::from_integer(3),
                ..Default::default()
            };
            let liquidity_delta: Decimal = Decimal::from_integer(2);
            let add: bool = false;

            pool.update_liquidity_safely(liquidity_delta, add).unwrap();

            assert_eq!({ pool.liquidity }, Decimal::one());
        }
    }

    #[test]
    fn test_calculate_amount_delta() {
        // current tick smaller than lower tick
        {
            let mut pool = Pool {
                liquidity: Decimal::from_integer(0),
                current_tick_index: 0,
                ..Default::default()
            };

            let liquidity_delta = Decimal::from_integer(10);
            let liquidity_sign = true;
            let upper_tick = 4;
            let lower_tick = 2;

            let result = calculate_amount_delta(
                &mut pool,
                liquidity_delta,
                liquidity_sign,
                upper_tick,
                lower_tick,
            )
            .unwrap();

            assert_eq!(result.0, 1);
            assert_eq!(result.1, 0);
        }
        // current tick greater than upper tick
        {
            let mut pool = Pool {
                liquidity: Decimal::from_integer(0),
                current_tick_index: 6,
                ..Default::default()
            };

            let liquidity_delta = Decimal::from_integer(10);
            let liquidity_sign = true;
            let upper_tick = 4;
            let lower_tick = 2;

            let result = calculate_amount_delta(
                &mut pool,
                liquidity_delta,
                liquidity_sign,
                upper_tick,
                lower_tick,
            )
            .unwrap();

            assert_eq!(result.0, 0);
            assert_eq!(result.1, 1);
        }
    }
}
