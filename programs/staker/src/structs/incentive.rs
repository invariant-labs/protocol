use crate::decimals::{Seconds, TokenAmount};
use anchor_lang::prelude::*;
use invariant::size;

#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct Incentive {
    pub founder: Pubkey,
    pub token_account: Pubkey,
    pub total_reward_unclaimed: TokenAmount,
    pub total_seconds_claimed: Seconds,
    pub start_time: Seconds,
    pub end_time: Seconds,
    pub end_claim_time: Seconds,
    pub num_of_stakes: u64,
    pub pool: Pubkey,
    pub nonce: u8,
}
size!(Incentive);
