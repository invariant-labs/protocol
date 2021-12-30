use std::cmp::Ordering;

use crate::math::calculate_price_sqrt;
use crate::structs::fee_tier::FeeTier;
use crate::structs::pool::Pool;
use crate::structs::tickmap::Tickmap;
use crate::util::get_current_timestamp;
use crate::{decimal::Decimal, structs::State};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreatePool<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(init,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &fee_tier.load()?.fee.v.to_le_bytes(), &fee_tier.load()?.tick_spacing.to_le_bytes()],
        bump = bump, payer = payer
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(
        seeds = [b"feetierv1", program_id.as_ref(), &fee_tier.load()?.fee.v.to_le_bytes(), &fee_tier.load()?.tick_spacing.to_le_bytes()],
        bump = fee_tier.load()?.bump
    )]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(zero)]
    pub tickmap: AccountLoader<'info, Tickmap>,
    pub token_x: Account<'info, Mint>,
    pub token_y: Account<'info, Mint>,
    #[account(
        constraint = &token_x_reserve.mint == &token_x.key(),
        constraint = token_x_reserve.owner == state.load()?.authority
    )]
    // we can also initialize those accounts in create_pool
    pub token_x_reserve: Account<'info, TokenAccount>,
    #[account(
        constraint = &token_y_reserve.mint == &token_y.key(),
        constraint = token_y_reserve.owner == state.load()?.authority
    )]
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
    protocol_fee: Decimal,
) -> ProgramResult {
    msg!("INVARIANT: CREATE POOL");

    let token_x_address = &ctx.accounts.token_x.key();
    let token_y_address = &ctx.accounts.token_y.key();
    require!(
        token_x_address
            .to_string()
            .cmp(&token_y_address.to_string())
            == Ordering::Less,
        InvalidPoolTokenAddresses
    );

    let pool = &mut ctx.accounts.pool.load_init()?;
    let fee_tier = ctx.accounts.fee_tier.load()?;
    let current_timestamp = get_current_timestamp();

    **pool = Pool {
        token_x: *token_x_address,
        token_y: *token_y_address,
        token_x_reserve: *ctx.accounts.token_x_reserve.to_account_info().key,
        token_y_reserve: *ctx.accounts.token_y_reserve.to_account_info().key,
        tick_spacing: fee_tier.tick_spacing,
        fee: fee_tier.fee,
        protocol_fee,
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
