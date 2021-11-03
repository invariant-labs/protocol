use crate::decimal::Decimal;
use anchor_lang::prelude::*;
#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    pub token_x: Pubkey,
    pub token_y: Pubkey,
    pub token_x_reserve: Pubkey,
    pub token_y_reserve: Pubkey,
    pub tick_spacing: u16,
    pub fee: Decimal,
    pub protocol_fee: Decimal,
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
#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Position {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub liquidity: Decimal,
    pub lower_tick_index: i32,
    pub upper_tick_index: i32,
    pub fee_growth_inside_x: Decimal,
    pub fee_growth_inside_y: Decimal,
    pub tokens_owed_x: Decimal,
    pub tokens_owed_y: Decimal,
    pub bump: u8,
}
#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct UserStake {
    pub position: Pubkey,
    pub seconds_per_liquidity_initial: Decimal,
    pub liquidity: Decimal,
    pub timestamp: u64,
    pub index: u32,
    pub bump: u8,
}
#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Incentive {
    pub token_account: Pubkey,
    pub total_reward_unclaimed: Decimal,
    pub total_seconds_claimed: Decimal,
    pub start_time: u64,
    pub end_time: u64,
    pub num_of_stakes: u64,
    pub pool: Pubkey,
}
