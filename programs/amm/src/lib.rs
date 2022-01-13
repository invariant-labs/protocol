mod decimal;
mod errors;
mod instructions;
mod interfaces;
mod log;
mod macros;
mod math;
pub mod structs;
mod uint;
mod util;

use anchor_lang::prelude::*;
use anchor_spl::token;

use decimal::*;
use errors::ErrorCode;
use errors::*;
use instructions::*;
use math::*;
use structs::{Pool, State};
use util::*;

use instructions::claim_fee::ClaimFee;

declare_id!("R9PatsTac3Y3UpC7ihYMMgzAQCe1tXnVvkSQ8DtLWUc");
const SEED: &str = "Invariant";

#[program]
pub mod amm {
    use super::*;

    pub fn create_state(ctx: Context<CreateState>, bump: u8, nonce: u8) -> ProgramResult {
        instructions::create_state::handler(ctx, bump, nonce)
    }
    #[access_control(admin(&ctx.accounts.state, &ctx.accounts.admin))]
    pub fn create_fee_tier(
        ctx: Context<CreateFeeTier>,
        bump: u8,
        fee: u128,
        tick_spacing: u16,
    ) -> ProgramResult {
        instructions::create_fee_tier::handler(ctx, bump, fee, tick_spacing)
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        bump: u8,
        init_tick: i32,
        protocol_fee: Decimal,
    ) -> ProgramResult {
        instructions::create_pool::handler(ctx, bump, init_tick, protocol_fee)
    }

    pub fn swap(
        ctx: Context<Swap>,
        x_to_y: bool,
        amount: u64,
        by_amount_in: bool, // whether amount specifies input or output
        sqrt_price_limit: u128,
    ) -> ProgramResult {
        instructions::swap::handler(ctx, x_to_y, amount, by_amount_in, sqrt_price_limit)
    }

    pub fn initialize_oracle(ctx: Context<InitializeOracle>) -> ProgramResult {
        instructions::initialize_oracle::handler(ctx)
    }

    pub fn create_tick(ctx: Context<CreateTick>, bump: u8, index: i32) -> ProgramResult {
        instructions::create_tick::handler(ctx, bump, index)
    }

    pub fn create_position_list(ctx: Context<CreatePositionList>, bump: u8) -> ProgramResult {
        instructions::create_position_list::handler(ctx, bump)
    }

    pub fn create_position(
        ctx: Context<CreatePosition>,
        bump: u8,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
        liquidity_delta: Decimal,
    ) -> ProgramResult {
        instructions::create_position::handler(ctx, bump, liquidity_delta)
    }

    pub fn remove_position(
        ctx: Context<RemovePosition>,
        index: u32,
        lower_tick_index: i32,
        upper_tick_index: i32,
    ) -> ProgramResult {
        instructions::remove_position::handler(ctx, index, lower_tick_index, upper_tick_index)
    }

    pub fn transfer_position_ownership(
        ctx: Context<TransferPositionOwnership>,
        bump: u8,
        index: u32,
    ) -> ProgramResult {
        instructions::transfer_position_ownership::handler(ctx, bump, index)
    }

    pub fn claim_fee(
        ctx: Context<ClaimFee>,
        _index: u32,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
    ) -> ProgramResult {
        instructions::claim_fee::handler(ctx)
    }

    pub fn update_seconds_per_liquidity(
        ctx: Context<UpdateSecondsPerLiquidity>,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
        _index: i32,
    ) -> ProgramResult {
        instructions::update_seconds_per_liquidity::handler(ctx)
    }

    #[access_control(receiver(&ctx.accounts.pool, &ctx.accounts.authority))]
    pub fn withdraw_protocol_fee(ctx: Context<WithdrawProtocolFee>) -> ProgramResult {
        instructions::withdraw_protocol_fee::handler(ctx)
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
