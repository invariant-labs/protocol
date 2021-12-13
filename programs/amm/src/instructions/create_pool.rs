use std::{cmp::Ordering, convert::TryInto};

use crate::decimal::Decimal;
use crate::math::calculate_price_sqrt;
use crate::structs::fee_tier::FeeTier;
use crate::structs::pool::Pool;
use crate::structs::tickmap::Tickmap;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
#[instruction(bump: u8, init_tick: i32, fee: u64, tick_spacing: u16)]
pub struct CreatePool<'info> {
    #[account(init,
        seeds = [b"poolv1", fee_tier.to_account_info().key.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
        bump = bump, payer = payer
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(
        seeds = [b"feetierv1", program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()],
        bump = fee_tier.load()?.bump
    )]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(zero)]
    pub tickmap: AccountLoader<'info, Tickmap>,
    pub token_x: Account<'info, Mint>,
    pub token_y: Account<'info, Mint>,
    #[account(constraint = &token_x_reserve.mint == token_x.to_account_info().key,)]
    pub token_x_reserve: Account<'info, TokenAccount>,
    #[account(constraint = &token_y_reserve.mint == token_y.to_account_info().key,)]
    pub token_y_reserve: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<CreatePool>,
    bump: u8,
    init_tick: i32,
    _fee: u64,
    _tick_spacing: u16,
) -> ProgramResult {
    msg!("INVARIANT: CREATE POOL");

    let token_x_address = ctx.accounts.token_x.to_account_info().key;
    let token_y_address = ctx.accounts.token_y.to_account_info().key;
    require!(
        token_x_address
            .to_string()
            .cmp(&token_y_address.to_string())
            == Ordering::Less,
        InvalidPoolTokenAddresses
    );

    let pool = &mut ctx.accounts.pool.load_init()?;
    let fee_tier = ctx.accounts.fee_tier.load()?;
    let current_timestamp: u64 = Clock::get()?.unix_timestamp.try_into().unwrap();

    **pool = Pool {
        token_x: *token_x_address,
        token_y: *token_y_address,
        token_x_reserve: *ctx.accounts.token_x_reserve.to_account_info().key,
        token_y_reserve: *ctx.accounts.token_y_reserve.to_account_info().key,
        tick_spacing: fee_tier.tick_spacing,
        fee: fee_tier.fee,
        liquidity: Decimal::new(0),
        sqrt_price: calculate_price_sqrt(init_tick),
        current_tick_index: init_tick,
        tickmap: *ctx.accounts.tickmap.to_account_info().key,
        fee_growth_global_x: Decimal::new(0),
        fee_growth_global_y: Decimal::new(0),
        fee_protocol_token_x: Decimal::new(0),
        fee_protocol_token_y: Decimal::new(0),
        position_iterator: 0,
        seconds_per_liquidity_global: Decimal::new(0),
        start_timestamp: current_timestamp,
        last_timestamp: current_timestamp,
        oracle_address: Pubkey::default(),
        oracle_initialized: false,
        bump,
    };

    Ok(())
}
