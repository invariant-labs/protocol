mod decimal;
mod instructions;
mod math;
mod structs;
mod uint;
mod util;

use anchor_lang::prelude::*;

use decimal::*;
use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod staker {

    use super::*;

    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
        bump: u8,
        reward: Decimal,
        start_time: u64,
        end_time: u64,
    ) -> ProgramResult {
        instructions::create_incentive::handler(ctx, bump, reward, start_time, end_time)
    }

    pub fn stake(ctx: Context<CreateUserStake>, index: i32, bump: u8) -> ProgramResult {
        instructions::stake::handler(ctx, index, bump)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        index: i32,
        bumpStake: u8,
        bumpAuthority: u8,
    ) -> ProgramResult {
        instructions::withdraw::handler(ctx, index, bumpStake, bumpAuthority)
    }

    pub fn end_incentive(ctx: Context<ReturnFounds>, bumpAuthority: u8) -> ProgramResult {
        instructions::end_incentive::handler(ctx, bumpAuthority)
    }
}

#[error]
pub enum ErrorCode {
    #[msg("The incentive didn't start yet!")]
    NotStarted = 0,
    #[msg("Disable empty position pokes")]
    EmptyPositionPokes = 1, // 136
    #[msg("Invalid tick liquidity")]
    InvalidPositionLiquidity = 2, // 135
    #[msg("Amount is zero")]
    ZeroAmount = 3,
    #[msg("Incentive duration is too long")]
    TooLongDuration = 4,
    #[msg("Start in past")]
    StartInPast = 5,
    #[msg("Incentive is over")]
    Ended = 6,
    #[msg("User have no liquidity")]
    ZeroLiquidity = 7,
    #[msg("Slots are not equal")]
    SlotsAreNotEqual = 8,
    #[msg("Zero seconds staked")]
    ZeroSecondsStaked = 9,
    #[msg("Seconds per liquidity is zero")]
    ZeroSecPerLiq = 10, //136
    #[msg("Incentive not ended")]
    NotEnded = 11,
    #[msg("Can't end id stake exists")]
    StakeExist = 12,
    #[msg("Remaining reward is 0")]
    ZeroReward = 13,
}
