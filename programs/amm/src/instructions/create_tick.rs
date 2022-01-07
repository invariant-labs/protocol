use std::convert::TryInto;

use crate::decimal::Decimal;
use crate::math::calculate_price_sqrt;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::structs::FeeGrowth;
use crate::util::check_tick;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
#[instruction(bump: u8, index: i32)]
pub struct CreateTick<'info> {
    #[account(init,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &index.to_le_bytes()],
        bump = bump, payer = payer
    )]
    pub tick: AccountLoader<'info, Tick>,
    #[account(
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.to_account_info().key == &pool.load()?.tickmap,
        constraint = tickmap.to_account_info().owner == program_id,
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(constraint = token_x.to_account_info().key == &pool.load()?.token_x)]
    pub token_x: AccountInfo<'info>,
    #[account(constraint = token_y.to_account_info().key == &pool.load()?.token_y)]
    pub token_y: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CreateTick>, bump: u8, index: i32) -> ProgramResult {
    msg!("INVARIANT: CREATE_TICK");

    let mut tick = ctx.accounts.tick.load_init()?;
    let mut tickmap = ctx.accounts.tickmap.load_mut()?;
    let pool = ctx.accounts.pool.load()?;
    let current_timestamp: u64 = Clock::get()?.unix_timestamp.try_into().unwrap();

    check_tick(index, pool.tick_spacing)?;
    tickmap.flip(true, index, pool.tick_spacing);

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
            false => FeeGrowth::zero(),
        },
        fee_growth_outside_y: match below_current_tick {
            true => pool.fee_growth_global_y,
            false => FeeGrowth::zero(),
        },
        seconds_outside: match below_current_tick {
            true => (current_timestamp.checked_sub(pool.start_timestamp).unwrap()),
            false => 0,
        },
        seconds_per_liquidity_outside: Decimal::new(0),
        bump,
    };

    Ok(())
}
