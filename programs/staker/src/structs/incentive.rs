use crate::decimal::Decimal;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Incentive {
    pub founder: Pubkey,
    pub token_account: Pubkey,
    pub total_reward_unclaimed: Decimal,
    pub total_seconds_claimed: Decimal,
    pub start_time: u64,
    pub end_time: u64,
    pub num_of_stakes: u64,
    pub pool: Pubkey,
    pub nonce: u8,
}
