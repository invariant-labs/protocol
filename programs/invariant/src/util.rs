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
    // tick.fee_growth_outside = fee_growth_global - tick.fee_growth_outside
    tick.fee_growth_outside_x = pool
        .fee_growth_global_x
        .unchecked_sub(tick.fee_growth_outside_x);
    tick.fee_growth_outside_y = pool
        .fee_growth_global_y
        .unchecked_sub(tick.fee_growth_outside_y);

    // let current_timestamp: u64 = ;

    //second_passed=current_timestamp-pool.start_timestamp
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
    //seconds_per_liquidity_outside=seconds_per_liquidity_global-tick.seconds_per_liquidity_outside

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
        //conception
        let mut test_pool = Pool {
            fee_growth_global_x: FeeGrowth::from_integer(9),
            fee_growth_global_y: FeeGrowth::from_integer(4),
            liquidity: Liquidity::from_integer(2),
            last_timestamp: 10,
            start_timestamp: 0,
            seconds_per_liquidity_global: FixedPoint::from_integer(8),
            current_tick_index: 2,
            ..Default::default()
        };

        let mut test_tick = Tick {
            index: 3,
            seconds_per_liquidity_outside: FixedPoint { v: (3) },
            liquidity_change: Liquidity::from_integer(1),
            fee_growth_outside_x: FeeGrowth::from_integer(11),
            fee_growth_outside_y: FeeGrowth::from_integer(1),
            seconds_outside: 5,

            ..Default::default()
        };
        //without underfolw
        {
            //When pool.current_tick_index is higher then tick.index
            {
                //test_pool
                test_pool.fee_growth_global_x = FeeGrowth { v: (45) };
                test_pool.fee_growth_global_y = FeeGrowth { v: (35) };
                test_pool.liquidity = Liquidity::from_integer(4);
                test_pool.last_timestamp = 15;
                test_pool.start_timestamp = 4;
                test_pool.seconds_per_liquidity_global = FixedPoint::from_integer(11);
                test_pool.current_tick_index = 7;
                //test_tick
                test_tick.fee_growth_outside_x = FeeGrowth { v: (30) };
                test_tick.fee_growth_outside_y = FeeGrowth { v: (25) };
                test_tick.index = 3;
                test_tick.seconds_outside = 5;
                test_tick.seconds_per_liquidity_outside = FixedPoint { v: (3) };
                test_tick.liquidity_change = Liquidity::from_integer(1);
                let mut f_t_t = RefCell::new(test_tick);
                let mut t = f_t_t.borrow_mut();
                cross_tick(&mut t, &mut test_pool, 18446744073709);
                let result = t.borrow().fee_growth_outside_x;
                assert_eq!(result, FeeGrowth { v: (15) });
                let result = t.borrow().fee_growth_outside_y;
                assert_eq!(result, FeeGrowth { v: (10) });
                let result = t.borrow().seconds_outside;
                assert_eq!(result, 18446744073700);
                let result = t.borrow().seconds_per_liquidity_outside;

                assert_eq!(result, FixedPoint::new(4611686018434499999999997));
                let result = test_pool.liquidity;
                assert_eq!(result, Liquidity { v: (5000000) });
                let result = test_pool.last_timestamp;
                assert_eq!(result, 18446744073709);
            }
            //When pool.current_tick_index isn't higher then tick.index and pool.liquidity is 0
            {
                //test_pool
                test_pool.fee_growth_global_x = FeeGrowth { v: (68) };
                test_pool.fee_growth_global_y = FeeGrowth { v: (59) };
                test_pool.liquidity = Liquidity { v: (0) };
                test_pool.last_timestamp = 9;
                test_pool.start_timestamp = 34;
                test_pool.seconds_per_liquidity_global = FixedPoint { v: (32) };
                test_pool.current_tick_index = 4;
                //test_tick
                test_tick.fee_growth_outside_x = FeeGrowth { v: (42) };
                test_tick.fee_growth_outside_y = FeeGrowth { v: (14) };
                test_tick.index = 9;
                test_tick.seconds_outside = 41;
                test_tick.seconds_per_liquidity_outside = FixedPoint { v: (23) };
                test_tick.liquidity_change = Liquidity { v: (0) };
                let mut f_t_t = RefCell::new(test_tick);
                let mut t = f_t_t.borrow_mut();
                cross_tick(&mut t, &mut test_pool, 1844674407370);
                let result = t.borrow().fee_growth_outside_x;
                assert_eq!(result, FeeGrowth { v: (26) });
                let result = t.borrow().fee_growth_outside_y;
                assert_eq!(result, FeeGrowth { v: (45) });
                let result = t.borrow().seconds_outside;
                assert_eq!(result, 1844674407295);
                let result = t.borrow().seconds_per_liquidity_outside;
                assert_eq!(
                    result,
                    FixedPoint {
                        v: (26352491533728571428571428580)
                    }
                );
                let result = test_pool.liquidity;
                assert_eq!(result, Liquidity { v: (70) });
                let result = test_pool.last_timestamp;
                assert_eq!(result, 1844674407370);
            }
        }
        //underflow
        {
            // tick.fee_growth_outside = fee_growth_global - tick.fee_growth_outside
            {
                {
                    test_tick.fee_growth_outside_x = FeeGrowth { v: (26584) };
                    test_tick.fee_growth_outside_y = FeeGrowth { v: (1256588) };
                    test_pool.fee_growth_global_x = FeeGrowth { v: (3402) };
                    test_pool.fee_growth_global_y = FeeGrowth { v: (3401) };
                    let f_t_t = RefCell::new(test_tick);
                    let mut t = &mut f_t_t.borrow_mut();
                    cross_tick(&mut t, &mut test_pool, 1844674407370953);
                    //let result_x = t.borrow().fee_growth_outside_x;
                    //let result_y = t.borrow().fee_growth_outside_y;
                    let result_x = t.fee_growth_outside_x;
                    let result_y = t.fee_growth_outside_y;
                    assert_eq!(
                        result_x,
                        FeeGrowth {
                            v: (340282366920938463463374607431768188274),
                        }
                    );
                    assert_eq!(
                        result_y,
                        FeeGrowth {
                            v: (340282366920938463463374607431766958269)
                        }
                    );
                }
            }

            //seconds_per_liquidity_outside=seconds_per_liquidity_global-tick.seconds_per_liquidity_outside seconds_per_liquidity_global<tick.seconds_per_liquidity_outside
            {
                test_tick.seconds_per_liquidity_outside = FixedPoint { v: (35) };
                test_pool.seconds_per_liquidity_global = FixedPoint { v: (354) };
                let mut f_t_t = RefCell::new(test_tick);
                let mut t = f_t_t.borrow_mut();
                cross_tick(&mut t, &mut test_pool, 1844674407370953);
                let result = t.borrow().seconds_per_liquidity_outside;
                assert_eq!(result, FixedPoint { v: (319) });
            }
        }

        Ok(())
    }
}
