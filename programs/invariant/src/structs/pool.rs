use crate::old_decimal::OldDecimal;
use crate::*;
use anchor_lang::prelude::*;

use super::{OldFeeGrowth, OldTokenAmount};

#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    pub token_x: Pubkey,
    pub token_y: Pubkey,
    pub token_x_reserve: Pubkey,
    pub token_y_reserve: Pubkey,
    pub position_iterator: u128,
    pub tick_spacing: u16,
    pub fee: OldDecimal,
    pub protocol_fee: OldDecimal,
    pub liquidity: OldDecimal,
    pub sqrt_price: OldDecimal,
    pub current_tick_index: i32, // nearest tick below the current price
    pub tickmap: Pubkey,
    pub fee_growth_global_x: OldFeeGrowth,
    pub fee_growth_global_y: OldFeeGrowth,
    pub fee_protocol_token_x: u64, // should be changed to TokenAmount when Armani implements tuple structs
    pub fee_protocol_token_y: u64,
    pub seconds_per_liquidity_global: OldDecimal,
    pub start_timestamp: u64,
    pub last_timestamp: u64,
    pub fee_receiver: Pubkey,
    pub oracle_address: Pubkey,
    pub oracle_initialized: bool,
    pub bump: u8,
}

impl Pool {
    pub fn add_fee(&mut self, amount: OldTokenAmount, in_x: bool) {
        let protocol_fee = amount.big_mul(self.protocol_fee).to_token_ceil();
        let pool_fee = amount - protocol_fee;

        if pool_fee.is_zero() || self.liquidity.is_zero() {
            return;
        }
        let fee_growth = OldFeeGrowth::from_fee(self.liquidity, pool_fee);

        if in_x {
            // trunk-ignore(clippy/unaligned_references)
            self.fee_growth_global_x += fee_growth;
            self.fee_protocol_token_x += protocol_fee.0;
        } else {
            // trunk-ignore(clippy/unaligned_references)
            self.fee_growth_global_y += fee_growth;
            self.fee_protocol_token_y += protocol_fee.0;
        }
    }

    pub fn update_liquidity_safely(
        &mut self,
        liquidity_delta: OldDecimal,
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

    pub fn update_seconds_per_liquidity_global(&mut self, current_timestamp: u64) {
        self.seconds_per_liquidity_global = self.seconds_per_liquidity_global
            + (OldDecimal::from_integer((current_timestamp - self.last_timestamp) as u128)
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
                liquidity: OldDecimal::new(0),
                ..Default::default()
            };
            let liquidity_delta = OldDecimal::one();
            let add = false;

            let result = pool.update_liquidity_safely(liquidity_delta, add);

            assert!(result.is_err());
        }
        // adding liquidity
        {
            let mut pool = Pool {
                liquidity: OldDecimal::one(),
                ..Default::default()
            };
            let liquidity_delta: OldDecimal = OldDecimal::from_integer(2);
            let add: bool = true;

            pool.update_liquidity_safely(liquidity_delta, add).unwrap();

            assert_eq!({ pool.liquidity }, OldDecimal::from_integer(3));
        }
        // subtracting liquidity
        {
            let mut pool = Pool {
                liquidity: OldDecimal::from_integer(3),
                ..Default::default()
            };
            let liquidity_delta: OldDecimal = OldDecimal::from_integer(2);
            let add: bool = false;

            pool.update_liquidity_safely(liquidity_delta, add).unwrap();

            assert_eq!({ pool.liquidity }, OldDecimal::one());
        }
    }
}
