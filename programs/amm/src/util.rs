use anchor_lang::__private::ErrorCode;
use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use std::cell::RefMut;
use std::io::Write;

use crate::account::{Pool, Tick, Tickmap};
use crate::decimal::Decimal;
use crate::math::calculate_price_sqrt;
use crate::tickmap::TICK_SEARCH_RANGE;
use crate::*;

pub fn check_ticks(tick_lower: i32, tick_upper: i32, tick_spacing: u16) -> Result<()> {
    // Check order
    require!(tick_lower < tick_upper, InvalidTickIndex);

    require!(
        tick_lower.checked_rem(tick_spacing.into()) == Some(0),
        InvalidTickIndex
    );
    require!(
        tick_upper.checked_rem(tick_spacing.into()) == Some(0),
        InvalidTickIndex
    );

    let scaled_lower = tick_lower.checked_div(tick_spacing.into()).unwrap();
    let scaled_upper = tick_upper.checked_div(tick_spacing.into()).unwrap();

    require!(scaled_upper > (-TICK_LIMIT), InvalidTickInterval);
    require!(scaled_lower < TICK_LIMIT, InvalidTickInterval);
    require!(tick_lower > (-MAX_TICK), InvalidTickInterval);
    require!(tick_upper < MAX_TICK, InvalidTickInterval);
    Ok(())
}

// Finds closes initialized tick in direction of trade
// and compares its price to the price limit of the trade
pub fn get_closer_limit(
    sqrt_price_limit: Decimal,
    x_to_y: bool,
    current_tick: i32,
    tick_spacing: u16,
    tickmap: &Tickmap,
) -> (Decimal, Option<(i32, bool)>) {
    let closes_tick_index = if x_to_y {
        tickmap.prev_initialized(current_tick, tick_spacing)
    } else {
        tickmap.next_initialized(current_tick, tick_spacing)
    };

    match closes_tick_index {
        Some(index) => {
            let price = calculate_price_sqrt(index);
            if x_to_y && price > sqrt_price_limit {
                (price, Some((index, true)))
            } else if !x_to_y && price < sqrt_price_limit {
                (price, Some((index, true)))
            } else {
                (sqrt_price_limit, None)
            }
        }
        None => {
            let index = get_search_limit(current_tick, tick_spacing, !x_to_y);
            let price = calculate_price_sqrt(index);

            if x_to_y && price > sqrt_price_limit {
                (price, Some((index, false)))
            } else if !x_to_y && price < sqrt_price_limit {
                (price, Some((index, false)))
            } else {
                (sqrt_price_limit, None)
            }
        }
    }
}

pub fn cross_tick(tick: &mut RefMut<Tick>, pool: &mut Pool) {
    tick.fee_growth_outside_x = pool.fee_growth_global_x - tick.fee_growth_outside_x;
    tick.fee_growth_outside_y = pool.fee_growth_global_y - tick.fee_growth_outside_y;

    // When going to higher tick net_liquidity should be added and for going lower subtracted
    if (pool.current_tick_index >= tick.index) ^ tick.sign {
        pool.liquidity = pool.liquidity + tick.liquidity_change;
    } else {
        pool.liquidity = pool.liquidity - tick.liquidity_change;
    }
}

pub fn get_tick_from_price(
    current_tick: i32,
    tick_spacing: u16,
    price: Decimal,
    x_to_y: bool,
) -> i32 {
    assert!(
        current_tick.checked_rem(tick_spacing.into()).unwrap() == 0,
        "tick not divisible by spacing"
    );

    if x_to_y {
        price_to_tick_in_range(
            price,
            (-TICK_LIMIT).max(current_tick.checked_sub(TICK_SEARCH_RANGE).unwrap()),
            current_tick,
            tick_spacing.into(),
        )
    } else {
        price_to_tick_in_range(
            price,
            current_tick,
            TICK_LIMIT.min(current_tick.checked_add(TICK_SEARCH_RANGE).unwrap()),
            tick_spacing.into(),
        )
    }
}

pub fn price_to_tick_in_range(price: Decimal, low: i32, high: i32, step: i32) -> i32 {
    let mut low = low.checked_div(step).unwrap();
    let mut high = high.checked_div(step).unwrap().checked_add(1).unwrap();
    let target_value = price;

    while high.checked_sub(low).unwrap() > 1 {
        let mid = ((high.checked_sub(low).unwrap()).checked_div(2).unwrap())
            .checked_add(low)
            .unwrap();
        let val = calculate_price_sqrt(mid.checked_mul(step).unwrap());

        if val == target_value {
            return mid.checked_mul(step).unwrap();
        }

        if val < target_value {
            low = mid;
        }
        let a = 100u128;

        if val > target_value {
            high = mid;
        }
    }
    low.checked_mul(step).unwrap()
}
pub const fn log10(mut val: u128) -> u32 {
    let mut log = 0;
    if val >= 100_000_000_000_000_000_000_000_000_000_000 {
        val /= 100_000_000_000_000_000_000_000_000_000_000;
        log += 32;
        return log + less_than_8(val as u32);
    }
    if val >= 10_000_000_000_000_000 {
        val /= 10_000_000_000_000_000;
        log += 16;
    }
    log + less_than_16(val as u64)
}
const fn less_than_16(mut val: u64) -> u32 {
    let mut log = 0;
    if val >= 100_000_000 {
        val /= 100_000_000;
        log += 8;
    }
    log + less_than_8(val as u32)
}
const fn less_than_8(mut val: u32) -> u32 {
    let mut log = 0;
    if val >= 10_000 {
        val /= 10_000;
        log += 4;
    }
    log + if val >= 1000 {
        3
    } else if val >= 100 {
        2
    } else if val >= 10 {
        1
    } else {
        0
    }
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
    fn test_log10() {
        use std::time::Instant;
        let now = Instant::now();
        let target_tick = 4;
        let DENOMINATOR: u128 = 10u128.pow(12 as u32);

        let x_decimal = calculate_price_sqrt(target_tick);
        let x = x_decimal.v as f64 / DENOMINATOR as f64;
        let log0001 = 0.00004342727;
        println!("1.0001 {:?}", x.powf(2.0).log(1.0001));
        let t = log10((x.powf(2.0) * DENOMINATOR as f64) as u128);
        println!("t {:?}", t);
        println!("1.0001 {:?}", t as f64 / log0001);
        // let a = x.powf(2.0).log(1.0001).ceil() as u128;
        // println!("x_decimal {:?}", x_decimal);
        // println!("x {}", x);
        // println!("(x as f64 + 1f64).ln() {}", (x as f64 + 1f64).ln());
        // println!("x {}", a);
        let fl = 1.232f64;

        // let result = price_to_tick_in_range(x_decimal, 0, 8, 2);

        // println!("{}", result);
        // let b = log10(c);
        // let a = calculate_price_sqrt(target_tick).v;
        // let b = log10(a);
        // println!("{}", b);
        // let elapsed = now.elapsed();
        // println!("Elapsed: {:.2?}", elapsed);
    }
    #[test]
    fn test_ln() {
        // Exact
        {
            use std::time::Instant;
            let now = Instant::now();
            let mut a = 100;
            let target_tick = 22;
            let DENOMINATOR: u128 = 10u128.pow(12 as u32);

            let price = calculate_price_sqrt(target_tick).v as f64 / DENOMINATOR as f64;
            println!("{}", price);

            while a > 0 {
                let p2 = price * price;
                a -= 1;
                p2.log(1.0001).ceil() as u128;
            }
            let p2 = price * price;
            let result = p2.log(1.0001).abs().ceil() as u128;

            println!("{}", result);
            let elapsed = now.elapsed();
            println!("Elapsed: {:.2?}", elapsed);
        }
    }
    #[test]
    fn test_ln_full() {
        // Exact
        {
            let mut a = -MAX_TICK;
            let DENOMINATOR: u128 = 10u128.pow(12 as u32);

            while a < MAX_TICK {
                let target_tick = a;
                let price = calculate_price_sqrt(target_tick).v as f64 / DENOMINATOR as f64;
                let p2 = price * price;
                let r = p2.log(1.0001);
                let result = match r > 0.0 {
                    true => r.ceil() as i32,
                    false => -r.abs().floor() as i32,
                };
                println!("{}", result);
                a += 1;
                assert_eq!(result, target_tick);
            }
        }
    }
    #[test]
    fn test_price_to_tick_in_range() {
        // Exact
        {
            use std::time::Instant;
            let now = Instant::now();
            let mut a = 100_000_0;
            let target_tick = 20000;

            while a > 0 {
                a -= 1;
                price_to_tick_in_range(calculate_price_sqrt(target_tick), 19990, 20020, 10);
            }
            let result =
                price_to_tick_in_range(calculate_price_sqrt(target_tick), 19990, 20020, 10);

            println!("{}", result);
            let elapsed = now.elapsed();
            println!("Elapsed: {:.2?}", elapsed);
            assert_eq!(result, target_tick);
        }
        // // Between
        // {
        //     let target_tick = 4;
        //     let target_price = calculate_price_sqrt(target_tick) + Decimal::new(1);
        //     let result = price_to_tick_in_range(target_price, 0, 8, 2);
        //     assert_eq!(result, target_tick);
        // }
        // // Big step
        // {
        //     let target_tick = 50;
        //     let target_price = calculate_price_sqrt(target_tick) + Decimal::new(1);
        //     let result = price_to_tick_in_range(target_price, 0, 200, 50);
        //     assert_eq!(result, target_tick);
        // }
        // // Big range
        // {
        //     let target_tick = 1234;
        //     let target_price = calculate_price_sqrt(target_tick);
        //     let result = price_to_tick_in_range(target_price, 0, 100_000, 2);
        //     assert_eq!(result, target_tick);
        // }
        // // Negative
        // {
        //     let target_tick = -50;
        //     let target_price = calculate_price_sqrt(target_tick) + Decimal::new(1);
        //     let result = price_to_tick_in_range(target_price, -200, 100, 2);
        //     assert_eq!(result, target_tick);
        // }
    }

    #[test]
    fn test_get_closer_limit() {
        let tickmap = &mut Tickmap::default();
        tickmap.set(true, 0, 1);

        // tick limit closer
        {
            let (result, from_tick) =
                get_closer_limit(Decimal::from_integer(5), true, 100, 1, tickmap);

            let expected = Decimal::from_integer(5);
            assert_eq!(result, expected);
            assert_eq!(from_tick, None);
        }
        // trade limit closer
        {
            let (result, from_tick) =
                get_closer_limit(Decimal::from_decimal(1, 1), true, 100, 1, tickmap);
            let expected = Decimal::from_integer(1);
            assert_eq!(result, expected);
            assert_eq!(from_tick, Some((0, true)));
        }
        // other direction
        {
            let (result, from_tick) =
                get_closer_limit(Decimal::from_integer(2), false, -5, 1, tickmap);
            let expected = Decimal::from_integer(1);
            assert_eq!(result, expected);
            assert_eq!(from_tick, Some((0, true)));
        }
        // other direction
        {
            let (result, from_tick) =
                get_closer_limit(Decimal::from_decimal(1, 1), false, -100, 10, tickmap);
            let expected = Decimal::from_decimal(1, 1);
            assert_eq!(result, expected);
            assert_eq!(from_tick, None);
        }
    }
}
