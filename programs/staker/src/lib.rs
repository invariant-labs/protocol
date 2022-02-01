mod decimal;
mod instructions;
mod math;
mod structs;
mod uint;
mod util;
mod errors;

use anchor_lang::prelude::*;

use decimal::*;
use instructions::*;
use errors::*;

declare_id!("G5iMvLKhBKKscSMUazjiWKZXzacjL7oikJAm9FWRTvk");

#[program]
pub mod staker {

    use super::*;

    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
        nonce: u8,
        reward: Decimal,
        start_time: u64,
        end_time: u64,
    ) -> ProgramResult {
        instructions::create_incentive::handler(ctx, nonce, reward, start_time, end_time)
    }

    pub fn stake(ctx: Context<CreateUserStake>, _index: i32, bump: u8) -> ProgramResult {
        instructions::stake::handler(ctx, bump)
    }

    pub fn withdraw(ctx: Context<Withdraw>, _index: i32, nonce: u8) -> ProgramResult {
        instructions::withdraw::handler(ctx, nonce)
    }

    pub fn end_incentive(ctx: Context<ReturnFounds>, _bump_authority: u8) -> ProgramResult {
        instructions::end_incentive::handler(ctx, _bump_authority)
    }

    pub fn close_stake_account(ctx: Context<CloseAccount>) -> ProgramResult {
        instructions::close_stake_account::handler(ctx)
    }
}
