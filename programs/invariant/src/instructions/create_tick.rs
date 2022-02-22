use crate::math::calculate_price_sqrt;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::structs::FeeGrowth;
use crate::util::check_tick;
use crate::ErrorCode::*;
use crate::{old_decimal::OldDecimal, util::get_current_timestamp};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction( index: i32)]
pub struct CreateTick<'info> {
    #[account(init,
        seeds = [b"tickv1", pool.key().as_ref(), &index.to_le_bytes()],
        bump, payer = payer
    )]
    pub tick: AccountLoader<'info, Tick>,
    #[account(
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.key() == pool.load()?.tickmap @ InvalidTickmap,
        constraint = tickmap.to_account_info().owner == program_id @ InvalidTickmapOwner,
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount)]
    pub token_y: Account<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

impl<'info> CreateTick<'info> {
    pub fn handler(self: &Self, index: i32, bump: u8) -> ProgramResult {
        msg!("INVARIANT: CREATE_TICK");

        let mut tick = self.tick.load_init()?;
        let pool = self.pool.load()?;
        let current_timestamp = get_current_timestamp();

        check_tick(index, pool.tick_spacing)?;

        // init tick
        let below_current_tick = index <= pool.current_tick_index;
        *tick = Tick {
            pool: self.pool.key(),
            index,
            sign: true,
            liquidity_change: OldDecimal::new(0),
            liquidity_gross: OldDecimal::new(0),
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
            seconds_per_liquidity_outside: match below_current_tick {
                true => pool.seconds_per_liquidity_global,
                false => OldDecimal::new(0),
            },
            bump,
        };

        Ok(())
    }
}
