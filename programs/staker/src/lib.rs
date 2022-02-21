mod decimal;
mod errors;
mod instructions;
mod math;
mod structs;
mod uint;
mod util;

use anchor_lang::prelude::*;

use decimal::*;
use errors::*;
use instructions::*;

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

    pub fn stake(ctx: Context<CreateUserStake>, _index: i32) -> ProgramResult {
        instructions::stake::handler(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>, _index: i32, nonce: u8) -> ProgramResult {
        instructions::withdraw::handler(ctx, _index, nonce)
    }

    pub fn end_incentive(ctx: Context<ReturnFounds>, nonce: u8) -> ProgramResult {
        instructions::end_incentive::handler(ctx, nonce)
    }

    pub fn remove_stake(ctx: Context<RemoveStake>) -> ProgramResult {
        instructions::remove_stake::handler(ctx)
    }
}
