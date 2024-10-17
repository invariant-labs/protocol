use crate::decimals::*;
use crate::math::calculate_price_sqrt;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::util::check_tick;
use crate::util::get_current_timestamp;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint, TokenInterface};

#[derive(Accounts)]
#[instruction( index: i32)]
pub struct CreateTick<'info> {
    #[account(init,
        seeds = [b"tickv1", pool.key().as_ref(), &index.to_le_bytes()],
        bump, payer = payer, space = Tick::LEN
    )]
    pub tick: AccountLoader<'info, Tick>,
    #[account(
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.key() == pool.load()?.tickmap @ InvalidTickmap,
        constraint = tickmap.to_account_info().owner == __program_id @ InvalidTickmapOwner,
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount,
        mint::token_program = token_x_program
    )]
    pub token_x: InterfaceAccount<'info, Mint>,
    #[account(
        constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount,
        mint::token_program = token_y_program
    )]
    pub token_y: InterfaceAccount<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,

    #[account(constraint = token_x_program.key() == token::ID || token_x_program.key() == token_2022::ID)]
    pub token_x_program: Interface<'info, TokenInterface>,
    #[account(constraint = token_y_program.key() == token::ID || token_y_program.key() == token_2022::ID)]
    pub token_y_program: Interface<'info, TokenInterface>,
}

impl<'info> CreateTick<'info> {
    pub fn handler(&self, index: i32, bump: u8) -> Result<()> {
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
            liquidity_change: Liquidity::new(0),
            liquidity_gross: Liquidity::new(0),
            sqrt_price: calculate_price_sqrt(index),
            fee_growth_outside_x: match below_current_tick {
                true => pool.fee_growth_global_x,
                false => FeeGrowth::new(0),
            },
            fee_growth_outside_y: match below_current_tick {
                true => pool.fee_growth_global_y,
                false => FeeGrowth::new(0),
            },
            seconds_outside: match below_current_tick {
                true => current_timestamp.checked_sub(pool.start_timestamp).unwrap(),
                false => 0,
            },
            seconds_per_liquidity_outside: match below_current_tick {
                true => pool.seconds_per_liquidity_global,
                false => FixedPoint::new(0),
            },
            bump,
        };

        Ok(())
    }
}
