use crate::decimals::*;
use crate::interfaces::send_tokens::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::tick::Tick;
use crate::util::*;
use crate::ErrorCode::*;
use crate::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Transfer};

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
        bump = lower_tick.load()?.bump
    )]
    pub lower_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        seeds = [b"tickv1", pool.key().as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump
    )]
    pub upper_tick: AccountLoader<'info, Tick>,
    pub owner: Signer<'info>,
    #[account(constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount)]
    pub token_y: Account<'info, Mint>,
    #[account(mut,
        constraint = account_x.mint == token_x.key() @ InvalidMint,
        constraint = &account_x.owner == owner.key @ InvalidOwner,
    )]
    pub account_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = account_y.mint == token_y.key() @ InvalidMint,
        constraint = &account_y.owner == owner.key @ InvalidOwner
    )]
    pub account_y: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_x.mint == token_x.key() @ InvalidMint,
        constraint = &reserve_x.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_x.key() == pool.load()?.token_x_reserve @ InvalidTokenAccount
    )]
    pub reserve_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_y.mint == token_y.key() @ InvalidMint,
        constraint = &reserve_y.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_y.key() == pool.load()?.token_y_reserve @ InvalidTokenAccount
    )]
    pub reserve_y: Box<Account<'info, TokenAccount>>,
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    pub program_authority: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> interfaces::SendTokens<'info> for ClaimFee<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_x.to_account_info(),
                to: self.account_x.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }

    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_y.to_account_info(),
                to: self.account_y.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }
}

impl<'info> ClaimFee<'info> {
    pub fn handler(&self) -> ProgramResult {
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
        position.tokens_owed_x = position.tokens_owed_x - Liquidity::from_decimal(fee_to_collect_x);
        position.tokens_owed_y = position.tokens_owed_y - Liquidity::from_decimal(fee_to_collect_y);

        let signer: &[&[&[u8]]] = get_signer!(state.nonce);

        let cpi_ctx_x = self.send_x().with_signer(signer);
        let cpi_ctx_y = self.send_y().with_signer(signer);

        token::transfer(cpi_ctx_x, fee_to_collect_x.0)?;
        token::transfer(cpi_ctx_y, fee_to_collect_y.0)?;

        Ok(())
    }
}
