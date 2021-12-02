use crate::decimal::*;
use crate::structs::*;
use amm::program::Amm;
use amm::structs::Pool;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{self, TokenAccount, Transfer};

const MAX_TIME_BEFORE_START: u64 = 3_600; //hour in sec
const MAX_DURATION: u64 = 31_556_926; //year in sec

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreateIncentive<'info> {
    #[account(init, payer = founder)]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = founder_token_account.to_account_info().key != incentive_token_account.to_account_info().key,
        constraint = &founder_token_account.owner == founder.to_account_info().key
    )]
    pub founder_token_account: Account<'info, TokenAccount>,
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(mut,
        seeds = [b"staker".as_ref()],
        bump = bump)]
    pub staker_authority: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
    pub amm: Program<'info, Amm>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub trait DepositToken<'info> {
    fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}

impl<'info> DepositToken<'info> for CreateIncentive<'info> {
    fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.founder_token_account.to_account_info(),
                to: self.incentive_token_account.to_account_info(),
                authority: self.founder.to_account_info().clone(),
            },
        )
    }
}

pub fn handler(
    ctx: Context<CreateIncentive>,
    _bump: u8,
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
        incentive.founder = *ctx.accounts.founder.to_account_info().key;
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
