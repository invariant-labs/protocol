mod decimal;
mod instructions;
mod interfaces;
mod math;
mod state;
mod uint;
mod util;

use anchor_lang::prelude::*;
use anchor_spl::token;

use decimal::*;
use instructions::*;
use math::*;
use util::*;

use instructions::claim_fee::ClaimFee;

declare_id!("FPr3fREovDnqMfubJTrJAFwopvJB8grXj1o3gkmSyzmw");
const SEED: &str = "Invariant";

#[program]
pub mod amm {
    use super::*;

    pub fn create_fee_tier(
        ctx: Context<CreateFeeTier>,
        bump: u8,
        fee: u64,
        tick_spacing: u16,
    ) -> ProgramResult {
        instructions::create_fee_tier::handler(ctx, bump, fee, tick_spacing)
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        bump: u8,
        nonce: u8,
        init_tick: i32,
        _fee: u64,
        _tick_spacing: u16,
    ) -> ProgramResult {
        instructions::create_pool::handler(ctx, bump, nonce, init_tick, _fee, _tick_spacing)
    }

    pub fn swap(
        ctx: Context<Swap>,
        _fee_tier_address: Pubkey,
        x_to_y: bool,
        amount: u64,
        by_amount_in: bool, // whether amount specifies input or output
        sqrt_price_limit: u128,
    ) -> ProgramResult {
        instructions::swap::handler(
            ctx,
            _fee_tier_address,
            x_to_y,
            amount,
            by_amount_in,
            sqrt_price_limit,
        )
    }

    pub fn create_tick(
        ctx: Context<CreateTick>,
        bump: u8,
        _fee_tier_address: Pubkey,
        index: i32,
    ) -> ProgramResult {
        instructions::create_tick::handler(ctx, bump, _fee_tier_address, index)
    }

    pub fn create_position_list(ctx: Context<CreatePositionList>, bump: u8) -> ProgramResult {
        instructions::create_position_list::handler(ctx, bump)
    }

    pub fn create_position(
        ctx: Context<CreatePosition>,
        bump: u8,
        _fee_tier_address: Pubkey,
        _lower_tick_index: i32,
        _upper_tick_index: i32,
        liquidity_delta: Decimal,
    ) -> ProgramResult {
        instructions::create_position::handler(
            ctx,
            bump,
            _fee_tier_address,
            _lower_tick_index,
            _upper_tick_index,
            liquidity_delta,
        )
    }

    pub fn remove_position(
        ctx: Context<RemovePosition>,
        _fee_tier_address: Pubkey,
        index: u32,
        lower_tick_index: i32,
        upper_tick_index: i32,
    ) -> ProgramResult {
        instructions::remove_position::handler(
            ctx,
            _fee_tier_address,
            index,
            lower_tick_index,
            upper_tick_index,
        )
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
        fee_tier_address: Pubkey,
        index: u32,
        lower_tick_index: i32,
        upper_tick_index: i32,
    ) -> ProgramResult {
        instructions::claim_fee::handler(
            ctx,
            fee_tier_address,
            index,
            lower_tick_index,
            upper_tick_index,
        )
    }
}

#[error]
pub enum ErrorCode {
    #[msg("Amount is zero")]
    ZeroAmount = 0, // 12c
    #[msg("Output would be zero")]
    ZeroOutput = 1, // 12d
    #[msg("Not the expected tick")]
    WrongTick = 2, // 12e
    #[msg("Price limit is on the wrong side of price")]
    WrongLimit = 3, // 12f
    #[msg("Tick index not divisible by spacing")]
    InvalidTickIndex = 4, // 130
    #[msg("Invalid tick_lower or tick_upper")]
    InvalidTickInterval = 5, // 131
    #[msg("There is no more tick in that direction")]
    NoMoreTicks = 6, // 132
    #[msg("Correct tick not found in context")]
    TickNotFound = 7, // 133
    #[msg("Price would cross swap limit")]
    PriceLimitReached = 8, // 134
    #[msg("Invalid tick liquidity")]
    InvalidTickLiquidity = 9, // 135
    #[msg("Disable empty position pokes")]
    EmptyPositionPokes = 10, // 136
    #[msg("Invalid tick liquidity")]
    InvalidPositionLiquidity = 11, // 135
    #[msg("Invalid pool liquidity")]
    InvalidPoolLiquidity = 12, // 136
    #[msg("Invalid position index")]
    InvalidPositionIndex = 13, // 137
    #[msg("Position liquidity would be zero")]
    PositionWithoutLiquidity = 14, // 138
}
