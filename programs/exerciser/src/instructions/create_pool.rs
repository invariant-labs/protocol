use crate::structs::*;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(init,
        seeds = [b"exerciser", option_token_mint.to_account_info().key.as_ref(), payment_token_mint.to_account_info().key.as_ref()],
        bump, payer = founder
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut)]
    pub option_token_mint: Account<'info, Mint>,
    pub payment_token_mint: Account<'info, Mint>,
    pub invariant_mint: Account<'info, Mint>,
    #[account(init,
        token::mint = invariant_mint,
        token::authority = authority,
        payer = founder,
    )]
    pub invariant_vault: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = founder_invariant_account.mint == invariant_mint.key() ,
        constraint = &founder_invariant_account.owner == founder.to_account_info().key 
    )]
    pub founder_invariant_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(seeds = [b"exerciser".as_ref()], bump)]
    pub authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub trait DepositToken<'info> {
    fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}

impl<'info> DepositToken<'info> for CreatePool<'info> {
    fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.founder_invariant_account.to_account_info(),
                to: self.invariant_vault.to_account_info(),
                authority: self.founder.to_account_info().clone(),
            },
        )
    }
}
impl<'info> CreatePool<'info> {
    pub fn handler(&self, amount_in: u64, ratio: u64) -> ProgramResult {
        msg!("CREATE POOL");

        let pool = &mut self.pool.load_init()?;
        **pool = Pool {
            option_token_mint: *self.option_token_mint.to_account_info().key,
            payment_token_mint: *self.payment_token_mint.to_account_info().key,
            invariant_mint: *self.invariant_mint.to_account_info().key,
            invariant_vault: *self.invariant_vault.to_account_info().key,
            ratio,
        };


            //send invariant tokens to pool
            let cpi_ctx = self.deposit();

            token::transfer(cpi_ctx, amount_in)?; 

            Ok(())
    }
}
