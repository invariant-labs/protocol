use crate::decimal::Decimal;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct State {
    pub protocol_fee: Decimal,
    pub admin: Pubkey,
    pub bump: u8,
}

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct FeeTier {
    pub fee: Decimal,
    pub tick_spacing: u16,
    pub bump: u8,
}

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
    pub fee_growth_global_x: Decimal,
    pub fee_growth_global_y: Decimal,
    pub fee_protocol_token_x: Decimal,
    pub fee_protocol_token_y: Decimal,
    pub bump: u8,
    pub nonce: u8,
    pub authority: Pubkey,
}

impl Pool {
    pub fn add_fee(&mut self, amount: Decimal, x: bool) {
        if amount == Decimal::new(0) || { self.liquidity } == Decimal::new(0) {
            return;
        }
        if x {
            self.fee_growth_global_x = self.fee_growth_global_x + (amount / self.liquidity);
        } else {
            self.fee_growth_global_y = self.fee_growth_global_y + (amount / self.liquidity);
        }
    }
}

#[account(zero_copy)]
pub struct Tickmap {
    pub bitmap: [u8; 25000], // Tick limit / 4
}

impl Default for Tickmap {
    fn default() -> Self {
        Tickmap { bitmap: [0; 25000] }
    }
}

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
    pub bump: u8,
}

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct PositionList {
    pub head: u32,
    pub bump: u8,
}

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Position {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub id: u64, // unique inside pool
    pub liquidity: Decimal,
    pub lower_tick_index: i32,
    pub upper_tick_index: i32,
    pub fee_growth_inside_x: Decimal,
    pub fee_growth_inside_y: Decimal,
    pub tokens_owed_x: Decimal,
    pub tokens_owed_y: Decimal,
    pub bump: u8,
}
