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

    require!(tickmap_index >= (-TICK_LIMIT), InvalidTickIndex);
    require!(tickmap_index < TICK_LIMIT, InvalidTickIndex);
    require!(tick_index >= (-MAX_TICK), InvalidTickIndex);
    require!(tick_index <= MAX_TICK, InvalidTickIndex);

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

pub fn cross_tick(tick: &mut RefMut<Tick>, pool: &mut Pool, current_timestamp: u64) -> Result<()> {
    tick.fee_growth_outside_x = pool
        .fee_growth_global_x
        .unchecked_sub(tick.fee_growth_outside_x);
    tick.fee_growth_outside_y = pool
        .fee_growth_global_y
        .unchecked_sub(tick.fee_growth_outside_y);

    let seconds_passed: u64 = current_timestamp.checked_sub(pool.start_timestamp).unwrap();
    tick.seconds_outside = seconds_passed - tick.seconds_outside;

    if !pool.liquidity.is_zero() {
        pool.update_seconds_per_liquidity_global(current_timestamp);
    } else {
        pool.last_timestamp = current_timestamp;
    }
    tick.seconds_per_liquidity_outside = pool
        .seconds_per_liquidity_global
        .unchecked_sub(tick.seconds_per_liquidity_outside);

    // When going to higher tick net_liquidity should be added and for going lower subtracted
    if (pool.current_tick_index >= tick.index) ^ tick.sign {
        // trunk-ignore(clippy/assign_op_pattern)
        pool.liquidity = pool.liquidity + tick.liquidity_change;
    } else {
        // trunk-ignore(clippy/assign_op_pattern)
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
    use std::{
        borrow::{Borrow, BorrowMut},
        cell::RefCell,
        result,
    };

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

    #[test]
    fn test_cross_tick() -> Result<()> {
        {
            let mut pool = Pool {
                fee_growth_global_x: FeeGrowth::new(45),
                fee_growth_global_y: FeeGrowth::new(35),
                liquidity: Liquidity::from_integer(4),
                last_timestamp: 15,
                start_timestamp: 4,
                seconds_per_liquidity_global: FixedPoint::from_integer(11),
                current_tick_index: 7,
                ..Default::default()
            };
            let tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(30),
                fee_growth_outside_y: FeeGrowth::new(25),
                index: 3,
                seconds_outside: 5,
                seconds_per_liquidity_outside: FixedPoint::new(3),
                liquidity_change: Liquidity::from_integer(1),
                ..Default::default()
            };
            let result_pool = Pool {
                fee_growth_global_x: FeeGrowth::new(45),
                fee_growth_global_y: FeeGrowth::new(35),
                liquidity: Liquidity::from_integer(5),
                last_timestamp: 18446744073709,
                start_timestamp: 4,
                seconds_per_liquidity_global: FixedPoint::new(4611686018434500000000000),
                current_tick_index: 7,
                ..Default::default()
            };
            let result_tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(15),
                fee_growth_outside_y: FeeGrowth::new(10),
                index: 3,
                seconds_outside: 18446744073700,
                seconds_per_liquidity_outside: FixedPoint::new(4611686018434499999999997),
                liquidity_change: Liquidity::from_integer(1),
                ..Default::default()
            };

            let mut ref_tick = RefCell::new(tick);
            let mut refmut_tick = ref_tick.borrow_mut();

            cross_tick(&mut refmut_tick, &mut pool, 18446744073709);

            assert_eq!(*refmut_tick, result_tick);
            assert_eq!(pool, result_pool);
        }
        {
            let mut pool = Pool {
                fee_growth_global_x: FeeGrowth::new(68),
                fee_growth_global_y: FeeGrowth::new(59),
                liquidity: Liquidity::new(0),
                last_timestamp: 9,
                start_timestamp: 34,
                seconds_per_liquidity_global: FixedPoint::new(32),
                current_tick_index: 4,
                ..Default::default()
            };
            let tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(42),
                fee_growth_outside_y: FeeGrowth::new(14),
                index: 9,
                seconds_outside: 41,
                seconds_per_liquidity_outside: FixedPoint::new(23),
                liquidity_change: Liquidity::new(0),
                ..Default::default()
            };
            let result_pool = Pool {
                fee_growth_global_x: FeeGrowth::new(68),
                fee_growth_global_y: FeeGrowth::new(59),
                liquidity: Liquidity::new(0),
                last_timestamp: 1844674407370,
                start_timestamp: 34,
                seconds_per_liquidity_global: FixedPoint::new(32),
                current_tick_index: 4,
                ..Default::default()
            };
            let result_tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(26),
                fee_growth_outside_y: FeeGrowth::new(45),
                index: 9,
                seconds_outside: 1844674407295,
                seconds_per_liquidity_outside: FixedPoint::new(9),
                liquidity_change: Liquidity::from_integer(0),
                ..Default::default()
            };

            let mut fef_tick = RefCell::new(tick);
            let mut refmut_tick = fef_tick.borrow_mut();
            cross_tick(&mut refmut_tick, &mut pool, 1844674407370);
            assert_eq!(*refmut_tick, result_tick);
            assert_eq!(pool, result_pool);
        }
        {
            let mut pool = Pool {
                fee_growth_global_x: FeeGrowth::new(3402),
                fee_growth_global_y: FeeGrowth::new(3401),
                liquidity: Liquidity::new(14),
                last_timestamp: 9,
                start_timestamp: 15,
                seconds_per_liquidity_global: FixedPoint::new(22),
                current_tick_index: 9,
                ..Default::default()
            };
            let tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(26584),
                fee_growth_outside_y: FeeGrowth::new(1256588),
                index: 45,
                seconds_outside: 74,
                seconds_per_liquidity_outside: FixedPoint::new(23),
                liquidity_change: Liquidity::new(10),
                ..Default::default()
            };
            let result_pool = Pool {
                fee_growth_global_x: FeeGrowth::new(3402),
                fee_growth_global_y: FeeGrowth::new(3401),
                liquidity: Liquidity::new(4),
                last_timestamp: 1844674407370953,
                start_timestamp: 15,
                seconds_per_liquidity_global: FixedPoint::new(131762457669353142857142857142879),
                current_tick_index: 9,
                ..Default::default()
            };
            let result_tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(340282366920938463463374607431768188274),
                fee_growth_outside_y: FeeGrowth::new(340282366920938463463374607431766958269),
                index: 45,
                seconds_outside: 1844674407370864,
                seconds_per_liquidity_outside: FixedPoint::new(131762457669353142857142857142856),
                liquidity_change: Liquidity::new(10),
                ..Default::default()
            };

            let fef_tick = RefCell::new(tick);
            let mut refmut_tick = fef_tick.borrow_mut();
            cross_tick(&mut refmut_tick, &mut pool, 1844674407370953);
            assert_eq!(*refmut_tick, result_tick);
            assert_eq!(pool, result_pool);
        }
        {
            let mut pool = Pool {
                fee_growth_global_x: FeeGrowth::new(145),
                fee_growth_global_y: FeeGrowth::new(364),
                liquidity: Liquidity::new(14),
                last_timestamp: 16,
                start_timestamp: 15,
                seconds_per_liquidity_global: FixedPoint::new(354),
                current_tick_index: 9,
                ..Default::default()
            };
            let tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(99),
                fee_growth_outside_y: FeeGrowth::new(256),
                index: 45,
                seconds_outside: 74,
                seconds_per_liquidity_outside: FixedPoint::new(35),
                liquidity_change: Liquidity::new(10),
                ..Default::default()
            };
            let result_pool = Pool {
                fee_growth_global_x: FeeGrowth::new(145),
                fee_growth_global_y: FeeGrowth::new(364),
                liquidity: Liquidity::new(4),
                last_timestamp: 1844674407370953,
                start_timestamp: 15,
                seconds_per_liquidity_global: FixedPoint::new(131762457669352642857142857143211),
                current_tick_index: 9,
                ..Default::default()
            };
            let result_tick = Tick {
                fee_growth_outside_x: FeeGrowth::new(46),
                fee_growth_outside_y: FeeGrowth::new(108),
                index: 45,
                seconds_outside: 1844674407370864,
                seconds_per_liquidity_outside: FixedPoint::new(131762457669352642857142857143176),
                liquidity_change: Liquidity::new(10),
                ..Default::default()
            };

            let fef_tick = RefCell::new(tick);
            let mut refmut_tick = fef_tick.borrow_mut();
            cross_tick(&mut refmut_tick, &mut pool, 1844674407370953);
            assert_eq!(*refmut_tick, result_tick);
            assert_eq!(pool, result_pool);
        }
        Ok(())
    }
}
