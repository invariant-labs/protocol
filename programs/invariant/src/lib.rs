mod decimals;
mod errors;
mod instructions;
mod interfaces;
mod log;
mod macros;
mod math;
mod referral;
pub mod structs;
mod uint;
mod util;

use anchor_lang::prelude::*;
use anchor_spl::token;

use crate::decimals::*;
use errors::ErrorCode;
use instructions::*;
use math::*;
use structs::{Pool, State};
use util::*;

use instructions::claim_fee::ClaimFee;

declare_id!("5KLfYtAYvUchvTg8jb27eYgeRXLjPPsa9DqwjJJuYGQJ");
const SEED: &str = "Invariant";

#[program]
pub mod invariant {
    use super::*;

    pub fn create_state(ctx: Context<CreateState>, nonce: u8) -> Result<()> {
        instructions::create_state::handler(ctx, nonce)
    }
    #[access_control(admin(&ctx.accounts.state, &ctx.accounts.admin))]
    pub fn create_fee_tier(
        ctx: Context<CreateFeeTier>,
        fee: u128,
        tick_spacing: u16,
    ) -> Result<()> {
        ctx.accounts.handler(fee, tick_spacing, ctx.bumps.fee_tier)
    }

    pub fn create_pool(ctx: Context<CreatePool>, init_tick: i32) -> Result<()> {
        ctx.accounts.handler(init_tick, ctx.bumps.pool)
    }

    pub fn swap<'info>(
        ctx: Context<'_, '_, 'info, 'info, Swap<'info>>,
        x_to_y: bool,
        amount: u64,
        by_amount_in: bool, // whether amount specifies input or output
        sqrt_price_limit: u128,
    ) -> Result<()> {
        Swap::handler(ctx, x_to_y, amount, by_amount_in, sqrt_price_limit)
    }

    pub fn initialize_oracle(ctx: Context<InitializeOracle>) -> Result<()> {
        ctx.accounts.handler()
    }

    pub fn create_tick(ctx: Context<CreateTick>, index: i32) -> Result<()> {
        ctx.accounts.handler(index, ctx.bumps.tick)
    }

    pub fn create_position_list(ctx: Context<CreatePositionList>) -> Result<()> {
        ctx.accounts.handler(ctx.bumps.position_list)
    }

    pub fn create_position(
        ctx: Context<CreatePosition>,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
        liquidity_delta: Liquidity,
        slippage_limit_lower: Price,
        slippage_limit_upper: Price,
    ) -> Result<()> {
        ctx.accounts.handler(
            liquidity_delta,
            slippage_limit_lower,
            slippage_limit_upper,
            ctx.bumps.position,
        )
    }

    pub fn remove_position(
        ctx: Context<RemovePosition>,
        index: u32,
        lower_tick_index: i32,
        upper_tick_index: i32,
    ) -> Result<()> {
        ctx.accounts
            .handler(index, lower_tick_index, upper_tick_index)
    }

    pub fn transfer_position_ownership(
        ctx: Context<TransferPositionOwnership>,
        index: u32,
    ) -> Result<()> {
        ctx.accounts.handler(index, ctx.bumps.new_position)
    }

    pub fn claim_fee(
        ctx: Context<ClaimFee>,
        _index: u32,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
    ) -> Result<()> {
        ctx.accounts.handler()
    }

    pub fn update_seconds_per_liquidity(
        ctx: Context<UpdateSecondsPerLiquidity>,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
        _index: i32,
    ) -> Result<()> {
        ctx.accounts.handler()
    }

    #[access_control(receiver(&ctx.accounts.pool, &ctx.accounts.authority))]
    pub fn withdraw_protocol_fee(ctx: Context<WithdrawProtocolFee>) -> Result<()> {
        ctx.accounts.handler()
    }

    #[access_control(receiver(&ctx.accounts.pool, &ctx.accounts.admin))]
    pub fn change_protocol_fee(
        ctx: Context<ChangeProtocolFee>,
        protocol_fee: FixedPoint,
    ) -> Result<()> {
        ctx.accounts.handler(protocol_fee)
    }

    #[access_control(admin(&ctx.accounts.state, &ctx.accounts.admin))]
    pub fn change_fee_receiver(ctx: Context<ChangeFeeReceiver>) -> Result<()> {
        ctx.accounts.handler()
    }
}

fn admin(state_loader: &AccountLoader<State>, signer: &AccountInfo) -> Result<()> {
    let state = state_loader.load()?;
    require!(signer.key.eq(&state.admin), ErrorCode::Unauthorized);
    Ok(())
}

fn receiver(pool_loader: &AccountLoader<Pool>, signer: &AccountInfo) -> Result<()> {
    let pool = pool_loader.load()?;
    require!(signer.key.eq(&pool.fee_receiver), ErrorCode::Unauthorized);
    Ok(())
}
