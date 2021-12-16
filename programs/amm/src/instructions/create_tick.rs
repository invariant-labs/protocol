use std::convert::TryInto;

use crate::math::calculate_price_sqrt;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::structs::FeeTier;
use crate::{decimal::Decimal, util::get_current_timestamp};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{Mint, Token};

#[derive(Accounts)]
#[instruction(bump: u8, fee: u64, tick_spacing: u16, index: i32)]
pub struct CreateTick<'info> {
    #[account(init,
        seeds = [b"tickv1", pool.key().as_ref(), &index.to_le_bytes()],
        bump = bump, payer = payer
    )]
    pub tick: AccountLoader<'info, Tick>,
    #[account(seeds = [b"feetierv1", program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()], bump = fee_tier.load()?.bump)]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(
        seeds = [b"poolv1", fee_tier.key().as_ref(), token_x.key().as_ref(), token_y.key().as_ref()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        constraint = &tickmap.key() == &pool.load()?.tickmap,
        constraint = tickmap.to_account_info().owner == program_id,
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        constraint = &token_x.key() == &pool.load()?.token_x)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = &token_y.key() == &pool.load()?.token_y)]
    pub token_y: Account<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CreateTick>, bump: u8, index: i32) -> ProgramResult {
    msg!("INVARIANT: CREATE_TICK");

    let mut tick = ctx.accounts.tick.load_init()?;
    let mut tickmap = ctx.accounts.tickmap.load_mut()?;
    let pool = ctx.accounts.pool.load()?;
    let current_timestamp = get_current_timestamp();

    // init tick
    let below_current_tick = index <= pool.current_tick_index;
    *tick = Tick {
        index,
        sign: true,
        liquidity_change: Decimal::new(0),
        liquidity_gross: Decimal::new(0),
        sqrt_price: calculate_price_sqrt(index),
        fee_growth_outside_x: match below_current_tick {
            true => pool.fee_growth_global_x,
            false => Decimal::new(0),
        },
        fee_growth_outside_y: match below_current_tick {
            true => pool.fee_growth_global_y,
            false => Decimal::new(0),
        },
        seconds_outside: match below_current_tick {
            true => (current_timestamp - pool.start_timestamp),
            false => 0,
        },
        seconds_per_liquidity_outside: match below_current_tick {
            true => pool.seconds_per_liquidity_global,
            false => Decimal::new(0),
        },
        bump,
    };

    Ok(())
}
