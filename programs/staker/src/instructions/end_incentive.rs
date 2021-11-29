use crate::state::*;
use crate::util;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};
use anchor_lang::solana_program::system_program;
use util::STAKER_SEED;

#[derive(Accounts)]
#[instruction( bump_authority: u8, )]
pub struct ReturnFounds<'info> {
    #[account(mut,
        constraint = &incentive.load()?.founder == owner.to_account_info().key 
    )]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key,
        constraint = &incentive.load()?.token_account == incentive_token_account.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub founder_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        seeds = [b"staker".as_ref()],
        bump = bump_authority)]
    pub staker_authority: AccountInfo<'info>,
    pub owner: Signer<'info>,
    pub token_program: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub trait ReturnToFounder<'info> {
    fn return_to_founder(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}

impl<'info> ReturnToFounder<'info> for ReturnFounds<'info> {
    fn return_to_founder(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.incentive_token_account.to_account_info(),
                to: self.founder_token_account.to_account_info(),
                authority: self.staker_authority.to_account_info().clone(),
            },
        )
    }
}


pub fn handler(ctx: Context<ReturnFounds>, bumpAuthority: u8) -> ProgramResult {
    let incentive = ctx.accounts.incentive.load_mut()?;
    let current_time = Clock::get().unwrap().unix_timestamp as u64;
    require!(current_time > incentive.end_time, NotEnded);
    require!(incentive.num_of_stakes == 0, StakeExist);
    require!(incentive.total_reward_unclaimed.v > 0, ZeroReward);

    let seeds = &[STAKER_SEED.as_bytes(), &[bumpAuthority]];
    let signer = &[&seeds[..]];
    let cpi_ctx = ctx.accounts.return_to_founder().with_signer(signer);

    token::transfer(cpi_ctx, incentive.total_reward_unclaimed.to_u64())?;

    Ok(())
}