use crate::uint::U256;

use crate::decimal::{Decimal, MulUp};
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::MAX_TICK;
use crate::*;
use anchor_lang::solana_program::clock::UnixTimestamp;

#[derive(PartialEq, Debug)]
pub struct SwapResult {
    pub next_price_sqrt: Decimal,
    pub amount_in: Decimal,
    pub amount_out: Decimal,
    pub fee_amount: Decimal,
}

pub fn calculate_price_sqrt(tick_index: i32) -> Decimal {
    // checking if tick be converted to price (overflows if more)
    let tick = tick_index.abs();
    assert!(tick <= MAX_TICK, "tick over bounds");

    let mut price = Decimal::one();

    if tick & 0x1 != 0 {
        price = price * Decimal::new(1000049998750);
    }
    if tick & 0x2 != 0 {
        price = price * Decimal::new(1000100000000);
    }
    if tick & 0x4 != 0 {
        price = price * Decimal::new(1000200010000);
    }
    if tick & 0x8 != 0 {
        price = price * Decimal::new(1000400060004);
    }
    if tick & 0x10 != 0 {
        price = price * Decimal::new(1000800280056);
    }
    if tick & 0x20 != 0 {
        price = price * Decimal::new(1001601200560);
    }
    if tick & 0x40 != 0 {
        price = price * Decimal::new(1003204964963);
    }
    if tick & 0x80 != 0 {
        price = price * Decimal::new(1006420201726);
    }
    if tick & 0x100 != 0 {
        price = price * Decimal::new(1012881622442);
    }
    if tick & 0x200 != 0 {
        price = price * Decimal::new(1025929181080);
    }
    if tick & 0x400 != 0 {
        price = price * Decimal::new(1052530684591);
    }
    if tick & 0x800 != 0 {
        price = price * Decimal::new(1107820842005);
    }
    if tick & 0x1000 != 0 {
        price = price * Decimal::new(1227267017980);
    }
    if tick & 0x2000 != 0 {
        price = price * Decimal::new(1506184333421);
    }
    if tick & 0x4000 != 0 {
        price = price * Decimal::new(2268591246242);
    }
    if tick & 0x8000 != 0 {
        price = price * Decimal::new(5146506242525);
    }
    if tick & 0x10_000 != 0 {
        price = price * Decimal::new(26486526504348);
    }
    if tick & 0x20_000 != 0 {
        price = price * Decimal::new(701536086265529);
    }

    if tick_index < 0 {
        price = Decimal::new(
            U256::from(Decimal::one().v)
                .checked_mul(U256::from(Decimal::one().v))
                .unwrap()
                .checked_div(U256::from(price.v))
                .unwrap()
                .as_u128(),
        );
    }

    price
}

pub fn compute_swap_step(
    current_price_sqrt: Decimal,
    target_price_sqrt: Decimal,
    liquidity: Decimal,
    amount: Decimal,
    by_amount_in: bool,
    fee: Decimal,
) -> SwapResult {
    let a_to_b = current_price_sqrt >= target_price_sqrt;
    let exact_in = by_amount_in;

    let next_price_sqrt;
    let mut amount_in = Decimal::new(0);
    let mut amount_out = Decimal::new(0);
    let fee_amount;

    if exact_in {
        let amount_after_fee = amount * (Decimal::one() - fee);

        amount_in = if a_to_b {
            get_delta_x(target_price_sqrt, current_price_sqrt, liquidity, true)
        } else {
            get_delta_y(current_price_sqrt, target_price_sqrt, liquidity, true)
        };

        // if target price was hit it will be the next price
        if amount_after_fee >= amount_in {
            next_price_sqrt = target_price_sqrt
        } else {
            next_price_sqrt = get_next_sqrt_price_from_input(
                current_price_sqrt,
                liquidity,
                amount_after_fee,
                a_to_b,
            )
        };
    } else {
        amount_out = if a_to_b {
            get_delta_y(target_price_sqrt, current_price_sqrt, liquidity, false)
        } else {
            get_delta_x(current_price_sqrt, target_price_sqrt, liquidity, false)
        };

        if amount >= amount_out {
            next_price_sqrt = target_price_sqrt
        } else {
            next_price_sqrt =
                get_next_sqrt_price_from_output(current_price_sqrt, liquidity, amount, a_to_b)
        }
    }

    let max = target_price_sqrt == next_price_sqrt;

    if a_to_b {
        amount_in = if max && exact_in {
            amount_in
        } else {
            get_delta_x(next_price_sqrt, current_price_sqrt, liquidity, true)
        };
        amount_out = if max && !exact_in {
            amount_out
        } else {
            get_delta_y(next_price_sqrt, current_price_sqrt, liquidity, false)
        }
    } else {
        amount_in = if max && exact_in {
            amount_in
        } else {
            get_delta_y(current_price_sqrt, next_price_sqrt, liquidity, true)
        };
        amount_out = if max && !exact_in {
            amount_out
        } else {
            get_delta_x(current_price_sqrt, next_price_sqrt, liquidity, false)
        }
    }

    // Amount out can not exceed amount
    if !exact_in && amount_out > amount {
        amount_out = amount;
    }

    if exact_in && next_price_sqrt != target_price_sqrt {
        fee_amount = amount - amount_in
    } else {
        fee_amount = amount_in.mul_up(fee)
    }
    // fee_amount = Decimal::new(0);

    SwapResult {
        next_price_sqrt,
        amount_in,
        amount_out,
        fee_amount,
    }
}

// delta x = (L * delta_sqrt_price) / (lower_sqrt_price * higher_sqrt_price)
pub fn get_delta_x(
    sqrt_price_a: Decimal,
    sqrt_price_b: Decimal,
    liquidity: Decimal,
    up: bool,
) -> Decimal {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    let nominator = liquidity * delta_price;

    match up {
        true => nominator.div_up(sqrt_price_a * sqrt_price_b),
        false => nominator / (sqrt_price_a.mul_up(sqrt_price_b)),
    }
}

// delta y = L * delta_sqrt_price
pub fn get_delta_y(
    sqrt_price_a: Decimal,
    sqrt_price_b: Decimal,
    liquidity: Decimal,
    up: bool,
) -> Decimal {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    match up {
        true => liquidity.mul_up(delta_price),
        false => liquidity * delta_price,
    }
}

fn get_next_sqrt_price_from_input(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: Decimal,
    a_to_b: bool,
) -> Decimal {
    assert!(price_sqrt > Decimal::new(0));
    assert!(liquidity > Decimal::new(0));

    if a_to_b {
        get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true)
    } else {
        get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true)
    }
}

fn get_next_sqrt_price_from_output(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: Decimal,
    a_to_b: bool,
) -> Decimal {
    assert!(price_sqrt > Decimal::new(0));
    assert!(liquidity > Decimal::new(0));

    if a_to_b {
        get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false)
    } else {
        get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false)
    }
}

// tries to do L * price / (L +- amount * price)
// if overflows it should do L / (L / price +- amount)
fn get_next_sqrt_price_x_up(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: Decimal,
    add: bool,
) -> Decimal {
    if amount == Decimal::new(0) {
        return price_sqrt;
    };

    // This can be simplified but I don't want to do it without tests

    let product = amount * price_sqrt;
    if add {
        if product / amount == price_sqrt {
            let denominator = liquidity + product;

            if denominator >= liquidity {
                return liquidity.mul_up(price_sqrt).div_up(denominator);
            }
        }
        return liquidity.div_up((liquidity / price_sqrt) + amount);
    } else {
        // Overflow check, not sure if needed yet
        assert!(product / amount == price_sqrt && liquidity > product);
        return liquidity.mul_up(price_sqrt).div_up(liquidity - product);
    }
}

// price +- (amount / L)
fn get_next_sqrt_price_y_down(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: Decimal,
    add: bool,
) -> Decimal {
    if add {
        price_sqrt + (amount / liquidity)
    } else {
        let quotient = amount.div_up(liquidity);
        assert!(price_sqrt > quotient);
        price_sqrt - quotient
    }
}

pub fn calculate_fee_growth_inside(
    tick_lower: Tick,
    tick_upper: Tick,
    tick_current: i32,
    fee_growth_global_x: Decimal,
    fee_growth_global_y: Decimal,
) -> (Decimal, Decimal) {
    // determine position relative to current tick
    let current_above_lower = tick_current >= tick_lower.index;
    let current_below_upper = tick_current < tick_upper.index;

    // calculate fee growth below
    let fee_growth_below_x = if current_above_lower {
        tick_lower.fee_growth_outside_x
    } else {
        fee_growth_global_x - tick_lower.fee_growth_outside_x
    };
    let fee_growth_below_y = if current_above_lower {
        tick_lower.fee_growth_outside_y
    } else {
        fee_growth_global_y - tick_lower.fee_growth_outside_y
    };

    // calculate fee growth above
    let fee_growth_above_x = if current_below_upper {
        tick_upper.fee_growth_outside_x
    } else {
        fee_growth_global_x - tick_upper.fee_growth_outside_x
    };
    let fee_growth_above_y = if current_below_upper {
        tick_upper.fee_growth_outside_y
    } else {
        fee_growth_global_y - tick_upper.fee_growth_outside_y
    };

    // calculate fee growth inside
    let fee_growth_inside_x = fee_growth_global_x - fee_growth_below_x - fee_growth_above_x;
    let fee_growth_inside_y = fee_growth_global_y - fee_growth_below_y - fee_growth_above_y;

    (fee_growth_inside_x, fee_growth_inside_y)
}

pub fn calculate_seconds_between_ticks(
    tick_lower: Tick,
    tick_upper: Tick,
    tick_current: i32,
    start_timestamp: UnixTimestamp,
    current_timestamp: UnixTimestamp,
) -> u64 {
    let seconds_passed: u64 = (current_timestamp - start_timestamp) as u64;

    let current_above_lower = tick_current >= tick_lower.index;
    let current_below_upper = tick_current < tick_upper.index;

    let seconds_below = if current_above_lower {
        tick_lower.seconds_outside
    } else {
        seconds_passed - tick_lower.seconds_outside
    };

    let seconds_above = if current_below_upper {
        tick_upper.seconds_outside
    } else {
        seconds_passed - tick_upper.seconds_outside
    };

    seconds_passed - seconds_below - seconds_above
}

pub fn calculate_amount_delta(
    pool: &mut Pool,
    liquidity_delta: Decimal,
    liquidity_sign: bool,
    upper_tick: i32,
    lower_tick: i32,
) -> Result<(u64, u64)> {
    // assume that upper_tick > lower_tick
    let mut amount_x = Decimal::new(0);
    let mut amount_y = Decimal::new(0);

    if pool.current_tick_index < lower_tick {
        amount_x = get_delta_x(
            calculate_price_sqrt(lower_tick),
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        );
    } else if pool.current_tick_index < upper_tick {
        // calculating price_sqrt of current_tick is not required - can by pass
        amount_x = get_delta_x(
            pool.sqrt_price,
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        );
        amount_y = get_delta_y(
            calculate_price_sqrt(lower_tick),
            pool.sqrt_price,
            liquidity_delta,
            liquidity_sign,
        );

        pool.update_liquidity_safely(liquidity_delta, liquidity_sign)?;
    } else {
        amount_y = get_delta_y(
            calculate_price_sqrt(lower_tick),
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        )
    }

    // rounding up when depositing, down when withdrawing
    Ok(match liquidity_sign {
        true => (amount_x.to_token_ceil(), amount_y.to_token_ceil()),
        false => (amount_x.to_token_floor(), amount_y.to_token_floor()),
    })
}

pub fn calculate_seconds_per_liquidity_inside(
    tick_lower: Tick,
    tick_upper: Tick,
    pool: &mut Pool,
    current_timestamp: u64,
) -> Decimal {
    if pool.liquidity != Decimal::new(0) {
        pool.update_seconds_per_liquidity_global(current_timestamp);
    } else {
        pool.last_timestamp = current_timestamp;
    }

    let tick_current = pool.current_tick_index;

    let current_above_lower = tick_current >= tick_lower.index;
    let current_below_upper = tick_current < tick_upper.index;

    let seconds_per_liquidity_below = if current_above_lower {
        tick_lower.seconds_per_liquidity_outside
    } else {
        pool.seconds_per_liquidity_global - tick_lower.seconds_per_liquidity_outside
    };

    let seconds_per_liquidity_above = if current_below_upper {
        tick_upper.seconds_per_liquidity_outside
    } else {
        pool.seconds_per_liquidity_global - tick_upper.seconds_per_liquidity_outside
    };

    pool.seconds_per_liquidity_global - seconds_per_liquidity_below - seconds_per_liquidity_above
}

#[cfg(test)]
mod tests {
    use std::ops::Div;

    use super::*;

    #[test]
    fn test_swap_step() {
        // amount in capped at target price
        {
            let price = Decimal::one();
            let target = (Decimal::from_integer(101) / Decimal::from_integer(100)).sqrt();
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::one();
            let fee = Decimal::from_decimal(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, true, fee);
            let expected_result = SwapResult {
                next_price_sqrt: target,
                amount_in: Decimal::new(9975124224),
                amount_out: Decimal::new(9925619579),
                fee_amount: Decimal::new(5985075),
            };
            assert_eq!(result, expected_result)
        }
        // amount out capped at target price
        {
            let price = Decimal::one();
            let target = (Decimal::from_integer(101) / Decimal::from_integer(100)).sqrt();
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::one();
            let fee = Decimal::from_decimal(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, false, fee);
            let expected_result = SwapResult {
                next_price_sqrt: target,
                amount_in: Decimal::new(9975124224),
                amount_out: Decimal::new(9925619579),
                fee_amount: Decimal::new(5985075),
            };
            assert_eq!(result, expected_result)
        }
        // amount in not capped
        {
            let price = Decimal::one();
            let target = Decimal::from_integer(10).sqrt();
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::one();
            let fee = Decimal::from_decimal(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, true, fee);
            let expected_result = SwapResult {
                next_price_sqrt: Decimal::new(1499700000000),
                amount_in: Decimal::new(999400000000),
                amount_out: Decimal::new(666399946655),
                fee_amount: Decimal::new(600000000),
            };
            assert_eq!(result, expected_result)
        }
        // amount out not capped
        {
            let price = Decimal::one();
            let target = Decimal::from_integer(10).sqrt();
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::one();
            let fee = Decimal::from_decimal(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, false, fee);
            let expected_result = SwapResult {
                next_price_sqrt: Decimal::new(2000000000000),
                amount_in: Decimal::new(2000000000000),
                amount_out: Decimal::one(),
                fee_amount: Decimal::new(1200000000),
            };
            assert_eq!(result, expected_result)
        }
        // next tests
        {
            let price = Decimal::new(20282409603651);
            let target = (Decimal::from_integer(101) / Decimal::from_integer(100)).sqrt();
            let liquidity = Decimal::new(1024);
            let amount = Decimal::from_integer(4);
            let fee = Decimal::from_decimal(3, 3);

            let result = compute_swap_step(price, target, liquidity, amount, false, fee);
            let expected_result = SwapResult {
                next_price_sqrt: Decimal::new(1004987562112),
                amount_in: Decimal::new(969),
                amount_out: Decimal::new(19740),
                fee_amount: Decimal::new(3),
            };
            assert_eq!(result, expected_result)
        }
    }

    #[test]
    fn test_get_delta_x() {
        // zero at zero liquidity
        {
            let result = get_delta_x(
                Decimal::from_integer(1),
                Decimal::from_integer(1),
                Decimal::new(0),
                false,
            );
            assert_eq!(result, Decimal::new(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_x(
                Decimal::from_integer(1),
                Decimal::from_integer(2),
                Decimal::from_integer(2),
                false,
            );
            assert_eq!(result, Decimal::from_integer(1));
        }
        {
            let sqrt_price_a = Decimal::from_integer(1);
            let sqrt_price_b = Decimal::from_integer(121) / Decimal::from_integer(100);
            let liquidity = Decimal::one();
            let round_up = false;

            let result = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, round_up);

            assert_eq!(result, Decimal::new(173553719008));
        }
    }

    #[test]
    fn test_get_delta_y() {
        // zero at zero liquidity
        {
            let result = get_delta_y(
                Decimal::from_integer(1),
                Decimal::from_integer(1),
                Decimal::new(0),
                false,
            );
            assert_eq!(result, Decimal::new(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_y(
                Decimal::from_integer(1),
                Decimal::from_integer(2),
                Decimal::from_integer(2),
                false,
            );
            assert_eq!(result, Decimal::from_integer(2));
        }
        // big numbers
        {
            let result = get_delta_y(
                Decimal::new(345_234_676_865),
                Decimal::new(854_456_421_658),
                Decimal::new(974_234_124_246),
                false,
            );
            // expected 496101200585 (if up: true, then real is 496101200586)
            // real     496101200585.428...
            assert_eq!(result, Decimal::new(496101200585));
        }
    }

    #[test]
    fn test_calculate_price_sqrt() {
        {
            let result = calculate_price_sqrt(0);
            assert_eq!(result, Decimal::one());
        }
        {
            // // test every single tick, takes a while
            // let mut prev = Decimal::new(u128::MAX.into());
            // for i in (((-MAX_TICK / 2) + 1)..(MAX_TICK / 2)).rev() {
            //     let result = calculate_price_sqrt(i * 2);
            //     assert!(result != Decimal::new(0));
            //     assert_eq!(result, Decimal::from_decimal(10001, 4).pow(i.into()));
            //     assert!(result < prev);
            //     prev = result;
            // }
        }
        {
            let price_sqrt = calculate_price_sqrt(20_000);
            // expected 2.718145925979
            // real     2.718145926825...
            assert_eq!(price_sqrt, Decimal::new(2718145925979));
        }
        {
            let price_sqrt = calculate_price_sqrt(200_000);
            // expected 22015.455979766288
            // real     22015.456048527954...
            assert_eq!(price_sqrt, Decimal::new(22015455979766288))
        }
        {
            let price_sqrt = calculate_price_sqrt(-20_000);
            // expected 0.367897834491
            // real     0.36789783437712...
            assert_eq!(price_sqrt, Decimal::new(367897834491));
        }
        {
            let price_sqrt = calculate_price_sqrt(-200_000);
            // expected 0.000045422634
            // real     0.00004542263388...
            assert_eq!(price_sqrt, Decimal::new(45422634))
        }
    }

    #[test]
    fn test_get_next_sqrt_price_x_up() {
        // bool = true
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(1);
            let amount = Decimal::from_integer(1);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(1).div(Decimal::from_integer(2))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::from_integer(3);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(2).div(Decimal::from_integer(5))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(2);
            let liquidity = Decimal::from_integer(3);
            let amount = Decimal::from_integer(5);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::new(461538461539) // rounded up Decimal::from_integer(6).div(Decimal::from_integer(13))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(24234);
            let liquidity = Decimal::from_integer(3000);
            let amount = Decimal::from_integer(5000);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::new(599985145206) // rounded up Decimal::from_integer(24234).div(Decimal::from_integer(40391))
            );
        }
        // bool = false
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::from_integer(1);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Decimal::from_integer(2));
        }
        {
            let price_sqrt = Decimal::from_integer(100_000);
            let liquidity = Decimal::from_integer(500_000_000);
            let amount = Decimal::from_integer(4_000);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Decimal::from_integer(500_000));
        }
        {
            let price_sqrt = Decimal::from_integer(3);
            let liquidity = Decimal::new(222);
            let amount = Decimal::new(37);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);
            assert_eq!(result, Decimal::from_integer(6));
        }
    }

    #[test]
    fn test_get_next_sqrt_price_y_down() {
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(1);
            let amount = Decimal::from_integer(1);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(result, Decimal::from_integer(2));
        }
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::from_integer(3);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(5).div(Decimal::from_integer(2))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(2);
            let liquidity = Decimal::from_integer(3);
            let amount = Decimal::from_integer(5);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(11).div(Decimal::from_integer(3))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(24234);
            let liquidity = Decimal::from_integer(3000);
            let amount = Decimal::from_integer(5000);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(72707).div(Decimal::from_integer(3))
            );
        }
        // bool = false
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(2);
            let amount = Decimal::from_integer(1);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            assert_eq!(
                result,
                Decimal::from_integer(1).div(Decimal::from_integer(2))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(100_000);
            let liquidity = Decimal::from_integer(500_000_000);
            let amount = Decimal::from_integer(4_000);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);
            assert_eq!(result, Decimal::new(99999999992000000));
        }
        {
            let price_sqrt = Decimal::from_integer(3);
            let liquidity = Decimal::new(222);
            let amount = Decimal::new(37);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            // expected 2.833333333333
            // real     2.999999999999833...
            assert_eq!(result, Decimal::new(2833333333333));
        }
    }

    #[test]
    fn test_calculate_fee_growth_inside() {
        let fee_growth_global_x = Decimal::from_integer(15);
        let fee_growth_global_y = Decimal::from_integer(15);
        let mut tick_lower = Tick {
            index: -2,
            fee_growth_outside_x: Decimal::new(0),
            fee_growth_outside_y: Decimal::new(0),
            ..Default::default()
        };
        let mut tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: Decimal::from_integer(0),
            fee_growth_outside_y: Decimal::new(0),
            ..Default::default()
        };
        // current tick inside range
        // lower    current     upper
        // |        |           |
        // -2       0           2
        {
            // index and fee global
            let tick_current = 0;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::from_integer(15)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::from_integer(15)); // y fee growth inside
        }
        // current tick below range
        // current  lower       upper
        // |        |           |
        // -4       2           2
        {
            let tick_current = -4;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::new(0)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::new(0)); // y fee growth inside
        }

        // current tick upper range
        // lower    upper       current
        // |        |           |
        // -2       2           4
        {
            let tick_current = 4;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::new(0)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::new(0)); // y fee growth inside
        }

        // subtracts upper tick if below
        tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: Decimal::from_integer(2),
            fee_growth_outside_y: Decimal::from_integer(3),
            ..Default::default()
        };
        // current tick inside range
        // lower    current     upper
        // |        |           |
        // -2       0           2
        {
            let tick_current = 0;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::from_integer(13)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::from_integer(12)); // y fee growth inside
        }

        // subtracts lower tick if above
        tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: Decimal::new(0),
            fee_growth_outside_y: Decimal::new(0),
            ..Default::default()
        };
        tick_lower = Tick {
            index: -2,
            fee_growth_outside_x: Decimal::from_integer(2),
            fee_growth_outside_y: Decimal::from_integer(3),
            ..Default::default()
        };
        // current tick inside range
        // lower    current     upper
        // |        |           |
        // -2       0           2
        {
            let tick_current = 0;
            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(fee_growth_inside.0, Decimal::from_integer(13)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, Decimal::from_integer(12)); // y fee growth inside
        }
    }

    #[test]
    fn test_calculate_amount_delta() {
        // current tick smaller than lower tick
        {
            let mut pool = Pool {
                liquidity: Decimal::from_integer(0),
                current_tick_index: 0,
                ..Default::default()
            };

            let liquidity_delta = Decimal::from_integer(10);
            let liquidity_sign = true;
            let upper_tick = 4;
            let lower_tick = 2;

            let result = calculate_amount_delta(
                &mut pool,
                liquidity_delta,
                liquidity_sign,
                upper_tick,
                lower_tick,
            )
            .unwrap();

            assert_eq!(result.0, 1);
            assert_eq!(result.1, 0);
        }
        // current tick greater than upper tick
        {
            let mut pool = Pool {
                liquidity: Decimal::from_integer(0),
                current_tick_index: 6,
                ..Default::default()
            };

            let liquidity_delta = Decimal::from_integer(10);
            let liquidity_sign = true;
            let upper_tick = 4;
            let lower_tick = 2;

            let result = calculate_amount_delta(
                &mut pool,
                liquidity_delta,
                liquidity_sign,
                upper_tick,
                lower_tick,
            )
            .unwrap();

            assert_eq!(result.0, 0);
            assert_eq!(result.1, 1);
        }
    }
    #[test]
    fn test_update_seconds_per_liquidity_global() {
        let mut pool = Pool {
            liquidity: Decimal::from_integer(1000),
            start_timestamp: 0,
            last_timestamp: 0,
            seconds_per_liquidity_global: Decimal::new(0),
            ..Default::default()
        };

        let current_timestamp = 100;
        pool.update_seconds_per_liquidity_global(current_timestamp);
        assert_eq!(pool.seconds_per_liquidity_global.v, 100000000000);
    }

    #[test]
    fn test_calculate_seconds_between_ticks() {
        let mut tick_lower = Tick {
            index: 0,
            seconds_outside: 25,
            ..Default::default()
        };
        let mut tick_upper = Tick {
            index: 10,
            seconds_outside: 17,
            ..Default::default()
        };
        let start_timestamp = 0;
        let current_timestamp = 100;

        {
            let tick_current = -10;
            let seconds_inside = calculate_seconds_between_ticks(
                tick_lower,
                tick_upper,
                tick_current,
                start_timestamp,
                current_timestamp,
            );
            assert_eq!(seconds_inside, 8);
        }

        {
            let tick_current = 0;
            let seconds_inside = calculate_seconds_between_ticks(
                tick_lower,
                tick_upper,
                tick_current,
                start_timestamp,
                current_timestamp,
            );
            assert_eq!(seconds_inside, 58);
        }

        {
            tick_lower.seconds_outside = 8;
            tick_upper.seconds_outside = 33;

            let tick_current = 20;
            let seconds_inside = calculate_seconds_between_ticks(
                tick_lower,
                tick_upper,
                tick_current,
                start_timestamp,
                current_timestamp,
            );
            assert_eq!(seconds_inside, 25);
        }
    }

    #[test]
    fn test_calculate_seconds_per_liquidity_inside() {
        let mut tick_lower = Tick {
            index: 0,
            seconds_per_liquidity_outside: Decimal::new(3012300000),
            ..Default::default()
        };
        let mut tick_upper = Tick {
            index: 10,
            seconds_per_liquidity_outside: Decimal::new(2030400000),
            ..Default::default()
        };
        let mut pool = Pool {
            liquidity: Decimal::from_integer(1000),
            start_timestamp: 0,
            last_timestamp: 0,
            seconds_per_liquidity_global: Decimal::new(0),
            ..Default::default()
        };
        let current_timestamp = 100;

        {
            pool.current_tick_index = -10;
            let seconds_per_liquidity_inside = calculate_seconds_per_liquidity_inside(
                tick_lower,
                tick_upper,
                &mut pool,
                current_timestamp,
            );
            assert_eq!(seconds_per_liquidity_inside.v, 981900000);
        }

        {
            pool.current_tick_index = 0;
            let seconds_per_liquidity_inside = calculate_seconds_per_liquidity_inside(
                tick_lower,
                tick_upper,
                &mut pool,
                current_timestamp,
            );
            assert_eq!(seconds_per_liquidity_inside.v, 94957300000);
        }

        {
            tick_lower.seconds_per_liquidity_outside = Decimal::new(2012333200);
            tick_upper.seconds_per_liquidity_outside = Decimal::new(3012333310);
            pool.current_tick_index = 20;
            let seconds_per_liquidity_inside = calculate_seconds_per_liquidity_inside(
                tick_lower,
                tick_upper,
                &mut pool,
                current_timestamp,
            );
            assert_eq!(seconds_per_liquidity_inside.v, 1000000110);
        }
    }
}
