use crate::math;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::tick::Tick;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::Mint;
use math::*;

#[derive(Accounts)]
#[instruction(fee_tier_address: Pubkey, lower_tick_index: i32, upper_tick_index: i32, index: i32)]
pub struct UpdateSecondsPerLiquitity<'info> {
    #[account(mut,
        seeds = [b"poolv1", fee_tier_address.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
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
    #[account(mut,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &index.to_le_bytes()],
        bump = position.load()?.bump
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut,
        constraint = token_x.to_account_info().key == &pool.load()?.token_x,
    )]
    pub token_x: Account<'info, Mint>,
    #[account(mut,
        constraint = token_y.to_account_info().key == &pool.load()?.token_y,
    )]
    pub token_y: Account<'info, Mint>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<UpdateSecondsPerLiquitity>,
    _fee_tier_address: Pubkey,
    _lower_tick_index: i32,
    _upper_tick_index: i32,
    _index: i32,
) -> ProgramResult {
    msg!("INVARIANT: UPDATE SECOND PER LIQUIDITY");

    let pool = &mut ctx.accounts.pool.load_mut()?;
    let lower_tick = *ctx.accounts.lower_tick.load()?;
    let upper_tick = *ctx.accounts.upper_tick.load()?;
    let current_time = Clock::get().unwrap().unix_timestamp as u64;
    let position = &mut ctx.accounts.position.load_mut()?;
    position.seconds_per_liquidity_inside =
        calculate_seconds_per_liquidity_inside(lower_tick, upper_tick, pool, current_time);
    position.last_slot = Clock::get()?.slot;

    Ok(())
}
