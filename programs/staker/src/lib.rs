mod account;
mod context;
mod decimal;
mod math;
mod uint;
use anchor_lang::prelude::*;
use anchor_spl::token;
use context::*;
use decimal::*;
use math::*;

const STAKER_SEED: &str = "staker";
const MAX_TIME_BEFORE_START: u64 = 3_600; //hour in sec
const MAX_DURATION: u64 = 31_556_926; //year in sec

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod staker {

    use crate::decimal::Decimal;

    use super::*;

    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
        reward: Decimal,
        start_time: u64,
        end_time: u64,
    ) -> ProgramResult {
        require!(reward != Decimal::new(0), ZeroAmount);
        let current_time: u64 = Clock::get().unwrap().unix_timestamp as u64; //not sure if that is safe

        require!(
            (start_time + MAX_TIME_BEFORE_START) >= current_time,
            StartInPast
        );
        require!((current_time + MAX_DURATION) >= end_time, TooLongDuration);
        let incentive = &mut ctx.accounts.incentive.load_init()?;
        {
            //incentive.pool = *ctx.accounts.pool.to_account_info().key; // TODO
            incentive.token_account = *ctx.accounts.incentive_token_account.to_account_info().key;
            incentive.total_reward_unclaimed = reward;
            incentive.total_seconds_claimed = Decimal::from_integer(0);
            incentive.start_time = start_time;
            incentive.end_time = end_time;
        }

        //send tokens to incentive
        let cpi_ctx = ctx.accounts.deposit();

        token::transfer(cpi_ctx, reward.to_u64())?;

        Ok(())
    }

    pub fn stake(ctx: Context<CreateUserStake>, bump: u8, index: u32) -> ProgramResult {
        let mut incentive = ctx.accounts.incentive.load_mut()?;
        let current_time = Clock::get().unwrap().unix_timestamp as u64;
        require!(current_time <= incentive.start_time, NotStarted);
        require!(current_time < incentive.end_time, Ended);

        let user_stake = &mut ctx.accounts.user_stake.load_init()?;

        //let position = ctx.accounts.position.load()?;
        {
            user_stake.position = *ctx.accounts.position.to_account_info().key;
            user_stake.timestamp = Clock::get().unwrap().unix_timestamp as u64;
            user_stake.liquidity = Decimal::from_integer(100); //position.liquidity; // TODO load from position
            user_stake.seconds_per_liquidity_initial = Decimal::from_integer(0); //TODO add fun to callculate it from tick map
            user_stake.index = index;
            user_stake.bump = bump;
            incentive.num_of_stakes += 1;
        }
        let liquidity = user_stake.liquidity;
        require!(liquidity > Decimal::from_integer(0), ZeroLiquidity);
        Ok(())
    }

    // DRAFT
    pub fn withdraw(ctx: Context<Withdraw>, nonce: u8) -> ProgramResult {
        let user_stake = &mut ctx.accounts.user_stake.load_mut()?;
        let mut incentive = ctx.accounts.incentive.load_mut()?;
        let current_time = Clock::get().unwrap().unix_timestamp as u64;
        let seconds_per_liquidity_inside: Decimal = Decimal::from_integer(0); // TODO add fun to callculate it from tick map
        let reward = incentive.total_reward_unclaimed;

        require!(reward != Decimal::from_integer(0), ZeroAmount);

        let (seconds_inside, reward) = calculate_reward(
            incentive.total_reward_unclaimed,
            incentive.total_seconds_claimed,
            incentive.start_time,
            incentive.end_time,
            user_stake.liquidity,
            user_stake.seconds_per_liquidity_initial,
            seconds_per_liquidity_inside,
            current_time,
        )
        .unwrap();

        incentive.num_of_stakes -= 1;
        incentive.total_seconds_claimed = incentive.total_seconds_claimed.add(seconds_inside);
        incentive.total_reward_unclaimed = incentive
            .total_reward_unclaimed
            .sub(Decimal::from_integer(reward as u128));

        user_stake.seconds_per_liquidity_initial = Decimal::from_integer(0);
        user_stake.liquidity = Decimal::from_integer(0);
        user_stake.timestamp = 0; // TODO timestamp 0 is a good idea ?

        let seeds = &[STAKER_SEED.as_bytes(), &[nonce]];
        let signer = &[&seeds[..]];

        let cpi_ctx = ctx.accounts.withdraw().with_signer(signer);

        token::transfer(cpi_ctx, reward)?;

        Ok(())
    }

    //TODO add end incentive
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
}
