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

declare_id!("6jtEY7kz17tLjKCNTybJBz8GbXSjwAiV5Ufjqsiyauys");
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
        instructions::create_fee_tier::handler(ctx, fee, tick_spacing)
    }

    pub fn create_pool(ctx: Context<CreatePool>, init_tick: i32) -> ProgramResult {
        instructions::create_pool::handler(ctx, init_tick)
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

    pub fn create_tick(ctx: Context<CreateTick>, index: i32) -> ProgramResult {
        instructions::create_tick::handler(ctx, index)
    }

    pub fn create_position_list(ctx: Context<CreatePositionList>) -> ProgramResult {
        instructions::create_position_list::handler(ctx)
    }

    pub fn create_position(
        ctx: Context<CreatePosition>,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
        liquidity_delta: Decimal,
    ) -> ProgramResult {
        instructions::create_position::handler(ctx, liquidity_delta)
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
        index: u32,
    ) -> ProgramResult {
        instructions::transfer_position_ownership::handler(ctx, index)
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

    #[access_control(receiver(&ctx.accounts.pool, &ctx.accounts.admin))]
    pub fn change_protocol_fee(
        ctx: Context<ChangeProtocolFee>,
        protocol_fee: Decimal,
    ) -> ProgramResult {
        instructions::change_protocol_fee::handler(ctx, protocol_fee)
    }

    #[access_control(admin(&ctx.accounts.state, &ctx.accounts.admin))]
    pub fn change_fee_receiver(ctx: Context<ChangeFeeReceiver>) -> ProgramResult {
        instructions::change_fee_receiver::handler(ctx)
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
