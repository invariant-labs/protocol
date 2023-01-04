mod decimals;
mod errors;
mod instructions;
mod math;
mod structs;
mod uint;
mod util;

use anchor_lang::prelude::*;

use decimals::*;
use instructions::*;

declare_id!("MJ6WF1tpEJ7Gk8ULqejDJapRfqBwBEp1dH5QvAgYxu9");

#[program]
pub mod staker {

    use super::*;

    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
        nonce: u8,
        reward: TokenAmount,
        start_time: Seconds,
        end_time: Seconds,
    ) -> Result<()> {
        instructions::create_incentive::handler(ctx, nonce, reward, start_time, end_time)
    }

    pub fn stake(ctx: Context<CreateUserStake>, _index: i32) -> Result<()> {
        instructions::stake::handler(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>, _index: i32, nonce: u8) -> Result<()> {
        instructions::withdraw::handler(ctx, _index, nonce)
    }

    pub fn end_incentive(ctx: Context<ReturnFounds>, nonce: u8) -> Result<()> {
        instructions::end_incentive::handler(ctx, nonce)
    }

    pub fn remove_stake(ctx: Context<RemoveStake>) -> Result<()> {
        instructions::remove_stake::handler(ctx)
    }

    pub fn close_stake_by_owner(ctx: Context<CloseStakeByOwner>, _index: i32) -> Result<()> {
        instructions::close_stake_by_owner::handler(ctx, _index)
    }
}
