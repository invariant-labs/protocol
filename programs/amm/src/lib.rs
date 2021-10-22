mod account;
mod context;
mod decimal;
mod math;
mod position;
mod tickmap;
mod uint;
mod util;

use anchor_lang::prelude::*;
use anchor_spl::token;
use std::convert::TryInto;

use account::*;
use context::*;
use decimal::*;
use math::*;
use tickmap::*;
use util::{cross_tick, get_closer_limit};

declare_id!("FPr3fREovDnqMfubJTrJAFwopvJB8grXj1o3gkmSyzmw");
const SEED: &str = "Swapline";

#[program]
pub mod amm {

    use crate::{
        position::{calculate_amount_delta, calculate_fee_growth_inside},
        util::{check_ticks, get_tick_from_price},
    };

    use super::*;

    pub fn create(
        ctx: Context<Create>,
        bump: u8,
        nonce: u8,
        init_tick: i32,
        fee: u64,
        tick_spacing: u64,
    ) -> ProgramResult {
        let pool = &mut ctx.accounts.pool.load_init()?;

        **pool = Pool {
            token_x: *ctx.accounts.token_x.key,
            token_y: *ctx.accounts.token_y.key,
            token_x_reserve: *ctx.accounts.token_x_reserve.key,
            token_y_reserve: *ctx.accounts.token_y_reserve.key,
            tick_spacing: tick_spacing.try_into().unwrap(),
            fee: Decimal::from_decimal(fee.into(), 5),
            protocol_fee: Decimal::from_decimal(1, 1), // 10%
            liquidity: Decimal::new(0),
            sqrt_price: calculate_price_sqrt(init_tick),
            current_tick_index: init_tick,
            tickmap: *ctx.accounts.tickmap.to_account_info().key,
            fee_growth_global_x: Decimal::new(0),
            fee_growth_global_y: Decimal::new(0),
            fee_protocol_token_x: Decimal::new(0),
            fee_protocol_token_y: Decimal::new(0),
            bump: bump,
            nonce: nonce,
            authority: *ctx.accounts.program_authority.key,
        };

        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>,
        x_to_y: bool,
        amount: u64,
        by_amount_in: bool, // whether amount specifies input or output
        sqrt_price_limit: u128,
    ) -> ProgramResult {
        msg!("SWAP");
        require!(amount != 0, ZeroAmount);

        let sqrt_price_limit = Decimal::new(sqrt_price_limit);
        let mut pool = ctx.accounts.pool.load_mut()?;
        let tickmap = ctx.accounts.tickmap.load()?;

        // limit is on the right side of price
        if x_to_y {
            require!({ pool.sqrt_price } > sqrt_price_limit, WrongLimit);
        } else {
            require!({ pool.sqrt_price } < sqrt_price_limit, WrongLimit);
        }

        let mut remaining_amount = Decimal::from_integer(amount.into());

        let mut total_amount_in = Decimal::new(0);
        let mut total_amount_out = Decimal::new(0);

        while remaining_amount != Decimal::from_integer(0) {
            let (swap_limit, limiting_tick) = get_closer_limit(
                sqrt_price_limit,
                x_to_y,
                pool.current_tick_index,
                pool.tick_spacing,
                &tickmap,
            );

            let result = compute_swap_step(
                pool.sqrt_price,
                swap_limit,
                pool.liquidity,
                remaining_amount,
                by_amount_in,
                pool.fee,
            );

            // make remaining amount smaller
            if by_amount_in {
                remaining_amount = remaining_amount - result.amount_in - result.fee_amount;
            } else {
                remaining_amount = remaining_amount - result.amount_out;
            }

            // fee has to be added before crossing any ticks
            let protocol_fee = result.fee_amount * pool.protocol_fee;

            pool.add_fee(result.fee_amount - protocol_fee, x_to_y);
            if x_to_y {
                pool.fee_protocol_token_x = pool.fee_protocol_token_x + protocol_fee;
            } else {
                pool.fee_protocol_token_y = pool.fee_protocol_token_y + protocol_fee;
            }

            pool.sqrt_price = result.next_price_sqrt;

            total_amount_in = total_amount_in + result.amount_in + result.fee_amount;
            total_amount_out = total_amount_out + result.amount_out;

            // Fail if price would go over swap limit
            if { pool.sqrt_price } == sqrt_price_limit && remaining_amount > Decimal::new(0) {
                Err(ErrorCode::PriceLimitReached)?;
            }

            // crossing tick
            if result.next_price_sqrt == swap_limit && limiting_tick.is_some() {
                let (tick_index, initialized) = limiting_tick.unwrap();

                if initialized {
                    // Calculating address of the crossed tick
                    let (tick_address, _) = Pubkey::find_program_address(
                        &[
                            b"tickv1",
                            ctx.accounts.pool.to_account_info().key.as_ref(),
                            &tick_index.to_le_bytes(),
                        ],
                        ctx.program_id,
                    );

                    // Finding the correct tick in remaining accounts
                    let loader = match ctx
                        .remaining_accounts
                        .iter()
                        .find(|account| *account.key == tick_address)
                    {
                        Some(account) => {
                            Loader::<'_, Tick>::try_from(ctx.program_id, &account).unwrap()
                        }
                        None => return Err(ErrorCode::TickNotFound.into()),
                    };
                    let mut tick = loader.load_mut().unwrap();

                    // crossing tick
                    cross_tick(&mut tick, &mut pool);
                }

                // set tick to limit (below if price is going down, because current tick is below price)
                pool.current_tick_index = if x_to_y && remaining_amount != Decimal::new(0) {
                    tick_index - pool.tick_spacing as i32
                } else {
                    tick_index
                };
            } else {
                // Binary search for tick (can happen only on the last step)
                pool.current_tick_index = get_tick_from_price(
                    pool.current_tick_index,
                    pool.tick_spacing,
                    result.next_price_sqrt,
                    x_to_y,
                );
            }
        }

        // Execute swap
        let (take_ctx, send_ctx) = if x_to_y {
            (ctx.accounts.take_x(), ctx.accounts.send_y())
        } else {
            (ctx.accounts.take_y(), ctx.accounts.send_x())
        };

        let seeds = &[SEED.as_bytes(), &[pool.nonce]];
        let signer = &[&seeds[..]];

        // Maybe rounding error should be counted?
        token::transfer(
            take_ctx.with_signer(signer),
            total_amount_in.to_token_ceil(),
        )?;
        token::transfer(
            send_ctx.with_signer(signer),
            total_amount_out.to_token_floor(),
        )?;

        Ok(())
    }

    pub fn create_tick(ctx: Context<CreateTick>, bump: u8, index: i32) -> ProgramResult {
        msg!("CREATE_TICK");

        let mut tick = ctx.accounts.tick.load_init()?;
        let mut tickmap = ctx.accounts.tickmap.load_mut()?;
        let pool = ctx.accounts.pool.load()?;

        tickmap.set(index, pool.tick_spacing);

        // init tick
        let below_current_tick = index <= pool.current_tick_index;
        *tick = Tick {
            index: index,
            sign: true,
            liquidity_change: Decimal::new(0),
            liquidity_gross: Decimal::new(0),
            sqrt_price: calculate_price_sqrt(index),
            fee_growth_outside_x: match below_current_tick {
                true => pool.fee_growth_global_x,
                false => Decimal::new(0),
            },
            fee_growth_outside_y: match below_current_tick {
                true => pool.fee_growth_global_y,
                false => Decimal::new(0),
            },
            bump: bump,
        };

        Ok(())
    }

    pub fn create_position_list(ctx: Context<CreatePositionList>, bump: u8) -> ProgramResult {
        msg!("CREATE POSITION LIST");
        let mut position_list = ctx.accounts.position_list.load_init()?;

        *position_list = PositionList {
            head: 0,
            bump: bump,
        };

        Ok(())
    }

    pub fn init_position(
        ctx: Context<InitPosition>,
        bump: u8,
        lower_tick_index: i32,
        upper_tick_index: i32,
        liquidity_delta: Decimal,
    ) -> ProgramResult {
        msg!("INIT_POSITION");

        let mut position = ctx.accounts.position.load_init()?;
        let mut pool = ctx.accounts.pool.load_mut()?;
        let mut lower_tick = ctx.accounts.lower_tick.load_mut()?;
        let mut upper_tick = ctx.accounts.upper_tick.load_mut()?;
        let mut position_list = ctx.accounts.position_list.load_mut()?;

        // validate ticks
        check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;

        // update position_list head
        position_list.head += 1;

        // init position
        *position = Position {
            owner: *ctx.accounts.owner.to_account_info().key,
            pool: *ctx.accounts.pool.to_account_info().key,
            liquidity: Decimal::new(0),
            lower_tick_index: lower_tick.index,
            upper_tick_index: upper_tick.index,
            fee_growth_inside_x: Decimal::new(0),
            fee_growth_inside_y: Decimal::new(0),
            tokens_owed_x: Decimal::new(0),
            tokens_owed_y: Decimal::new(0),
            bump: bump,
        };

        // update initialized tick
        lower_tick.update(
            pool.current_tick_index,
            liquidity_delta,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
            false,
            true,
        )?;
        upper_tick.update(
            pool.current_tick_index,
            liquidity_delta,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
            true,
            true,
        )?;

        // update fee inside position
        let (fee_growth_inside_x, fee_growth_inside_y) = calculate_fee_growth_inside(
            *lower_tick,
            *upper_tick,
            pool.current_tick_index,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
        );

        position.update(
            true,
            liquidity_delta,
            fee_growth_inside_x,
            fee_growth_inside_y,
        )?;

        // calculate tokens amounts and update pool liquidity
        let (amount_x, amount_y) = calculate_amount_delta(
            &mut pool,
            liquidity_delta,
            true,
            upper_tick_index,
            lower_tick_index,
        )?;

        // send tokens to reserve
        let seeds = &[SEED.as_bytes(), &[pool.nonce]];
        let signer = &[&seeds[..]];

        let cpi_ctx_x = ctx.accounts.take_x().with_signer(signer);
        let cpi_ctx_y = ctx.accounts.take_y().with_signer(signer);

        token::transfer(cpi_ctx_x, amount_x)?;
        token::transfer(cpi_ctx_y, amount_y)?;
        Ok(())
    }

    pub fn remove_position(ctx: Context<RemovePosition>, index: u32) -> ProgramResult {
        msg!("REMOVE POSITION");

        let mut position_list = ctx.accounts.position_list.load_mut()?;
        position_list.head -= 1;

        // when removed position is not the last one
        if position_list.head != index {
            let mut removed_position = ctx.accounts.removed_position.load_mut()?;
            let last_position = ctx.accounts.last_position.load_mut()?;

            // reassign all fields in position
            *removed_position = Position {
                bump: removed_position.bump,
                owner: last_position.owner,
                pool: last_position.pool,
                liquidity: last_position.liquidity,
                lower_tick_index: last_position.lower_tick_index,
                upper_tick_index: last_position.upper_tick_index,
                fee_growth_inside_x: last_position.fee_growth_inside_x,
                fee_growth_inside_y: last_position.fee_growth_inside_y,
                tokens_owed_x: last_position.tokens_owed_x,
                tokens_owed_y: last_position.tokens_owed_y,
            };
        }

        Ok(())
    }

    pub fn withdraw(
        ctx: Context<ModifyPosition>,
        index: u32,
        lower_tick_index: i32,
        upper_tick_index: i32,
        liquidity_delta: Decimal,
    ) -> ProgramResult {
        msg!("WITHDRAW");

        let mut position = ctx.accounts.position.load_mut()?;
        let mut pool = ctx.accounts.pool.load_mut()?;
        let mut lower_tick = ctx.accounts.lower_tick.load_mut()?;
        let mut upper_tick = ctx.accounts.upper_tick.load_mut()?;

        // validate ticks
        check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;

        // update ticks
        lower_tick.update(
            pool.current_tick_index,
            liquidity_delta,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
            true,
            false,
        )?;
        upper_tick.update(
            pool.current_tick_index,
            liquidity_delta,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
            false,
            false,
        )?;

        // update fee inside position
        let (fee_growth_inside_x, fee_growth_inside_y) = calculate_fee_growth_inside(
            *lower_tick,
            *upper_tick,
            pool.current_tick_index,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
        );
        position.update(
            false,
            liquidity_delta,
            fee_growth_inside_x,
            fee_growth_inside_y,
        )?;

        // calculate tokens amounts and update pool liquidity
        let (amount_x, amount_y) = calculate_amount_delta(
            &mut pool,
            liquidity_delta,
            false,
            upper_tick_index,
            lower_tick_index,
        )?;

        // send tokens to reserve
        let seeds = &[SEED.as_bytes(), &[pool.nonce]];
        let signer = &[&seeds[..]];

        let cpi_ctx_x = ctx.accounts.send_x().with_signer(signer);
        let cpi_ctx_y = ctx.accounts.send_y().with_signer(signer);

        token::transfer(cpi_ctx_x, amount_x)?;
        token::transfer(cpi_ctx_y, amount_y)?;
        Ok(())
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
}
