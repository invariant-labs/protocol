use crate::decimals::*;
use crate::interfaces::send_tokens::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::tick::Tick;
use crate::util::*;
use crate::ErrorCode::{self, *};
use crate::*;

use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
#[instruction( index: u32, lower_tick_index: i32, upper_tick_index: i32)]
pub struct ClaimFee<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.key().as_ref(),
        &index.to_le_bytes()],
        bump = position.load()?.bump
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"tickv1", pool.key().as_ref(), &lower_tick_index.to_le_bytes()],
        bump = lower_tick.load()?.bump,
        constraint = lower_tick_index == position.load()?.lower_tick_index @ WrongTick
    )]
    pub lower_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        seeds = [b"tickv1", pool.key().as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump,
        constraint = upper_tick_index == position.load()?.upper_tick_index @ WrongTick
    )]
    pub upper_tick: AccountLoader<'info, Tick>,
    pub owner: Signer<'info>,
    #[account(constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount, mint::token_program = token_x_program)]
    pub token_x: InterfaceAccount<'info, Mint>,
    #[account(constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount, mint::token_program = token_y_program)]
    pub token_y: InterfaceAccount<'info, Mint>,
    #[account(mut,
        constraint = account_x.mint == token_x.key() @ InvalidMint,
        constraint = &account_x.owner == owner.key @ InvalidOwner,
        token::token_program = token_x_program
    )]
    pub account_x: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = account_y.mint == token_y.key() @ InvalidMint,
        constraint = &account_y.owner == owner.key @ InvalidOwner,
        token::token_program = token_y_program
    )]
    pub account_y: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_x.mint == token_x.key() @ InvalidMint,
        constraint = &reserve_x.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_x.key() == pool.load()?.token_x_reserve @ InvalidTokenAccount,
        token::token_program = token_x_program,
    )]
    pub reserve_x: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_y.mint == token_y.key() @ InvalidMint,
        constraint = &reserve_y.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_y.key() == pool.load()?.token_y_reserve @ InvalidTokenAccount,
        token::token_program = token_y_program,
    )]
    pub reserve_y: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    /// CHECK: ignore
    pub program_authority: AccountInfo<'info>,

    #[account(constraint = token_x_program.key() == token::ID || token_x_program.key() == token_2022::ID)]
    pub token_x_program: Interface<'info, TokenInterface>,
    #[account(constraint = token_y_program.key() == token::ID || token_y_program.key() == token_2022::ID)]
    pub token_y_program: Interface<'info, TokenInterface>,
}

impl<'info> interfaces::send_tokens::SendTokens<'info> for ClaimFee<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_x_program.to_account_info(),
            Transfer {
                from: self.reserve_x.to_account_info(),
                to: self.account_x.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }

    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_y_program.to_account_info(),
            Transfer {
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

impl<'info> ClaimFee<'info> {
    pub fn handler(&self) -> Result<()> {
        msg!("INVARIANT: CLAIM FEE");

        let state = self.state.load()?;
        let pool = &mut self.pool.load_mut()?;
        let position = &mut self.position.load_mut()?;
        let lower_tick = &mut self.lower_tick.load_mut()?;
        let upper_tick = &mut self.upper_tick.load_mut()?;
        let current_timestamp = get_current_timestamp();

        check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;

        position
            .modify(
                pool,
                upper_tick,
                lower_tick,
                Liquidity::new(0),
                true,
                current_timestamp,
            )
            .unwrap();

        let fee_to_collect_x = TokenAmount::from_decimal(position.tokens_owed_x);
        let fee_to_collect_y = TokenAmount::from_decimal(position.tokens_owed_y);
        position.tokens_owed_x =
            position.tokens_owed_x - FixedPoint::from_decimal(fee_to_collect_x);
        position.tokens_owed_y =
            position.tokens_owed_y - FixedPoint::from_decimal(fee_to_collect_y);

        let signer: &[&[&[u8]]] = get_signer!(state.nonce);

        match self.token_x_program.key() {
            token_2022::ID => token_2022::transfer_checked(
                self.send_x_2022().with_signer(signer),
                fee_to_collect_x.0,
                self.token_x.decimals,
            )?,
            token::ID => token::transfer(self.send_x().with_signer(signer), fee_to_collect_x.0)?,
            _ => return Err(ErrorCode::InvalidTokenProgram.into()),
        };

        match self.token_y_program.key() {
            token_2022::ID => token_2022::transfer_checked(
                self.send_y_2022().with_signer(signer),
                fee_to_collect_y.0,
                self.token_y.decimals,
            )?,
            token::ID => token::transfer(self.send_y().with_signer(signer), fee_to_collect_y.0)?,
            _ => return Err(ErrorCode::InvalidTokenProgram.into()),
        };

        Ok(())
    }
}
