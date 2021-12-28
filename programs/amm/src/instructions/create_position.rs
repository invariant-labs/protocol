use std::convert::TryInto;

use crate::decimal::Decimal;
use crate::interfaces::take_tokens::TakeTokens;
use crate::structs::FeeGrowth;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::position_list::PositionList;
use crate::structs::tick::Tick;
use crate::util::check_ticks;
use crate::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

use anchor_spl::token;
use anchor_spl::token::{Mint, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(bump: u8, lower_tick_index: i32, upper_tick_index: i32)]
pub struct CreatePosition<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(init,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &position_list.load()?.head.to_le_bytes()],
        bump = bump, payer = owner,
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = position_list.load()?.bump
    )]
    pub position_list: AccountLoader<'info, PositionList>,
    #[account(mut)]
    pub owner: Signer<'info>,
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
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

impl<'info> TakeTokens<'info> for CreatePosition<'info> {
    fn take_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_x.to_account_info(),
                to: self.reserve_x.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }

    fn take_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_y.to_account_info(),
                to: self.reserve_y.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }
}

pub fn handler(
    ctx: Context<CreatePosition>,
    bump: u8,
    liquidity_delta: Decimal,
) -> ProgramResult {
    msg!("INVARIANT: CREATE POSITION");

    let mut position = ctx.accounts.position.load_init()?;
    let mut pool = &mut ctx.accounts.pool.load_mut()?;
    let lower_tick = &mut ctx.accounts.lower_tick.load_mut()?;
    let upper_tick = &mut ctx.accounts.upper_tick.load_mut()?;
    let mut position_list = ctx.accounts.position_list.load_mut()?;
    let current_timestamp = Clock::get()?.unix_timestamp.try_into().unwrap();
    let slot = Clock::get()?.slot;

    // validate ticks
    check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;

    // update position_list head
    position_list.head += 1;
    position.initialized_id(&mut pool);

    // init position
    *position = Position {
        owner: *ctx.accounts.owner.to_account_info().key,
        pool: *ctx.accounts.pool.to_account_info().key,
        id: position.id,
        liquidity: Decimal::new(0),
        lower_tick_index: lower_tick.index,
        upper_tick_index: upper_tick.index,
        fee_growth_inside_x: FeeGrowth::zero(),
        fee_growth_inside_y: FeeGrowth::zero(),
        seconds_per_liquidity_inside: Decimal::new(0),
        last_slot: slot,
        tokens_owed_x: Decimal::new(0),
        tokens_owed_y: Decimal::new(0),
        bump,
    };

    let (amount_x, amount_y) = position.modify(
        pool,
        upper_tick,
        lower_tick,
        liquidity_delta,
        true,
        current_timestamp,
    )?;

    token::transfer(ctx.accounts.take_x(), amount_x)?;
    token::transfer(ctx.accounts.take_y(), amount_y)?;
    Ok(())
}
