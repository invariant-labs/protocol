use crate::decimal::Decimal;
use anchor_lang::prelude::*;
#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct UserStake {
    pub position: Pubkey,
    pub owner: Pubkey,
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
