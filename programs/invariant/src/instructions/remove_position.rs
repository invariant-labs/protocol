use crate::decimals::*;
use crate::interfaces::send_tokens::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::position_list::PositionList;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::util::{check_ticks, close};
use crate::ErrorCode::*;
use crate::*;
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(index: i32, lower_tick_index: i32, upper_tick_index: i32)]
pub struct RemovePosition<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.key().as_ref(),
        &index.to_le_bytes()],
        bump = removed_position.load()?.bump
    )]
    pub removed_position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"positionlistv1", owner.key().as_ref()],
        bump = position_list.load()?.bump
    )]
    pub position_list: AccountLoader<'info, PositionList>,
    #[account(mut,
        close = owner,
        seeds = [b"positionv1",
        owner.key().as_ref(),
        &(position_list.load()?.head - 1).to_le_bytes()],
        bump = last_position.load()?.bump
    )]
    pub last_position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.key() == pool.load()?.tickmap @ InvalidTickmap,
        constraint = tickmap.to_account_info().owner == program_id @ InvalidTickmapOwner,
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut,
        seeds = [b"tickv1", pool.key().as_ref(), &lower_tick_index.to_le_bytes()],
        bump = lower_tick.load()?.bump,
        constraint = lower_tick_index == removed_position.load()?.lower_tick_index @ WrongTick
    )]
    pub lower_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        seeds = [b"tickv1", pool.key().as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump,
        constraint = upper_tick_index == removed_position.load()?.upper_tick_index @ WrongTick
    )]
    pub upper_tick: AccountLoader<'info, Tick>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount)]
    pub token_y: Account<'info, Mint>,
    #[account(mut,
        constraint = account_x.mint == token_x.key() @ InvalidMint,
        constraint = &account_x.owner == owner.key @ InvalidOwner
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
    /// CHECK: safe as read from state
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    pub program_authority: AccountInfo<'info>,
    /// CHECK: safe as constant
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> SendTokens<'info> for RemovePosition<'info> {
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

impl<'info> RemovePosition<'info> {
    pub fn handler(
        &self,
        index: u32,
        lower_tick_index: i32,
        upper_tick_index: i32,
    ) -> ProgramResult {
        msg!("INVARIANT: REMOVE POSITION");

        let state = self.state.load()?;
        let mut position_list = self.position_list.load_mut()?;
        let removed_position = &mut self.removed_position.load_mut()?;
        let pool = &mut self.pool.load_mut()?;
        let tickmap = &mut self.tickmap.load_mut()?;
        let current_timestamp = get_current_timestamp();

        // closing tick can't be in the same scope as loaded tick
        let close_lower;
        let close_upper;

        let (amount_x, amount_y) = {
            let lower_tick = &mut self.lower_tick.load_mut()?;
            let upper_tick = &mut self.upper_tick.load_mut()?;

            // validate ticks
            check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;
            let liquidity_delta = removed_position.liquidity;
            let (amount_x, amount_y) = removed_position.modify(
                pool,
                upper_tick,
                lower_tick,
                liquidity_delta,
                false,
                current_timestamp,
            )?;

            let amount_x = amount_x + TokenAmount::from_decimal(removed_position.tokens_owed_x);
            let amount_y = amount_y + TokenAmount::from_decimal(removed_position.tokens_owed_y);

            close_lower = lower_tick.liquidity_gross.is_zero();
            close_upper = upper_tick.liquidity_gross.is_zero();

            (amount_x, amount_y)
        };

        if close_lower {
            {
                let lower_tick = &mut self.lower_tick.load_mut()?;
                **lower_tick = Default::default();
            }
            close(
                self.lower_tick.to_account_info(),
                self.owner.to_account_info(),
            )
            .unwrap();

            tickmap.flip(false, lower_tick_index, pool.tick_spacing);
        }
        if close_upper {
            {
                let upper_tick = &mut self.upper_tick.load_mut()?;
                **upper_tick = Default::default();
            }
            close(
                self.upper_tick.to_account_info(),
                self.owner.to_account_info(),
            )
            .unwrap();

            tickmap.flip(false, upper_tick_index, pool.tick_spacing);
        }

        // Remove empty position
        position_list.head = position_list.head.checked_sub(1).unwrap();

        // when removed position is not the last one
        if position_list.head != index {
            let mut last_position = self.last_position.load_mut()?;

            // reassign all fields in position
            **removed_position = Position {
                bump: removed_position.bump,
                owner: last_position.owner,
                pool: last_position.pool,
                id: last_position.id,
                liquidity: last_position.liquidity,
                lower_tick_index: last_position.lower_tick_index,
                upper_tick_index: last_position.upper_tick_index,
                fee_growth_inside_x: last_position.fee_growth_inside_x,
                fee_growth_inside_y: last_position.fee_growth_inside_y,
                seconds_per_liquidity_inside: last_position.seconds_per_liquidity_inside,
                last_slot: last_position.last_slot,
                tokens_owed_x: last_position.tokens_owed_x,
                tokens_owed_y: last_position.tokens_owed_y,
            };

            *last_position = Default::default();
        } else {
            **removed_position = Default::default();
        }

        let signer: &[&[&[u8]]] = get_signer!(state.nonce);
        token::transfer(self.send_x().with_signer(signer), amount_x.0)?;
        token::transfer(self.send_y().with_signer(signer), amount_y.0)?;

        Ok(())
    }
}
