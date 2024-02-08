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
use errors::*;
use instructions::*;
use math::*;
use structs::{Pool, State};
use util::*;

use instructions::claim_fee::ClaimFee;

declare_id!("HyaB3W9q6XdA5xwpU4XnSZV94htfmbmqJXZcEbRaJutt");
const SEED: &str = "Invariant";

#[program]
pub mod invariant {
    use super::*;

    pub fn create_state(ctx: Context<CreateState>, nonce: u8) -> ProgramResult {
        instructions::create_state::handler(ctx, nonce)
    }
    #[access_control(admin(&ctx.accounts.state, &ctx.accounts.admin))]
    pub fn create_fee_tier(
        ctx: Context<CreateFeeTier>,
        fee: u128,
        tick_spacing: u16,
    ) -> ProgramResult {
        ctx.accounts
            .handler(fee, tick_spacing, *ctx.bumps.get("fee_tier").unwrap())
    }

    pub fn create_pool(ctx: Context<CreatePool>, init_tick: i32) -> ProgramResult {
        ctx.accounts
            .handler(init_tick, *ctx.bumps.get("pool").unwrap())
    }

    pub fn swap<'info>(
        ctx: Context<'_, '_, '_, 'info, Swap<'info>>,
        x_to_y: bool,
        amount: u64,
        by_amount_in: bool, // whether amount specifies input or output
        sqrt_price_limit: u128,
    ) -> ProgramResult {
        Swap::handler(ctx, x_to_y, amount, by_amount_in, sqrt_price_limit)
    }

    pub fn initialize_oracle(ctx: Context<InitializeOracle>) -> ProgramResult {
        ctx.accounts.handler()
    }

    pub fn create_tick(ctx: Context<CreateTick>, index: i32) -> ProgramResult {
        ctx.accounts.handler(index, *ctx.bumps.get("tick").unwrap())
    }

    pub fn create_position_list(ctx: Context<CreatePositionList>) -> ProgramResult {
        ctx.accounts
            .handler(*ctx.bumps.get("position_list").unwrap())
    }

    pub fn create_position(
        ctx: Context<CreatePosition>,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
        liquidity_delta: Liquidity,
        slippage_limit_lower: Price,
        slippage_limit_upper: Price,
    ) -> ProgramResult {
        ctx.accounts.handler(
            liquidity_delta,
            slippage_limit_lower,
            slippage_limit_upper,
            *ctx.bumps.get("position").unwrap(),
        )
    }

    pub fn remove_position(
        ctx: Context<RemovePosition>,
        index: u32,
        lower_tick_index: i32,
        upper_tick_index: i32,
    ) -> ProgramResult {
        ctx.accounts
            .handler(index, lower_tick_index, upper_tick_index)
    }

    pub fn transfer_position_ownership(
        ctx: Context<TransferPositionOwnership>,
        index: u32,
    ) -> ProgramResult {
        ctx.accounts
            .handler(index, *ctx.bumps.get("new_position").unwrap())
    }

    pub fn claim_fee(
        ctx: Context<ClaimFee>,
        _index: u32,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
    ) -> ProgramResult {
        ctx.accounts.handler()
    }

    pub fn update_seconds_per_liquidity(
        ctx: Context<UpdateSecondsPerLiquidity>,
        _index: i32,
    ) -> ProgramResult {
        ctx.accounts.handler()
    }

    #[access_control(receiver(&ctx.accounts.pool, &ctx.accounts.authority))]
    pub fn withdraw_protocol_fee(ctx: Context<WithdrawProtocolFee>) -> ProgramResult {
        ctx.accounts.handler()
    }

    #[access_control(receiver(&ctx.accounts.pool, &ctx.accounts.admin))]
    pub fn change_protocol_fee(
        ctx: Context<ChangeProtocolFee>,
        protocol_fee: FixedPoint,
    ) -> ProgramResult {
        ctx.accounts.handler(protocol_fee)
    }

    #[access_control(admin(&ctx.accounts.state, &ctx.accounts.admin))]
    pub fn change_fee_receiver(ctx: Context<ChangeFeeReceiver>) -> ProgramResult {
        ctx.accounts.handler()
    }
}

fn admin(state_loader: &AccountLoader<State>, signer: &AccountInfo) -> Result<()> {
    let state = state_loader.load()?;
    require!(signer.key.eq(&state.admin), Unauthorized);
    Ok(())
}

fn receiver(pool_loader: &AccountLoader<Pool>, signer: &AccountInfo) -> Result<()> {
    let pool = pool_loader.load()?;
    require!(signer.key.eq(&pool.fee_receiver), Unauthorized);
    Ok(())
}
