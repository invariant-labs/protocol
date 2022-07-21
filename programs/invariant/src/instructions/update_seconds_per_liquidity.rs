use crate::math;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::tick::Tick;
use crate::util::{get_current_slot, get_current_timestamp};
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::Mint;
use math::*;

#[derive(Accounts)]
#[instruction(lower_tick_index: i32, upper_tick_index: i32, index: i32)]
pub struct UpdateSecondsPerLiquidity<'info> {
    #[account(mut,
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(
        seeds = [b"tickv1", pool.key().as_ref(), &lower_tick_index.to_le_bytes()],
        bump = lower_tick.load()?.bump,
        constraint = lower_tick_index == position.load()?.lower_tick_index @ WrongTick
    )]
    pub lower_tick: AccountLoader<'info, Tick>,
    #[account(
        seeds = [b"tickv1", pool.key().as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump,
        constraint = upper_tick_index == position.load()?.upper_tick_index @ WrongTick
    )]
    pub upper_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.key().as_ref(),
        &index.to_le_bytes()],
        bump = position.load()?.bump
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount)]
    pub token_y: Account<'info, Mint>,
    pub owner: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

impl<'info> UpdateSecondsPerLiquidity<'info> {
    pub fn handler(&self) -> ProgramResult {
        msg!("INVARIANT: UPDATE SECOND PER LIQUIDITY");

        let pool = &mut self.pool.load_mut()?;
        let lower_tick = *self.lower_tick.load()?;
        let upper_tick = *self.upper_tick.load()?;
        let current_time = get_current_timestamp();
        let position = &mut self.position.load_mut()?;
        position.seconds_per_liquidity_inside =
            calculate_seconds_per_liquidity_inside(lower_tick, upper_tick, pool, current_time);
        position.last_slot = get_current_slot();

        Ok(())
    }
}
