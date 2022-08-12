use crate::decimals::*;
use crate::structs::*;
use crate::util;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Transfer};
use util::STAKER_SEED;

#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct ReturnFounds<'info> {
    #[account(mut,
        close = founder,
        constraint = incentive.load()?.founder == founder.key() @ InvalidFounder
    )]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = incentive_token_account.owner == staker_authority.key() @ InvalidTokenAccount,
        constraint = incentive.load()?.token_account == incentive_token_account.key() @ InvalidTokenAccount,
        constraint = incentive_token_account.mint == incentive_token.key() @ InvalidMint
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub founder_token_account: Account<'info, TokenAccount>,
    pub incentive_token: Account<'info, Mint>,
    #[account(seeds = [b"staker".as_ref()], bump = nonce)]
    pub staker_authority: AccountInfo<'info>,
    pub founder: Signer<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
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

pub fn handler(ctx: Context<ReturnFounds>, nonce: u8) -> ProgramResult {
    {
        let incentive = ctx.accounts.incentive.load()?;
        require!(Seconds::now() > { incentive.end_time }, TooEarly);
        require!(incentive.num_of_stakes == 0, StakeExist);
        let remaining_reward = incentive.total_reward_unclaimed;

        let seeds = &[STAKER_SEED.as_bytes(), &[nonce]];
        let signer = &[&seeds[..]];
        let cpi_ctx = ctx.accounts.return_to_founder().with_signer(signer);

        token::transfer(cpi_ctx, remaining_reward.get())?;
    }

    Ok(())
}
