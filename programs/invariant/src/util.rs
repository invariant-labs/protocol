use anchor_lang::__private::ErrorCode;
use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use std::cell::RefMut;
use std::convert::TryInto;
use std::io::Write;

use crate::math::calculate_price_sqrt;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::structs::tickmap::{get_search_limit, MAX_TICK, TICK_LIMIT};
use crate::*;

pub fn check_ticks(tick_lower: i32, tick_upper: i32, tick_spacing: u16) -> Result<()> {
    // Check order
    require!(tick_lower < tick_upper, InvalidTickIndex);

    check_tick(tick_lower, tick_spacing)?;
    check_tick(tick_upper, tick_spacing)?;

    Ok(())
}

pub fn check_tick(tick_index: i32, tick_spacing: u16) -> Result<()> {
    // Check order
    require!(
        tick_index.checked_rem(tick_spacing.into()) == Some(0),
        InvalidTickIndex
    );

    let tickmap_index = tick_index.checked_div(tick_spacing.into()).unwrap();

    require!(tickmap_index > (-TICK_LIMIT), InvalidTickIndex);
    require!(tickmap_index < TICK_LIMIT - 1, InvalidTickIndex);
    require!(tick_index > (-MAX_TICK), InvalidTickIndex);
    require!(tick_index < MAX_TICK, InvalidTickIndex);

    Ok(())
}

// Finds closes initialized tick in direction of trade
// and compares its price to the price limit of the trade
pub fn get_closer_limit(
    sqrt_price_limit: Price,
    x_to_y: bool,
    current_tick: i32,
    tick_spacing: u16,
    tickmap: &Tickmap,
) -> Result<(Price, Option<(i32, bool)>)> {
    let closes_tick_index = if x_to_y {
        tickmap.prev_initialized(current_tick, tick_spacing)
    } else {
        tickmap.next_initialized(current_tick, tick_spacing)
    };
    match closes_tick_index {
        Some(index) => {
            let price = calculate_price_sqrt(index);
            // trunk-ignore(clippy/if_same_then_else)
            if x_to_y && price > sqrt_price_limit {
                Ok((price, Some((index, true))))
            } else if !x_to_y && price < sqrt_price_limit {
                Ok((price, Some((index, true))))
            } else {
                Ok((sqrt_price_limit, None))
            }
        }
        None => {
            let index = get_search_limit(current_tick, tick_spacing, !x_to_y);
            let price = calculate_price_sqrt(index);

            require!(current_tick != index, LimitReached);

            // trunk-ignore(clippy/if_same_then_else)
            if x_to_y && price > sqrt_price_limit {
                Ok((price, Some((index, false))))
            } else if !x_to_y && price < sqrt_price_limit {
                Ok((price, Some((index, false))))
            } else {
                Ok((sqrt_price_limit, None))
            }
        }
    }
}

pub fn cross_tick(tick: &mut RefMut<Tick>, pool: &mut Pool) -> Result<()> {
    tick.fee_growth_outside_x = pool.fee_growth_global_x - tick.fee_growth_outside_x;
    tick.fee_growth_outside_y = pool.fee_growth_global_y - tick.fee_growth_outside_y;

    let current_timestamp = get_current_timestamp();
    let seconds_passed: u64 = current_timestamp.checked_sub(pool.start_timestamp).unwrap();
    tick.seconds_outside = seconds_passed - tick.seconds_outside;

    if !pool.liquidity.is_zero() {
        pool.update_seconds_per_liquidity_global(current_timestamp);
    } else {
        pool.last_timestamp = current_timestamp;
    }
    tick.seconds_per_liquidity_outside =
        pool.seconds_per_liquidity_global - tick.seconds_per_liquidity_outside;

    // When going to higher tick net_liquidity should be added and for going lower subtracted
    if (pool.current_tick_index >= tick.index) ^ tick.sign {
        pool.liquidity = pool.liquidity + tick.liquidity_change;
    } else {
        pool.liquidity = pool.liquidity - tick.liquidity_change;
    }

    Ok(())
}

pub fn get_current_timestamp() -> u64 {
    Clock::get().unwrap().unix_timestamp.try_into().unwrap()
}

pub fn get_current_slot() -> u64 {
    Clock::get().unwrap().slot
}

pub fn close<'info>(
    info: AccountInfo<'info>,
    sol_destination: AccountInfo<'info>,
) -> ProgramResult {
    // Transfer tokens from the account to the sol_destination.
    let dest_starting_lamports = sol_destination.lamports();
    **sol_destination.lamports.borrow_mut() =
        dest_starting_lamports.checked_add(info.lamports()).unwrap();
    **info.lamports.borrow_mut() = 0;

    // Mark the account discriminator as closed.
    let mut data = info.try_borrow_mut_data()?;
    let dst: &mut [u8] = &mut data;
    let mut cursor = std::io::Cursor::new(dst);
    cursor
        .write_all(&CLOSED_ACCOUNT_DISCRIMINATOR)
        .map_err(|_| ErrorCode::AccountDidNotSerialize)?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_get_closer_limit() -> Result<()> {
        let tickmap = &mut Tickmap::default();
        tickmap.flip(true, 0, 1);
        // tick limit closer
        {
            let (result, from_tick) =
                get_closer_limit(Price::from_integer(5), true, 100, 1, tickmap)?;

            let expected = Price::from_integer(5);
            assert_eq!(result, expected);
            assert_eq!(from_tick, None);
        }
        // trade limit closer
        {
            let (result, from_tick) =
                get_closer_limit(Price::from_scale(1, 1), true, 100, 1, tickmap)?;
            let expected = Price::from_integer(1);
            assert_eq!(result, expected);
            assert_eq!(from_tick, Some((0, true)));
        }
        // other direction
        {
            let (result, from_tick) =
                get_closer_limit(Price::from_integer(2), false, -5, 1, tickmap)?;
            let expected = Price::from_integer(1);
            assert_eq!(result, expected);
            assert_eq!(from_tick, Some((0, true)));
        }
        // other direction
        {
            let (result, from_tick) =
                get_closer_limit(Price::from_scale(1, 1), false, -100, 10, tickmap)?;
            let expected = Price::from_scale(1, 1);
            assert_eq!(result, expected);
            assert_eq!(from_tick, None);
        }
        Ok(())
    }
}
