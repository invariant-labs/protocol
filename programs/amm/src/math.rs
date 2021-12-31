use crate::structs::FeeGrowth;
use crate::uint::U256;

use crate::decimal::{Decimal, MulUp};
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::MAX_TICK;
use crate::structs::token_amount::TokenAmount;
use crate::*;

#[derive(PartialEq, Debug)]
pub struct SwapResult {
    pub next_price_sqrt: Decimal,
    pub amount_in: TokenAmount,
    pub amount_out: TokenAmount,
    pub fee_amount: TokenAmount,
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
    if tick & 0x0001_0000 != 0 {
        price = price * Decimal::new(26486526504348);
    }
    if tick & 0x0002_0000 != 0 {
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
    amount: TokenAmount,
    by_amount_in: bool,
    fee: Decimal,
) -> SwapResult {
    let x_to_y = current_price_sqrt >= target_price_sqrt;
    let exact_in = by_amount_in;

    let next_price_sqrt;
    let mut amount_in = TokenAmount(0);
    let mut amount_out = TokenAmount(0);
    let fee_amount;

    if exact_in {
        let amount_after_fee = amount.big_mul(Decimal::one() - fee).to_token_floor();

        amount_in = if x_to_y {
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
                x_to_y,
            )
        };
    } else {
        amount_out = if x_to_y {
            get_delta_y(target_price_sqrt, current_price_sqrt, liquidity, false)
        } else {
            get_delta_x(current_price_sqrt, target_price_sqrt, liquidity, false)
        };

        if amount >= amount_out {
            next_price_sqrt = target_price_sqrt
        } else {
            next_price_sqrt =
                get_next_sqrt_price_from_output(current_price_sqrt, liquidity, amount, x_to_y)
        }
    }

    let max = target_price_sqrt == next_price_sqrt;

    if x_to_y {
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
        fee_amount = amount_in.big_mul(fee).to_token_ceil()
    }

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
) -> TokenAmount {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    let nominator = liquidity.big_mul(delta_price);

    match up {
        true => nominator
            .big_div_up(sqrt_price_a * sqrt_price_b)
            .to_token_ceil(),
        false => nominator
            .big_div(sqrt_price_a.mul_up(sqrt_price_b))
            .to_token_floor(),
    }
}

// delta y = L * delta_sqrt_price
pub fn get_delta_y(
    sqrt_price_a: Decimal,
    sqrt_price_b: Decimal,
    liquidity: Decimal,
    up: bool,
) -> TokenAmount {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    match up {
        true => liquidity.big_mul_up(delta_price).to_token_ceil(),
        false => liquidity.big_mul(delta_price).to_token_floor(),
    }
}

fn get_next_sqrt_price_from_input(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: TokenAmount,
    x_to_y: bool,
) -> Decimal {
    assert!(price_sqrt > Decimal::new(0));
    assert!(liquidity > Decimal::new(0));

    if x_to_y {
        get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true)
    } else {
        get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true)
    }
}

fn get_next_sqrt_price_from_output(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: TokenAmount,
    x_to_y: bool,
) -> Decimal {
    assert!(price_sqrt > Decimal::new(0));
    assert!(liquidity > Decimal::new(0));

    if x_to_y {
        get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false)
    } else {
        get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false)
    }
}

// L * price / (L +- amount * price)
fn get_next_sqrt_price_x_up(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: TokenAmount,
    add: bool,
) -> Decimal {
    if amount.is_zero() {
        return price_sqrt;
    };

    let denominator = match add {
        true => liquidity + (amount.big_mul(price_sqrt)),
        false => liquidity - (amount.big_mul(price_sqrt)),
    };

    liquidity.big_mul_up(price_sqrt).big_div_up(denominator)
}

// price +- (amount / L)
fn get_next_sqrt_price_y_down(
    price_sqrt: Decimal,
    liquidity: Decimal,
    amount: TokenAmount,
    add: bool,
) -> Decimal {
    if add {
        price_sqrt + (amount.big_div(liquidity))
    } else {
        let quotient = amount.big_div_up(liquidity);
        assert!(price_sqrt > quotient);
        price_sqrt - quotient
    }
}

pub fn calculate_fee_growth_inside(
    tick_lower: Tick,
    tick_upper: Tick,
    tick_current: i32,
    fee_growth_global_x: FeeGrowth,
    fee_growth_global_y: FeeGrowth,
) -> (FeeGrowth, FeeGrowth) {
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

pub fn calculate_amount_delta(
    pool: &mut Pool,
    liquidity_delta: Decimal,
    liquidity_sign: bool,
    upper_tick: i32,
    lower_tick: i32,
) -> Result<(TokenAmount, TokenAmount)> {
    // assume that upper_tick > lower_tick
    let mut amount_x = TokenAmount(0);
    let mut amount_y = TokenAmount(0);

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

    Ok((amount_x, amount_y))
}

pub fn calculate_seconds_per_liquidity_inside(
    tick_lower: Tick,
    tick_upper: Tick,
    pool: &mut Pool,
    current_timestamp: u64,
) -> Decimal {
    if { pool.liquidity } != Decimal::new(0) {
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
        // // amount in capped at target price
        // {
        //     let price = Decimal::one();
        //     let target = (Decimal::from_integer(101) / Decimal::from_integer(100)).sqrt();
        //     let liquidity = Decimal::from_integer(2);
        //     let amount = TokenAmount(1);
        //     let fee = Decimal::from_decimal(6, 4);

        //     let result = compute_swap_step(price, target, liquidity, amount, true, fee);
        //     let expected_result = SwapResult {
        //         next_price_sqrt: target,
        //         amount_in: Decimal::new(9975124224),
        //         amount_out: Decimal::new(9925619579),
        //         fee_amount: Decimal::new(5985075),
        //     };
        //     assert_eq!(result, expected_result)
        // }
        // // amount out capped at target price
        // {
        //     let price = Decimal::one();
        //     let target = (Decimal::from_integer(101) / Decimal::from_integer(100)).sqrt();
        //     let liquidity = Decimal::from_integer(2);
        //     let amount = TokenAmount(1);
        //     let fee = Decimal::from_decimal(6, 4);

        //     let result = compute_swap_step(price, target, liquidity, amount, false, fee);
        //     let expected_result = SwapResult {
        //         next_price_sqrt: target,
        //         amount_in: Decimal::new(9975124224),
        //         amount_out: Decimal::new(9925619579),
        //         fee_amount: Decimal::new(5985075),
        //     };
        //     assert_eq!(result, expected_result)
        // }
        // // amount in not capped
        // {
        //     let price = Decimal::one();
        //     let target = Decimal::from_integer(10).sqrt();
        //     let liquidity = Decimal::from_integer(2);
        //     let amount = TokenAmount(1);
        //     let fee = Decimal::from_decimal(6, 4);

        //     let result = compute_swap_step(price, target, liquidity, amount, true, fee);
        //     let expected_result = SwapResult {
        //         next_price_sqrt: Decimal::new(1499700000000),
        //         amount_in: Decimal::new(999400000000),
        //         amount_out: Decimal::new(666399946655),
        //         fee_amount: Decimal::new(600000000),
        //     };
        //     assert_eq!(result, expected_result)
        // }
        // // amount out not capped
        // {
        //     let price = Decimal::one();
        //     let target = Decimal::from_integer(10).sqrt();
        //     let liquidity = Decimal::from_integer(2);
        //     let amount = TokenAmount(1);
        //     let fee = Decimal::from_decimal(6, 4);

        //     let result = compute_swap_step(price, target, liquidity, amount, false, fee);
        //     let expected_result = SwapResult {
        //         next_price_sqrt: Decimal::new(2000000000000),
        //         amount_in: Decimal::new(2000000000000),
        //         amount_out: Decimal::one(),
        //         fee_amount: Decimal::new(1200000000),
        //     };
        //     assert_eq!(result, expected_result)
        // }
        // // next tests
        // {
        //     let price = Decimal::new(20282409603651);
        //     let target = (Decimal::from_integer(101) / Decimal::from_integer(100)).sqrt();
        //     let liquidity = Decimal::new(1024);
        //     let amount = TokenAmount(4);
        //     let fee = Decimal::from_decimal(3, 3);

        //     let result = compute_swap_step(price, target, liquidity, amount, false, fee);
        //     let expected_result = SwapResult {
        //         next_price_sqrt: Decimal::new(1004987562112),
        //         amount_in: Decimal::new(969),
        //         amount_out: Decimal::new(19740),
        //         fee_amount: Decimal::new(3),
        //     };
        //     assert_eq!(result, expected_result)
        // }
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
            assert_eq!(result, TokenAmount(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_x(
                Decimal::from_integer(1),
                Decimal::from_integer(2),
                Decimal::from_integer(2),
                false,
            );
            assert_eq!(result, TokenAmount(1));
        }
        // complex
        {
            let sqrt_price_a = Decimal::new(234__878_324_943_782);
            let sqrt_price_b = Decimal::new(87__854_456_421_658);
            let liquidity = Decimal::new(983_983__249_092_300_399);

            let result_down = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, false);
            let result_up = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, true);

            // 7010.8199533090222620342346078676429792113623790285962379282493052
            assert_eq!(result_down, TokenAmount(7010));
            assert_eq!(result_up, TokenAmount(7011));
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
            assert_eq!(result, TokenAmount(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_y(
                Decimal::from_integer(1),
                Decimal::from_integer(2),
                Decimal::from_integer(2),
                false,
            );
            assert_eq!(result, TokenAmount(2));
        }
        // big numbers
        {
            let sqrt_price_a = Decimal::new(234__878_324_943_782);
            let sqrt_price_b = Decimal::new(87__854_456_421_658);
            let liquidity = Decimal::new(983_983__249_092_300_399);

            let result_down = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, false);
            let result_up = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, true);

            // 144669023.842518763627991585527476
            assert_eq!(result_down, TokenAmount(144669023));
            assert_eq!(result_up, TokenAmount(144669024));
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
        // Add
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(1);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(1).div(Decimal::from_integer(2))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(2);
            let amount = TokenAmount(3);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(2).div(Decimal::from_integer(5))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(2);
            let liquidity = Decimal::from_integer(3);
            let amount = TokenAmount(5);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::new(461538461539) // rounded up Decimal::from_integer(6).div(Decimal::from_integer(13))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(24234);
            let liquidity = Decimal::from_integer(3000);
            let amount = TokenAmount(5000);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::new(599985145206) // rounded up Decimal::from_integer(24234).div(Decimal::from_integer(40391))
            );
        }
        // Subtract
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(2);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Decimal::from_integer(2));
        }
        {
            let price_sqrt = Decimal::from_integer(100_000);
            let liquidity = Decimal::from_integer(500_000_000);
            let amount = TokenAmount(4_000);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Decimal::from_integer(500_000));
        }
        // {
        //     let price_sqrt = Decimal::from_integer(3);
        //     let liquidity = Decimal::new(222);
        //     let amount = TokenAmount(37);

        //     let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);
        //     assert_eq!(result, Decimal::from_integer(6));
        // }
    }

    #[test]
    fn test_get_next_sqrt_price_y_down() {
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(1);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(result, Decimal::from_integer(2));
        }
        {
            let price_sqrt = Decimal::from_integer(1);
            let liquidity = Decimal::from_integer(2);
            let amount = TokenAmount(3);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(5).div(Decimal::from_integer(2))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(2);
            let liquidity = Decimal::from_integer(3);
            let amount = TokenAmount(5);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Decimal::from_integer(11).div(Decimal::from_integer(3))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(24234);
            let liquidity = Decimal::from_integer(3000);
            let amount = TokenAmount(5000);

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
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            assert_eq!(
                result,
                Decimal::from_integer(1).div(Decimal::from_integer(2))
            );
        }
        {
            let price_sqrt = Decimal::from_integer(100_000);
            let liquidity = Decimal::from_integer(500_000_000);
            let amount = TokenAmount(4_000);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);
            assert_eq!(result, Decimal::new(99999999992000000));
        }
        {
            let price_sqrt = Decimal::from_integer(3);
            let liquidity = Decimal::from_integer(222);
            let amount = TokenAmount(37);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            // expected 2.833333333333
            // real     2.999999999999833...
            assert_eq!(result, Decimal::new(2833333333333));
        }
    }

    #[test]
    fn test_calculate_fee_growth_inside() {
        let fee_growth_global_x = FeeGrowth::from_integer(15);
        let fee_growth_global_y = FeeGrowth::from_integer(15);
        let mut tick_lower = Tick {
            index: -2,
            fee_growth_outside_x: FeeGrowth::new(0),
            fee_growth_outside_y: FeeGrowth::new(0),
            ..Default::default()
        };
        let mut tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: FeeGrowth::from_integer(0),
            fee_growth_outside_y: FeeGrowth::from_integer(0),
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

            assert_eq!(fee_growth_inside.0, FeeGrowth::from_integer(15)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, FeeGrowth::from_integer(15)); // y fee growth inside
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

            assert_eq!(fee_growth_inside.0, FeeGrowth::new(0)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, FeeGrowth::new(0)); // y fee growth inside
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

            assert_eq!(fee_growth_inside.0, FeeGrowth::new(0)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, FeeGrowth::new(0)); // y fee growth inside
        }

        // subtracts upper tick if below
        tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: FeeGrowth::from_integer(2),
            fee_growth_outside_y: FeeGrowth::from_integer(3),
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

            assert_eq!(fee_growth_inside.0, FeeGrowth::from_integer(13)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, FeeGrowth::from_integer(12)); // y fee growth inside
        }

        // subtracts lower tick if above
        tick_upper = Tick {
            index: 2,
            fee_growth_outside_x: FeeGrowth::new(0),
            fee_growth_outside_y: FeeGrowth::new(0),
            ..Default::default()
        };
        tick_lower = Tick {
            index: -2,
            fee_growth_outside_x: FeeGrowth::from_integer(2),
            fee_growth_outside_y: FeeGrowth::from_integer(3),
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

            assert_eq!(fee_growth_inside.0, FeeGrowth::from_integer(13)); // x fee growth inside
            assert_eq!(fee_growth_inside.1, FeeGrowth::from_integer(12)); // y fee growth inside
        }

        {
            let tick_current = 0;
            let fee_growth_global_x = FeeGrowth::from_integer(20);
            let fee_growth_global_y = FeeGrowth::from_integer(20);
            tick_lower = Tick {
                index: -20,
                fee_growth_outside_x: FeeGrowth::from_integer(20),
                fee_growth_outside_y: FeeGrowth::from_integer(20),
                ..Default::default()
            };
            tick_upper = Tick {
                index: -10,
                fee_growth_outside_x: FeeGrowth::from_integer(15),
                fee_growth_outside_y: FeeGrowth::from_integer(15),
                ..Default::default()
            };

            let fee_growth_inside = calculate_fee_growth_inside(
                tick_lower,
                tick_upper,
                tick_current,
                fee_growth_global_x,
                fee_growth_global_y,
            );

            assert_eq!(
                fee_growth_inside.0,
                FeeGrowth::new(u128::MAX) - FeeGrowth::from_integer(5) + FeeGrowth::new(1)
            );
            assert_eq!(
                fee_growth_inside.1,
                FeeGrowth::new(u128::MAX) - FeeGrowth::from_integer(5) + FeeGrowth::new(1)
            );
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

            assert_eq!(result.0, TokenAmount(1));
            assert_eq!(result.1, TokenAmount(0));
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

            assert_eq!(result.0, TokenAmount(0));
            assert_eq!(result.1, TokenAmount(1));
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
