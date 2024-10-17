use crate::interfaces::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::state::State;
use crate::ErrorCode::{self, *};
use crate::SEED;
use crate::*;
use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::TokenInterface;
use anchor_spl::token_interface::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct WithdrawProtocolFee<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount, mint::token_program = token_x_program)]
    pub token_x: InterfaceAccount<'info, Mint>,
    #[account(constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount, mint::token_program = token_y_program)]
    pub token_y: InterfaceAccount<'info, Mint>,
    #[account(mut,
        constraint = account_x.mint == token_x.key() @ InvalidMint,
        token::token_program = token_x_program,
    )]
    pub account_x: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = account_y.mint == token_y.key() @ InvalidMint,
        token::token_program = token_y_program,
    )]
    pub account_y: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_x.mint == token_x.key() @ InvalidMint,
        constraint = &reserve_x.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_x.key() == pool.load()?.token_x_reserve @ InvalidTokenAccount,
        token::token_program = token_x_program
    )]
    pub reserve_x: InterfaceAccount<'info, TokenAccount>,
    #[account(mut,
        constraint = reserve_y.mint == token_y.key() @ InvalidMint,
        constraint = &reserve_y.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_y.key() == pool.load()?.token_y_reserve @ InvalidTokenAccount,
        token::token_program = token_y_program,
    )]
    pub reserve_y: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = &pool.load()?.fee_receiver == authority.key @ InvalidAuthority)]
    pub authority: Signer<'info>,
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    /// CHECK: Ignore
    pub program_authority: AccountInfo<'info>,

    #[account(constraint = token_x_program.key() == token::ID || token_x_program.key() == token_2022::ID)]
    pub token_x_program: Interface<'info, TokenInterface>,
    #[account(constraint = token_y_program.key() == token::ID || token_y_program.key() == token_2022::ID)]
    pub token_y_program: Interface<'info, TokenInterface>,
}

impl<'info> SendTokens<'info> for WithdrawProtocolFee<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        CpiContext::new(
            self.token_x_program.to_account_info(),
            token::Transfer {
                from: self.reserve_x.to_account_info(),
                to: self.account_x.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }

    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        CpiContext::new(
            self.token_y_program.to_account_info(),
            token::Transfer {
                from: self.reserve_y.to_account_info(),
                to: self.account_y.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }

    fn send_x_2022(&self) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>> {
        CpiContext::new(
            self.token_x_program.to_account_info(),
            token_2022::TransferChecked {
                mint: self.token_x.to_account_info(),
                from: self.reserve_x.to_account_info(),
                to: self.account_x.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }

    fn send_y_2022(&self) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>> {
        CpiContext::new(
            self.token_y_program.to_account_info(),
            token_2022::TransferChecked {
                mint: self.token_y.to_account_info(),
                from: self.reserve_y.to_account_info(),
                to: self.account_y.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }
}

impl<'info> WithdrawProtocolFee<'info> {
    pub fn handler(&self) -> Result<()> {
        msg!("INVARIANT: WITHDRAW PROTOCOL FEE");

        let state = self.state.load()?;
        let mut pool = self.pool.load_mut()?;

        let signer: &[&[&[u8]]] = get_signer!(state.nonce);

        match self.token_x_program.key() {
            token_2022::ID => token_2022::transfer_checked(
                self.send_x_2022().with_signer(signer),
                pool.fee_protocol_token_x,
                self.token_x.decimals,
            )?,
            token::ID => {
                token::transfer(self.send_x().with_signer(signer), pool.fee_protocol_token_x)?
            }
            _ => return Err(ErrorCode::InvalidTokenProgram.into()),
        };

        match self.token_y_program.key() {
            token_2022::ID => token_2022::transfer_checked(
                self.send_y_2022().with_signer(signer),
                pool.fee_protocol_token_y,
                self.token_y.decimals,
            )?,
            token::ID => {
                token::transfer(self.send_y().with_signer(signer), pool.fee_protocol_token_y)?
            }
            _ => return Err(ErrorCode::InvalidTokenProgram.into()),
        };

        pool.fee_protocol_token_x = 0;
        pool.fee_protocol_token_y = 0;

        Ok(())
    }
}
