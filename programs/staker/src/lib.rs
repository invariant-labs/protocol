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

    use super::*;

    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
        bump: u8,
        reward: Decimal,
        start_time: u64,
        end_time: u64,
    ) -> ProgramResult {
        msg!("CREATE INCENTIVE");
        require!(reward != Decimal::new(0), ZeroAmount);
        let current_time: u64 = Clock::get().unwrap().unix_timestamp as u64; //not sure if that is safe

        require!(
            (start_time + MAX_TIME_BEFORE_START) >= current_time,
            StartInPast
        );
        require!((current_time + MAX_DURATION) >= end_time, TooLongDuration);
        let incentive = &mut ctx.accounts.incentive.load_init()?;

        {
            incentive.pool = *ctx.accounts.pool.to_account_info().key;
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

    pub fn stake(ctx: Context<CreateUserStake>, index: i32, bump: u8) -> ProgramResult {
        msg!("STAKE");
        let mut incentive = ctx.accounts.incentive.load_mut()?;
        let current_time = Clock::get().unwrap().unix_timestamp as u64;
        require!(current_time >= incentive.start_time, NotStarted);
        require!(current_time < incentive.end_time, Ended);

        let user_stake = &mut ctx.accounts.user_stake.load_init()?;
        let position = ctx.accounts.position.load()?;
        let update_slot = position.last_slot as i64;
        let slot = Clock::get()?.slot as i64;
        let diff_slot = slot - update_slot;
        require!(diff_slot <= 1, SlotsAreNotEqual);

        {
            user_stake.position = *ctx.accounts.position.to_account_info().key;
            user_stake.owner = *ctx.accounts.owner.to_account_info().key;
            user_stake.liquidity = Decimal::new(position.liquidity.v);
            user_stake.incentive = *ctx.accounts.incentive.to_account_info().key;
            user_stake.seconds_per_liquidity_initial =
                Decimal::new(position.seconds_per_liquidity_inside.v);
            incentive.num_of_stakes += 1;
        }
        let liquidity = user_stake.liquidity;
        require!(liquidity > Decimal::from_integer(0), ZeroLiquidity);
        Ok(())
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        index: i32,
        bumpStake: u8,
        bumpAuthority: u8,
        nonce: u8,
    ) -> ProgramResult {
        msg!("WITHDRAW");
        let constraint = &Pubkey::find_program_address(
            &[
                b"positionv1",
                ctx.accounts.position.to_account_info().key.as_ref(),
                &index.to_le_bytes(),
            ],
            &amm::program::Amm::id(),
        )
        .0;
        msg!("constraint {}", constraint);
        let user_stake = &mut ctx.accounts.user_stake.load_mut()?;
        let position = ctx.accounts.position.load()?;
        let mut incentive = ctx.accounts.incentive.load_mut()?;
        let current_time = Clock::get().unwrap().unix_timestamp as u64;
        let update_slot = position.last_slot as i64;
        let slot = Clock::get()?.slot as i64;
        let diff_slot = slot - update_slot;
        require!(diff_slot <= 1, SlotsAreNotEqual);
        require!(user_stake.liquidity.v != 0, ZeroSecondsStaked);
        require!(
            user_stake.seconds_per_liquidity_initial.v != 0,
            ZeroSecPerLiq
        );
        let seconds_per_liquidity_inside: Decimal =
            Decimal::new(position.seconds_per_liquidity_inside.v);

        let reward_unclaimed = incentive.total_reward_unclaimed;

        require!(reward_unclaimed != Decimal::from_integer(0), ZeroAmount);

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

        incentive.num_of_stakes -= 1; //TODO end incentive if 0 and is after end
        incentive.total_seconds_claimed = incentive.total_seconds_claimed.add(seconds_inside);
        incentive.total_reward_unclaimed = incentive
            .total_reward_unclaimed
            .sub(Decimal::new(reward as u128));
        user_stake.seconds_per_liquidity_initial = Decimal::from_integer(0);
        user_stake.liquidity = Decimal::from_integer(0);

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
    #[msg("Slots are not equal")]
    SlotsAreNotEqual = 8,
    #[msg("Zero seconds staked")]
    ZeroSecondsStaked = 9,
    #[msg("Seconds per liquidity is zero")]
    ZeroSecPerLiq = 10,
}
