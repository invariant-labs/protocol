use crate::decimal::Decimal;
use crate::*;
use anchor_lang::prelude::*;

use super::{FeeGrowth, TokenAmount};

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    pub token_x: Pubkey,
    pub token_y: Pubkey,
    pub token_x_reserve: Pubkey,
    pub token_y_reserve: Pubkey,
    pub position_iterator: u64,
    pub tick_spacing: u16,
    pub fee: Decimal,
    pub liquidity: Decimal,
    pub sqrt_price: Decimal,
    pub current_tick_index: i32, // nearest tick below the current price
    pub tickmap: Pubkey,
    pub fee_growth_global_x: FeeGrowth,
    pub fee_growth_global_y: FeeGrowth,
    pub fee_protocol_token_x: u64, // should be changed to TokenAmount when Armani implements tuple structs
    pub fee_protocol_token_y: u64,
    pub seconds_per_liquidity_global: Decimal,
    pub start_timestamp: u64,
    pub last_timestamp: u64,
    pub oracle_address: Pubkey,
    pub oracle_initialized: bool,
    pub bump: u8,
}

impl Pool {
    pub fn add_fee(&mut self, amount: TokenAmount, x: bool) {
        if amount.is_zero() || self.liquidity.is_zero() {
            return;
        }
        let fee_growth = FeeGrowth::from_fee(self.liquidity, amount);

        if x {
            self.fee_growth_global_x = self.fee_growth_global_x + fee_growth;
        } else {
            self.fee_growth_global_y = self.fee_growth_global_y + fee_growth;
        }
    }

    pub fn update_liquidity_safely(&mut self, liquidity_delta: Decimal, add: bool) -> Result<()> {
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

    pub fn update_seconds_per_liquidity_global(&mut self, current_timestamp: u64) {
        self.seconds_per_liquidity_global = self.seconds_per_liquidity_global
            + (Decimal::from_integer((current_timestamp - self.last_timestamp) as u128)
                / self.liquidity);

        self.last_timestamp = current_timestamp;
    }

    pub fn set_oracle(&mut self, address: Pubkey) {
        self.oracle_address = address;
        self.oracle_initialized = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
