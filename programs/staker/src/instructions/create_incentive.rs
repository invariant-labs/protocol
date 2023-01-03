use crate::decimals::*;
use crate::errors::ErrorCode;
use crate::structs::*;
use crate::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, TokenAccount, Transfer};
use invariant::program::Invariant;
use invariant::structs::Pool;

const MAX_TIME_BEFORE_START: u64 = 3_600; //hour in sec
const MAX_DURATION: u64 = 31_556_926; //year in sec
const WEEK: u64 = 604_800; //week in sec

#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct CreateIncentive<'info> {
    #[account(init, space = Incentive::LEN, payer = founder)]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(init,
        token::mint = incentive_token,
        token::authority = staker_authority,
        payer = founder,
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = founder_token_account.key() != incentive_token_account.key() @ ErrorCode::InvalidTokenAccount,
        constraint = founder_token_account.mint == incentive_token.key() @ ErrorCode::InvalidMint,
        constraint = founder_token_account.owner == founder.key() @ ErrorCode::InvalidOwner
    )]
    pub founder_token_account: Account<'info, TokenAccount>,
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut)]
    pub founder: Signer<'info>,
    /// CHECK: safe as invoked by incentive owner
    #[account(seeds = [b"staker".as_ref()], bump = nonce)]
    pub staker_authority: AccountInfo<'info>,
    pub incentive_token: Account<'info, Mint>,
    /// CHECK: safe as constant
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
    #[account(address = invariant::ID)]
    pub invariant: Program<'info, Invariant>,
    /// CHECK: safe as constant
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
    reward: TokenAmount,
    start_time: Seconds,
    end_time: Seconds,
) -> Result<()> {
    msg!("CREATE INCENTIVE");
    require!(
        (reward) != TokenAmount::new(0),
        errors::ErrorCode::ZeroAmount
    );

    require!(
        (start_time + Seconds::new(MAX_TIME_BEFORE_START)) >= Seconds::now(),
        errors::ErrorCode::StartInPast
    );
    require!(
        (Seconds::now() + Seconds::new(MAX_DURATION)) >= end_time,
        errors::ErrorCode::TooLongDuration
    );
    let incentive = &mut ctx.accounts.incentive.load_init()?;

    **incentive = Incentive {
        founder: ctx.accounts.founder.key(),
        pool: ctx.accounts.pool.key(),
        token_account: ctx.accounts.incentive_token_account.key(),
        total_reward_unclaimed: reward,
        total_seconds_claimed: Seconds::new(0),
        num_of_stakes: 0,
        start_time,
        end_time,
        end_claim_time: end_time + Seconds::new(WEEK),
        nonce,
    };

    //send tokens to incentive
    let cpi_ctx = ctx.accounts.deposit();

    token::transfer(cpi_ctx, reward.get())?;

    Ok(())
}
