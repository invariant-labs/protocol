use std::convert::TryInto;

use crate::structs::*;
use crate::util;
use crate::util::get_current_timestamp;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{self, TokenAccount, Transfer};
use util::STAKER_SEED;

#[derive(Accounts)]
pub struct ReturnFounds<'info> {
    #[account(constraint = &incentive.load()?.founder == owner.to_account_info().key )]
    pub incentive: AccountLoader<'info, Incentive>,
    //TODO: Add token account and validate mints
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key,
        constraint = &incentive.load()?.token_account == incentive_token_account.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub founder_token_account: Account<'info, TokenAccount>,
    //TODO: validate staker_authority
    pub staker_authority: AccountInfo<'info>,
    pub owner: Signer<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> ReturnFounds<'info> {
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

pub fn handler(ctx: Context<ReturnFounds>, bump_authority: u8) -> ProgramResult {
    let incentive = ctx.accounts.incentive.load()?;
    let current_time = get_current_timestamp();
    require!(current_time > incentive.end_time, NotEnded);
    require!(incentive.num_of_stakes == 0, StakeExist);
    require!(incentive.total_reward_unclaimed.v > 0, ZeroReward);

    // TODO: would be nice to have this bump saved somewhere
    let seeds = &[STAKER_SEED.as_bytes(), &[bump_authority]];
    let signer = &[&seeds[..]];
    let cpi_ctx = ctx.accounts.return_to_founder().with_signer(signer);

    token::transfer(cpi_ctx, incentive.total_reward_unclaimed.to_u64())?;

    Ok(())
}
