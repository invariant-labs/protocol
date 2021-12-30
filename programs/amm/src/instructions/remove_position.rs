use std::convert::TryInto;

use crate::decimal::Decimal;
use crate::interfaces::send_tokens::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::position_list::PositionList;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::util::{check_ticks, close};
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
        owner.to_account_info().key.as_ref(),
        &index.to_le_bytes()],
        bump = removed_position.load()?.bump
    )]
    pub removed_position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = position_list.load()?.bump
    )]
    pub position_list: AccountLoader<'info, PositionList>,
    #[account(mut,
        close = owner,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &(position_list.load()?.head - 1).to_le_bytes()],
        bump = last_position.load()?.bump
    )]
    pub last_position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.to_account_info().key == &pool.load()?.tickmap,
        constraint = tickmap.to_account_info().owner == program_id,
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &lower_tick_index.to_le_bytes()],
        bump = lower_tick.load()?.bump
    )]
    pub lower_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump
    )]
    pub upper_tick: AccountLoader<'info, Tick>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(constraint = token_x.to_account_info().key == &pool.load()?.token_x,)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = token_y.to_account_info().key == &pool.load()?.token_y,)]
    pub token_y: Account<'info, Mint>,
    #[account(mut,
        constraint = &account_x.mint == token_x.to_account_info().key,
        constraint = &account_x.owner == owner.key,
    )]
    pub account_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = &account_y.mint == token_y.to_account_info().key,
        constraint = &account_y.owner == owner.key	
    )]
    pub account_y: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = &reserve_x.mint == token_x.to_account_info().key,
        constraint = &reserve_x.owner == program_authority.key,
        constraint = reserve_x.to_account_info().key == &pool.load()?.token_x_reserve
    )]
    pub reserve_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = &reserve_y.mint == token_y.to_account_info().key,
        constraint = &reserve_y.owner == program_authority.key,
        constraint = reserve_y.to_account_info().key == &pool.load()?.token_y_reserve
    )]
    pub reserve_y: Box<Account<'info, TokenAccount>>,
    #[account(constraint = &state.load()?.authority == program_authority.key)]
    pub program_authority: AccountInfo<'info>,
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

pub fn handler(
    ctx: Context<RemovePosition>,
    index: u32,
    lower_tick_index: i32,
    upper_tick_index: i32,
) -> ProgramResult {
    msg!("INVARIANT: REMOVE POSITION");

    let state = ctx.accounts.state.load()?;
    let mut position_list = ctx.accounts.position_list.load_mut()?;
    let removed_position = &mut ctx.accounts.removed_position.load_mut()?;
    let pool = &mut ctx.accounts.pool.load_mut()?;
    let tickmap = &mut ctx.accounts.tickmap.load_mut()?;
    let current_timestamp = Clock::get()?.unix_timestamp.try_into().unwrap();

    // closing tick can't be in the same scope as loaded tick
    let close_lower;
    let close_upper;

    let (amount_x, amount_y) = {
        let lower_tick = &mut ctx.accounts.lower_tick.load_mut()?;
        let upper_tick = &mut ctx.accounts.upper_tick.load_mut()?;

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

        let amount_x = amount_x + removed_position.tokens_owed_x.to_token_floor();
        let amount_y = amount_y + removed_position.tokens_owed_y.to_token_floor();

        close_lower = { lower_tick.liquidity_gross } == Decimal::new(0);
        close_upper = { upper_tick.liquidity_gross } == Decimal::new(0);

        (amount_x, amount_y)
    };

    if close_lower {
        close(
            ctx.accounts.lower_tick.to_account_info(),
            ctx.accounts.owner.to_account_info(),
        )
        .unwrap();
        tickmap.flip(false, lower_tick_index, pool.tick_spacing);
    }
    if close_upper {
        close(
            ctx.accounts.upper_tick.to_account_info(),
            ctx.accounts.owner.to_account_info(),
        )
        .unwrap();
        tickmap.flip(false, upper_tick_index, pool.tick_spacing);
    }

    // Remove empty position
    position_list.head -= 1;

    // when removed position is not the last one
    if position_list.head != index {
        let last_position = ctx.accounts.last_position.load_mut()?;

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
    }

    let seeds = &[SEED.as_bytes(), &[state.nonce]];
    let signer = &[&seeds[..]];

    token::transfer(ctx.accounts.send_x().with_signer(signer), amount_x.0)?;
    token::transfer(ctx.accounts.send_y().with_signer(signer), amount_y.0)?;

    Ok(())
}
