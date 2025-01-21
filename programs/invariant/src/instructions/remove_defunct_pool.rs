use crate::get_signer;
use crate::interfaces;
use crate::interfaces::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::tickmap::Tickmap;
use crate::structs::State;
use crate::ErrorCode::*;
use crate::SEED;
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::CloseAccount;
use anchor_spl::token::Token;
use anchor_spl::token::Transfer;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct RemoveDefunctPool<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        close = admin,
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        close = admin,
        address = pool.load()?.tickmap @ InvalidTickmap
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    pub token_x: Account<'info, Mint>,
    pub token_y: Account<'info, Mint>,
    #[account(mut,
        constraint = account_x.mint == token_x.key() @ InvalidMint,
        constraint = &account_x.owner == admin.key @ InvalidOwner,
    )]
    pub account_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = account_y.mint == token_y.key() @ InvalidMint,
        constraint = &account_y.owner == admin.key @ InvalidOwner
    )]
    pub account_y: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_x.mint == token_x.key() @ InvalidMint,
        constraint = &reserve_x.owner == program_authority.key @ InvalidOwner,
        address = pool.load()?.token_x_reserve @ InvalidTokenAccount
    )]
    pub reserve_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_y.mint == token_y.key() @ InvalidMint,
        constraint = &reserve_y.owner == program_authority.key @ InvalidOwner,
        address = pool.load()?.token_y_reserve @ InvalidTokenAccount
    )]
    pub reserve_y: Box<Account<'info, TokenAccount>>,
    #[account(address = state.load()?.admin @ InvalidAdmin)]
    pub admin: Signer<'info>,
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    pub program_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> interfaces::send_tokens::SendTokens<'info> for RemoveDefunctPool<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_x.to_account_info(),
                to: self.account_x.to_account_info(),
                authority: self.program_authority.to_account_info(),
            },
        )
    }

    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_y.to_account_info(),
                to: self.account_y.to_account_info(),
                authority: self.program_authority.to_account_info(),
            },
        )
    }
}

impl<'info> RemoveDefunctPool<'info> {
    fn close_reserve_x(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        return CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.reserve_x.to_account_info(),
                destination: self.admin.to_account_info(),
                authority: self.program_authority.to_account_info(),
            },
        );
    }

    fn close_reserve_y(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        return CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.reserve_y.to_account_info(),
                destination: self.admin.to_account_info(),
                authority: self.program_authority.to_account_info(),
            },
        );
    }

    fn validate_tickmap(&self) -> ProgramResult {
        let tickmap = self.tickmap.load()?;
        for tick in tickmap.bitmap.iter() {
            if *tick != 0 {
                return Err(InvalidTickmap.into());
            }
        }
        Ok(())
    }

    pub fn handler(&self) -> ProgramResult {
        msg!("INVARIANT: REMOVE DEFUNCT POOL");

        // contraint: all ticks are empty
        self.validate_tickmap()?;

        let signer: &[&[&[u8]]] = get_signer!(self.state.load()?.nonce);

        let amount_x = self.reserve_x.amount;
        let amount_y = self.reserve_y.amount;

        token::transfer(self.send_x().with_signer(signer), amount_x)?;
        token::transfer(self.send_y().with_signer(signer), amount_y)?;
        token::close_account(self.close_reserve_x().with_signer(signer))?;
        token::close_account(self.close_reserve_y().with_signer(signer))?;

        Ok(())
    }
}
