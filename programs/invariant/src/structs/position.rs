use crate::old_decimal::OldDecimal;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::OldFeeGrowth;
use crate::*;
use anchor_lang::prelude::*;

use super::OldTokenAmount;

#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct Position {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub id: u128, // unique inside pool
    pub liquidity: OldDecimal,
    pub lower_tick_index: i32,
    pub upper_tick_index: i32,
    pub fee_growth_inside_x: OldFeeGrowth,
    pub fee_growth_inside_y: OldFeeGrowth,
    pub seconds_per_liquidity_inside: OldDecimal,
    pub last_slot: u64,
    pub tokens_owed_x: OldDecimal,
    pub tokens_owed_y: OldDecimal,
    pub bump: u8,
}

impl Position {
    pub fn modify(
        &mut self,
        pool: &mut Pool,
        upper_tick: &mut Tick,
        lower_tick: &mut Tick,
        liquidity_delta: OldDecimal,
        add: bool,
        current_timestamp: u64,
    ) -> Result<(OldTokenAmount, OldTokenAmount)> {
        if { pool.liquidity } != OldDecimal::new(0) {
            pool.update_seconds_per_liquidity_global(current_timestamp);
        } else {
            pool.last_timestamp = current_timestamp;
        }

        // update initialized tick
        lower_tick.update(liquidity_delta, false, add)?;

        upper_tick.update(liquidity_delta, true, add)?;

        // update fee inside position
        let (fee_growth_inside_x, fee_growth_inside_y) = calculate_fee_growth_inside(
            *lower_tick,
            *upper_tick,
            pool.current_tick_index,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
        );

        self.update(
            add,
            liquidity_delta,
            fee_growth_inside_x,
            fee_growth_inside_y,
        )?;

        // calculate tokens amounts and update pool liquidity
        let token_amounts = calculate_amount_delta(
            pool,
            liquidity_delta,
            add,
            upper_tick.index,
            lower_tick.index,
        )?;

        Ok(token_amounts)
    }

    pub fn update(
        &mut self,
        sign: bool,
        liquidity_delta: OldDecimal,
        fee_growth_inside_x: OldFeeGrowth,
        fee_growth_inside_y: OldFeeGrowth,
    ) -> Result<()> {
        require!(
            liquidity_delta.v != 0 || self.liquidity.v != 0,
            ErrorCode::EmptyPositionPokes
        );

        // calculate accumulated fee
        let tokens_owed_x = (fee_growth_inside_x - self.fee_growth_inside_x).to_fee(self.liquidity);
        let tokens_owed_y = (fee_growth_inside_y - self.fee_growth_inside_y).to_fee(self.liquidity);

        self.liquidity = self.calculate_new_liquidity_safely(sign, liquidity_delta)?;
        self.fee_growth_inside_x = fee_growth_inside_x;
        self.fee_growth_inside_y = fee_growth_inside_y;
        self.tokens_owed_x = self.tokens_owed_x + tokens_owed_x;
        self.tokens_owed_y = self.tokens_owed_y + tokens_owed_y;

        Ok(())
    }

    pub fn initialized_id(&mut self, pool: &mut Pool) {
        self.id = pool.position_iterator;
        pool.position_iterator += 1; // REVIEW maybe u128 just to make sure we don't overflow 😆
    }

    // for future use
    pub fn get_id(self) -> String {
        let mut id = self.pool.to_string();
        id.push_str({ self.id }.to_string().as_str());
        id
    }

    // TODO: add tests
    fn calculate_new_liquidity_safely(
        &mut self,
        sign: bool,
        liquidity_delta: OldDecimal,
    ) -> Result<OldDecimal> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_new_liquidity_safely() {
        // negative liquidity error
        {
            let mut position = Position {
                liquidity: OldDecimal::from_integer(1),
                ..Default::default()
            };
            let sign: bool = false;
            let liquidity_delta: OldDecimal = OldDecimal::from_integer(2);

            let result = position.calculate_new_liquidity_safely(sign, liquidity_delta);

            assert!(result.is_err());
        }
        // adding liquidity
        {
            let mut position = Position {
                liquidity: OldDecimal::from_integer(2),
                ..Default::default()
            };
            let sign: bool = true;
            let liquidity_delta: OldDecimal = OldDecimal::from_integer(2);

            let new_liquidity = position
                .calculate_new_liquidity_safely(sign, liquidity_delta)
                .unwrap();

            assert_eq!(new_liquidity, OldDecimal::from_integer(4));
        }
        // subtracting liquidity
        {
            let mut position = Position {
                liquidity: OldDecimal::from_integer(2),
                ..Default::default()
            };
            let sign: bool = false;
            let liquidity_delta: OldDecimal = OldDecimal::from_integer(2);

            let new_liquidity = position
                .calculate_new_liquidity_safely(sign, liquidity_delta)
                .unwrap();

            assert_eq!(new_liquidity, OldDecimal::from_integer(0));
        }
    }

    #[test]
    fn test_update() {
        // Disable empty position pokes error
        {
            let mut position = Position {
                liquidity: OldDecimal::from_integer(0),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = OldDecimal::from_integer(0);
            let fee_growth_inside_x = OldFeeGrowth::from_integer(1);
            let fee_growth_inside_y = OldFeeGrowth::from_integer(1);

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
                liquidity: OldDecimal::from_integer(0),
                fee_growth_inside_x: OldFeeGrowth::from_integer(4),
                fee_growth_inside_y: OldFeeGrowth::from_integer(4),
                tokens_owed_x: OldDecimal::from_integer(100),
                tokens_owed_y: OldDecimal::from_integer(100),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = OldDecimal::from_integer(1);
            let fee_growth_inside_x = OldFeeGrowth::from_integer(5);
            let fee_growth_inside_y = OldFeeGrowth::from_integer(5);

            position
                .update(
                    sign,
                    liquidity_delta,
                    fee_growth_inside_x,
                    fee_growth_inside_y,
                )
                .unwrap();

            assert_eq!({ position.liquidity }, OldDecimal::from_integer(1));
            assert_eq!(
                { position.fee_growth_inside_x },
                OldFeeGrowth::from_integer(5)
            );
            assert_eq!(
                { position.fee_growth_inside_y },
                OldFeeGrowth::from_integer(5)
            );
            assert_eq!({ position.tokens_owed_x }, OldDecimal::from_integer(100));
            assert_eq!({ position.tokens_owed_y }, OldDecimal::from_integer(100));
        }
        // fee should change
        {
            let mut position = Position {
                liquidity: OldDecimal::from_integer(1),
                fee_growth_inside_x: OldFeeGrowth::from_integer(4),
                fee_growth_inside_y: OldFeeGrowth::from_integer(4),
                tokens_owed_x: OldDecimal::from_integer(100),
                tokens_owed_y: OldDecimal::from_integer(100),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = OldDecimal::from_integer(1);
            let fee_growth_inside_x = OldFeeGrowth::from_integer(5);
            let fee_growth_inside_y = OldFeeGrowth::from_integer(5);

            position
                .update(
                    sign,
                    liquidity_delta,
                    fee_growth_inside_x,
                    fee_growth_inside_y,
                )
                .unwrap();

            assert_eq!({ position.liquidity }, OldDecimal::from_integer(2));
            assert_eq!(
                { position.fee_growth_inside_x },
                OldFeeGrowth::from_integer(5)
            );
            assert_eq!(
                { position.fee_growth_inside_y },
                OldFeeGrowth::from_integer(5)
            );
            assert_eq!({ position.tokens_owed_x }, OldDecimal::from_integer(101));
            assert_eq!({ position.tokens_owed_y }, OldDecimal::from_integer(101));
        }
    }

    #[test]
    fn test_modify() {
        // owed tokens after overflow
        {
            let mut position = Position {
                liquidity: OldDecimal::from_integer(123),
                fee_growth_inside_x: OldFeeGrowth::new(u128::MAX)
                    - OldFeeGrowth::from_integer(1234),
                fee_growth_inside_y: OldFeeGrowth::new(u128::MAX)
                    - OldFeeGrowth::from_integer(1234),
                tokens_owed_x: OldDecimal::from_integer(0),
                tokens_owed_y: OldDecimal::from_integer(0),
                ..Default::default()
            };
            let mut pool = Pool {
                current_tick_index: 0,
                fee_growth_global_x: OldFeeGrowth::from_integer(20),
                fee_growth_global_y: OldFeeGrowth::from_integer(20),
                ..Default::default()
            };
            let mut upper_tick = Tick {
                index: -10,
                fee_growth_outside_x: OldFeeGrowth::from_integer(15),
                fee_growth_outside_y: OldFeeGrowth::from_integer(15),
                liquidity_gross: OldDecimal::from_integer(123),
                ..Default::default()
            };
            let mut lower_tick = Tick {
                index: -20,
                fee_growth_outside_x: OldFeeGrowth::from_integer(20),
                fee_growth_outside_y: OldFeeGrowth::from_integer(20),
                liquidity_gross: OldDecimal::from_integer(123),
                ..Default::default()
            };
            let liquidity_delta = OldDecimal::from_integer(0);
            let add = true;
            let current_timestamp: u64 = 1234567890;

            position
                .modify(
                    &mut pool,
                    &mut upper_tick,
                    &mut lower_tick,
                    liquidity_delta,
                    add,
                    current_timestamp,
                )
                .unwrap();

            // assert_eq!(
            //     { position.tokens_owed_x },
            //     (Decimal::from_integer(1234 - 5) + Decimal::new(1)) * Decimal::from_integer(123)
            // ) // 151167000000000123 so close enough?

            assert_eq!(
                { position.tokens_owed_x },
                OldDecimal::new(151167000000000000)
            );
        }
    }
}
