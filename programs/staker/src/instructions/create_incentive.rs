use crate::decimal::*;
use crate::structs::*;
use crate::util::get_current_timestamp;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{self, TokenAccount, Transfer};
use invariant::program::Invariant;
use invariant::structs::Pool;

const MAX_TIME_BEFORE_START: u64 = 3_600; //hour in sec
const MAX_DURATION: u64 = 31_556_926; //year in sec
const WEEK: u64 = 604_800; //week in sec

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreateIncentive<'info> {
    #[account(init, payer = founder)]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key @InvalidOwner
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = founder_token_account.to_account_info().key != incentive_token_account.to_account_info().key @ InvalidTokenAccount,
        constraint = &founder_token_account.owner == founder.to_account_info().key @InvalidListOwner
    )]
    pub founder_token_account: Account<'info, TokenAccount>,
    //TODO: Add token account and validate mints
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut)]
    pub founder: Signer<'info>,
    //TODO: save staker_authority in state
    pub staker_authority: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
    pub invariant: Program<'info, Invariant>, //TODO: Add program validation
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
    nonce: u8,
    reward: Decimal,
    start_time: u64,
    end_time: u64,
) -> ProgramResult {
    msg!("CREATE INCENTIVE");
    require!(reward != Decimal::new(0), ZeroAmount);
    let current_time = get_current_timestamp();

    require!(
        (start_time + MAX_TIME_BEFORE_START) >= current_time,
        StartInPast
    );
    require!((current_time + MAX_DURATION) >= end_time, TooLongDuration);
    let incentive = &mut ctx.accounts.incentive.load_init()?;

    **incentive = Incentive {
        founder: *ctx.accounts.founder.to_account_info().key,
        pool: *ctx.accounts.pool.to_account_info().key,
        token_account: *ctx.accounts.incentive_token_account.to_account_info().key,
        total_reward_unclaimed: reward,
        total_seconds_claimed: Decimal::from_integer(0),
        num_of_stakes: 0,
        start_time,
        end_time,
        end_claim_time: end_time + WEEK,
        nonce,
    };

    //send tokens to incentive
    let cpi_ctx = ctx.accounts.deposit();

    token::transfer(cpi_ctx, reward.to_u64())?;

    Ok(())
}
