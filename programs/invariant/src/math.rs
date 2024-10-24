use std::convert::TryInto;

use crate::decimals::*;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::MAX_TICK;
use crate::structs::TICK_LIMIT;
use crate::*;

pub const MAX_SQRT_PRICE: u128 = 65535383934512647000000000000;
pub const MIN_SQRT_PRICE: u128 = 15258932000000000000;

#[derive(PartialEq, Debug)]
pub struct SwapResult {
    pub next_price_sqrt: Price,
    pub amount_in: TokenAmount,
    pub amount_out: TokenAmount,
    pub fee_amount: TokenAmount,
}

// converts ticks to price with reduced precision
pub fn calculate_price_sqrt(tick_index: i32) -> Price {
    // checking if tick be converted to price (overflows if more)
    let tick = tick_index.abs();
    assert!(tick <= MAX_TICK, "tick over bounds");

    let mut price = FixedPoint::from_integer(1);

    if tick & 0x1 != 0 {
        price *= FixedPoint::new(1000049998750);
    }
    if tick & 0x2 != 0 {
        price *= FixedPoint::new(1000100000000);
    }
    if tick & 0x4 != 0 {
        price *= FixedPoint::new(1000200010000);
    }
    if tick & 0x8 != 0 {
        price *= FixedPoint::new(1000400060004);
    }
    if tick & 0x10 != 0 {
        price *= FixedPoint::new(1000800280056);
    }
    if tick & 0x20 != 0 {
        price *= FixedPoint::new(1001601200560);
    }
    if tick & 0x40 != 0 {
        price *= FixedPoint::new(1003204964963);
    }
    if tick & 0x80 != 0 {
        price *= FixedPoint::new(1006420201726);
    }
    if tick & 0x100 != 0 {
        price *= FixedPoint::new(1012881622442);
    }
    if tick & 0x200 != 0 {
        price *= FixedPoint::new(1025929181080);
    }
    if tick & 0x400 != 0 {
        price *= FixedPoint::new(1052530684591);
    }
    if tick & 0x800 != 0 {
        price *= FixedPoint::new(1107820842005);
    }
    if tick & 0x1000 != 0 {
        price *= FixedPoint::new(1227267017980);
    }
    if tick & 0x2000 != 0 {
        price *= FixedPoint::new(1506184333421);
    }
    if tick & 0x4000 != 0 {
        price *= FixedPoint::new(2268591246242);
    }
    if tick & 0x8000 != 0 {
        price *= FixedPoint::new(5146506242525);
    }
    if tick & 0x0001_0000 != 0 {
        price *= FixedPoint::new(26486526504348);
    }
    if tick & 0x0002_0000 != 0 {
        price *= FixedPoint::new(701536086265529);
    }

    // Parsing to the Price type by the end by convention (should always have 12 zeros at the end)
    if tick_index >= 0 {
        Price::from_decimal(price)
    } else {
        Price::from_decimal(FixedPoint::from_integer(1).big_div(price))
    }
}

pub fn compute_swap_step(
    current_price_sqrt: Price,
    target_price_sqrt: Price,
    liquidity: Liquidity,
    amount: TokenAmount,
    by_amount_in: bool,
    fee: FixedPoint,
) -> SwapResult {
    if liquidity.is_zero() {
        return SwapResult {
            next_price_sqrt: target_price_sqrt,
            amount_in: TokenAmount(0),
            amount_out: TokenAmount(0),
            fee_amount: TokenAmount(0),
        };
    }

    let x_to_y = current_price_sqrt >= target_price_sqrt;

    let next_price_sqrt;
    let mut amount_in = TokenAmount(0);
    let mut amount_out = TokenAmount(0);

    if by_amount_in {
        let amount_after_fee = amount.big_mul(FixedPoint::from_integer(1u8) - fee);

        amount_in = if x_to_y {
            get_delta_x(target_price_sqrt, current_price_sqrt, liquidity, true)
        } else {
            get_delta_y(current_price_sqrt, target_price_sqrt, liquidity, true)
        }
        .unwrap_or(TokenAmount(u64::MAX));

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
        }
        .unwrap_or(TokenAmount(u64::MAX));

        if amount >= amount_out {
            next_price_sqrt = target_price_sqrt
        } else {
            next_price_sqrt =
                get_next_sqrt_price_from_output(current_price_sqrt, liquidity, amount, x_to_y)
        }
    }

    let not_max = target_price_sqrt != next_price_sqrt;

    if x_to_y {
        if not_max || !by_amount_in {
            amount_in = get_delta_x(next_price_sqrt, current_price_sqrt, liquidity, true).unwrap()
        };
        if not_max || by_amount_in {
            amount_out = get_delta_y(next_price_sqrt, current_price_sqrt, liquidity, false).unwrap()
        }
    } else {
        if not_max || !by_amount_in {
            amount_in = get_delta_y(current_price_sqrt, next_price_sqrt, liquidity, true).unwrap()
        };
        if not_max || by_amount_in {
            amount_out = get_delta_x(current_price_sqrt, next_price_sqrt, liquidity, false).unwrap()
        }
    }

    // Amount out can not exceed amount
    if !by_amount_in && amount_out > amount {
        amount_out = amount;
    }

    let fee_amount = if by_amount_in && next_price_sqrt != target_price_sqrt {
        amount - amount_in
    } else {
        amount_in.big_mul_up(fee)
    };

    SwapResult {
        next_price_sqrt,
        amount_in,
        amount_out,
        fee_amount,
    }
}

// delta x = (L * delta_sqrt_price) / (lower_sqrt_price * higher_sqrt_price)
pub fn get_delta_x(
    sqrt_price_a: Price,
    sqrt_price_b: Price,
    liquidity: Liquidity,
    up: bool,
) -> Option<TokenAmount> {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    // log(2,  2^16 * 10^24 * 2^128 / 10^6 ) = 203.7
    let nominator = delta_price.big_mul_to_value(liquidity);
    match up {
        true => Price::big_div_values_to_token_up(
            nominator,
            sqrt_price_a.big_mul_to_value(sqrt_price_b),
        ),
        false => Price::big_div_values_to_token(
            nominator,
            sqrt_price_a.big_mul_to_value_up(sqrt_price_b),
        ),
    }
}

// delta y = L * delta_sqrt_price
pub fn get_delta_y(
    sqrt_price_a: Price,
    sqrt_price_b: Price,
    liquidity: Liquidity,
    up: bool,
) -> Option<TokenAmount> {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    match match up {
        true => delta_price
            .big_mul_to_value_up(liquidity)
            .checked_add(Price::almost_one())
            .unwrap()
            .checked_div(Price::one())
            .unwrap()
            .try_into(),
        false => delta_price
            .big_mul_to_value(liquidity)
            .checked_div(Price::one())
            .unwrap()
            .try_into(),
    } {
        Ok(x) => Some(TokenAmount(x)),
        Err(_) => None,
    }
}

fn get_next_sqrt_price_from_input(
    price_sqrt: Price,
    liquidity: Liquidity,
    amount: TokenAmount,
    x_to_y: bool,
) -> Price {
    assert!(!price_sqrt.is_zero());
    assert!(!liquidity.is_zero());

    if x_to_y {
        get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true)
    } else {
        get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true)
    }
}

fn get_next_sqrt_price_from_output(
    price_sqrt: Price,
    liquidity: Liquidity,
    amount: TokenAmount,
    x_to_y: bool,
) -> Price {
    assert!(!price_sqrt.is_zero());
    assert!(!liquidity.is_zero());

    if x_to_y {
        get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false)
    } else {
        get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false)
    }
}

// L * price / (L +- amount * price)
fn get_next_sqrt_price_x_up(
    price_sqrt: Price,
    liquidity: Liquidity,
    amount: TokenAmount,
    add: bool,
) -> Price {
    if amount.is_zero() {
        return price_sqrt;
    };

    let big_liquidity = liquidity
        .here::<U256>()
        .checked_mul(U256::from(PRICE_LIQUIDITY_DENOMINATOR))
        .unwrap();

    let denominator = match add {
        true => big_liquidity.checked_add(price_sqrt.big_mul_to_value(amount)),
        false => big_liquidity.checked_sub(price_sqrt.big_mul_to_value(amount)),
    }
    .unwrap();

    Price::big_div_values_up(price_sqrt.big_mul_to_value_up(liquidity), denominator)
}

// price +- (amount / L)
fn get_next_sqrt_price_y_down(
    price_sqrt: Price,
    liquidity: Liquidity,
    amount: TokenAmount,
    add: bool,
) -> Price {
    if add {
        let quotient = Price::from_decimal(amount).big_div_by_number(
            U256::from(liquidity.get())
                .checked_mul(U256::from(PRICE_LIQUIDITY_DENOMINATOR))
                .unwrap(),
        );
        price_sqrt + quotient
    } else {
        let quotient = Price::from_decimal(amount).big_div_by_number_up(
            U256::from(liquidity.get())
                .checked_mul(U256::from(PRICE_LIQUIDITY_DENOMINATOR))
                .unwrap(),
        );
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
        fee_growth_global_x.unchecked_sub(tick_lower.fee_growth_outside_x)
    };
    let fee_growth_below_y = if current_above_lower {
        tick_lower.fee_growth_outside_y
    } else {
        fee_growth_global_y.unchecked_sub(tick_lower.fee_growth_outside_y)
    };

    // calculate fee growth above
    let fee_growth_above_x = if current_below_upper {
        tick_upper.fee_growth_outside_x
    } else {
        fee_growth_global_x.unchecked_sub(tick_upper.fee_growth_outside_x)
    };
    let fee_growth_above_y = if current_below_upper {
        tick_upper.fee_growth_outside_y
    } else {
        fee_growth_global_y.unchecked_sub(tick_upper.fee_growth_outside_y)
    };

    // calculate fee growth inside
    let fee_growth_inside_x = fee_growth_global_x
        .unchecked_sub(fee_growth_below_x)
        .unchecked_sub(fee_growth_above_x);
    let fee_growth_inside_y = fee_growth_global_y
        .unchecked_sub(fee_growth_below_y)
        .unchecked_sub(fee_growth_above_y);

    (fee_growth_inside_x, fee_growth_inside_y)
}

pub fn calculate_amount_delta(
    pool: &mut Pool,
    liquidity_delta: Liquidity,
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
        )
        .unwrap();
    } else if pool.current_tick_index < upper_tick {
        // calculating price_sqrt of current_tick is not required - can by pass
        amount_x = get_delta_x(
            pool.sqrt_price,
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        )
        .unwrap();
        amount_y = get_delta_y(
            calculate_price_sqrt(lower_tick),
            pool.sqrt_price,
            liquidity_delta,
            liquidity_sign,
        )
        .unwrap();

        pool.update_liquidity_safely(liquidity_delta, liquidity_sign)?;
    } else {
        amount_y = get_delta_y(
            calculate_price_sqrt(lower_tick),
            calculate_price_sqrt(upper_tick),
            liquidity_delta,
            liquidity_sign,
        )
        .unwrap()
    }

    Ok((amount_x, amount_y))
}

pub fn calculate_seconds_per_liquidity_inside(
    tick_lower: Tick,
    tick_upper: Tick,
    pool: &mut Pool,
    current_timestamp: u64,
) -> FixedPoint {
    if !pool.liquidity.is_zero() {
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
        pool.seconds_per_liquidity_global
            .unchecked_sub(tick_lower.seconds_per_liquidity_outside)
    };

    let seconds_per_liquidity_above = if current_below_upper {
        tick_upper.seconds_per_liquidity_outside
    } else {
        pool.seconds_per_liquidity_global
            .unchecked_sub(tick_upper.seconds_per_liquidity_outside)
    };

    pool.seconds_per_liquidity_global
        .unchecked_sub(seconds_per_liquidity_below)
        .unchecked_sub(seconds_per_liquidity_above)
}

pub fn is_enough_amount_to_push_price(
    amount: TokenAmount,
    current_price_sqrt: Price,
    liquidity: Liquidity,
    fee: FixedPoint,
    by_amount_in: bool,
    x_to_y: bool,
) -> bool {
    if liquidity.is_zero() {
        return true;
    }

    let next_price_sqrt = if by_amount_in {
        let amount_after_fee = amount.big_mul(FixedPoint::from_integer(1) - fee);
        get_next_sqrt_price_from_input(current_price_sqrt, liquidity, amount_after_fee, x_to_y)
    } else {
        get_next_sqrt_price_from_output(current_price_sqrt, liquidity, amount, x_to_y)
    };

    current_price_sqrt.ne(&next_price_sqrt)
}

pub fn calculate_max_liquidity_per_tick(tick_spacing: u16) -> Liquidity {
    const MAX_TICKS_AMOUNT_MEMORY_LIMITED: u128 = 2 * TICK_LIMIT as u128;
    const MAX_TICKS_AMOUNT_PRICE_LIMITED: u128 = 2 * MAX_TICK as u128 + 1;
    const MAX_GLOBAL_LIQUIDITY: u128 = u128::MAX;
    const MAX_LIQUIDITY_SIZE_LIMITED: u128 = MAX_GLOBAL_LIQUIDITY / MAX_TICKS_AMOUNT_MEMORY_LIMITED;

    let ticks_amount_spacing_limited = MAX_TICKS_AMOUNT_PRICE_LIMITED
        .checked_div(tick_spacing.try_into().unwrap())
        .unwrap();

    if MAX_TICKS_AMOUNT_MEMORY_LIMITED < ticks_amount_spacing_limited {
        Liquidity::new(MAX_LIQUIDITY_SIZE_LIMITED)
    } else {
        Liquidity::new(
            MAX_GLOBAL_LIQUIDITY
                .checked_div(ticks_amount_spacing_limited)
                .unwrap(),
        )
    }
}

#[cfg(test)]
mod tests {

    use std::str::FromStr;

    use crate::structs::TICK_LIMIT;

    use super::*;

    #[test]
    fn test_swap_step() {
        // one token by amount in
        {
            let price = Price::from_integer(1);
            let target = Price::new(1004987562112089027021926);
            let liquidity = Liquidity::from_integer(2000);
            let amount = TokenAmount(1);
            let fee = FixedPoint::from_scale(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, true, fee);

            let expected_result = SwapResult {
                next_price_sqrt: price,
                amount_in: TokenAmount(0),
                amount_out: TokenAmount(0),
                fee_amount: TokenAmount(1),
            };
            assert_eq!(result, expected_result)
        }
        // amount out capped at target price
        {
            let price = Price::from_integer(1);
            let target = Price::new(1004987562112089027021926);
            let liquidity = Liquidity::from_integer(2000);
            let amount = TokenAmount(20);
            let fee = FixedPoint::from_scale(6, 4);

            let result_in = compute_swap_step(price, target, liquidity, amount, true, fee);
            let result_out = compute_swap_step(price, target, liquidity, amount, false, fee);

            let expected_result = SwapResult {
                next_price_sqrt: target,
                amount_in: TokenAmount(10),
                amount_out: TokenAmount(9),
                fee_amount: TokenAmount(1),
            };
            assert_eq!(result_in, expected_result);
            assert_eq!(result_out, expected_result);
        }
        // amount in not capped
        {
            let price = Price::from_scale(101, 2);
            let target = Price::from_integer(10);
            let liquidity = Liquidity::from_integer(300000000);
            let amount = TokenAmount(1000000);
            let fee = FixedPoint::from_scale(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, true, fee);
            let expected_result = SwapResult {
                next_price_sqrt: Price::new(1013331333333_333333333333),
                amount_in: TokenAmount(999400),
                amount_out: TokenAmount(976487), // ((1.013331333333 - 1.01) * 300000000) / (1.013331333333 * 1.01)
                fee_amount: TokenAmount(600),
            };
            assert_eq!(result, expected_result)
        }
        // amount out not capped
        {
            let price = Price::from_integer(101);
            let target = Price::from_integer(100);
            let liquidity = Liquidity::from_integer(5000000000000u128);
            let amount = TokenAmount(2000000);
            let fee = FixedPoint::from_scale(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, false, fee);
            let expected_result = SwapResult {
                next_price_sqrt: Price::new(100999999600000_000000000000),
                amount_in: TokenAmount(197), // (5000000000000 * (101 - 100.9999996)) /  (101 * 100.9999996)
                amount_out: amount,
                fee_amount: TokenAmount(1),
            };
            assert_eq!(result, expected_result)
        }
        // empty swap step when price is at tick
        {
            let current_price_sqrt = Price::new(999500149965_000000000000);
            let target_price_sqrt = Price::new(999500149965_000000000000);

            let liquidity = Liquidity::new(20006000_000000);
            let amount = TokenAmount(1_000_000);
            let by_amount_in = true;
            let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: current_price_sqrt,
                amount_in: TokenAmount(0),
                amount_out: TokenAmount(0),
                fee_amount: TokenAmount(0),
            };
            assert_eq!(result, expected_result)
        }
        // empty swap step by amount out when price is at tick
        {
            let current_price_sqrt = Price::new(999500149965_000000000000);
            let target_price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::new(u128::MAX / 1_000000);
            let amount = TokenAmount(1);
            let by_amount_in = false;
            let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: Price::new(999500149965_000000000001),
                amount_in: TokenAmount(341),
                amount_out: TokenAmount(1),
                fee_amount: TokenAmount(1),
            };
            assert_eq!(result, expected_result)
        }
        // if liquidity is high, small amount in should not push price
        {
            let current_price_sqrt = Price::from_scale(999500149965u128, 12);
            let target_price_sqrt = Price::from_scale(1999500149965u128, 12);
            let liquidity = Liquidity::from_integer(100_000000000000_000000000000u128);
            let amount = TokenAmount(10);
            let by_amount_in = true;
            let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: current_price_sqrt,
                amount_in: TokenAmount(0),
                amount_out: TokenAmount(0),
                fee_amount: TokenAmount(10),
            };
            assert_eq!(result, expected_result)
        }
        // amount_in > u64 for swap to target price and when liquidity > 2^64
        {
            let current_price_sqrt = Price::from_integer(1);
            let target_price_sqrt = Price::from_scale(100005, 5); // 1.00005
            let liquidity = Liquidity::from_integer(368944000000_000000000000u128);
            let amount = TokenAmount(1);
            let by_amount_in = true;
            let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: current_price_sqrt,
                amount_in: TokenAmount(0),
                amount_out: TokenAmount(0),
                fee_amount: TokenAmount(1),
            };
            assert_eq!(result, expected_result)
        }
        // amount_out > u64 for swap to target price and when liquidity > 2^64
        {
            let current_price_sqrt = Price::from_integer(1);
            let target_price_sqrt = Price::from_scale(100005, 5); // 1.00005
            let liquidity = Liquidity::from_integer(368944000000_000000000000u128);
            let amount = TokenAmount(1);
            let by_amount_in = false;
            let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: Price::new(1_000000000000_000000000003),
                amount_in: TokenAmount(2),
                amount_out: TokenAmount(1),
                fee_amount: TokenAmount(1),
            };
            assert_eq!(result, expected_result)
        }
        // liquidity is zero and by amount_in should skip to target price
        {
            let current_price_sqrt = Price::from_integer(1);
            let target_price_sqrt = Price::from_scale(100005, 5); // 1.00005
            let liquidity = Liquidity::new(0);
            let amount = TokenAmount(100000);
            let by_amount_in = true;
            let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: target_price_sqrt,
                amount_in: TokenAmount(0),
                amount_out: TokenAmount(0),
                fee_amount: TokenAmount(0),
            };
            assert_eq!(result, expected_result)
        }
        // liquidity is zero and by amount_out should skip to target price
        {
            let current_price_sqrt = Price::from_integer(1);
            let target_price_sqrt = Price::from_scale(100005, 5); // 1.00005
            let liquidity = Liquidity::new(0);
            let amount = TokenAmount(100000);
            let by_amount_in = false;
            let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: target_price_sqrt,
                amount_in: TokenAmount(0),
                amount_out: TokenAmount(0),
                fee_amount: TokenAmount(0),
            };
            assert_eq!(result, expected_result)
        }
        // normal swap step but fee is set to 0
        {
            let current_price_sqrt = Price::from_scale(99995, 5); // 0.99995
            let target_price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(50000000);
            let amount = TokenAmount(1000);
            let by_amount_in = true;
            let fee = FixedPoint::new(0);

            let result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                amount,
                by_amount_in,
                fee,
            );
            let expected_result = SwapResult {
                next_price_sqrt: Price::from_scale(99997, 5),
                amount_in: TokenAmount(1000),
                amount_out: TokenAmount(1000),
                fee_amount: TokenAmount(0),
            };
            assert_eq!(result, expected_result)
        }
        // by_amount_out and x_to_y edge cases
        {
            let target_price_sqrt = calculate_price_sqrt(-10);
            let current_price_sqrt = target_price_sqrt + Price::from_integer(1);
            let liquidity = Liquidity::from_integer(340282366920938463463374607u128);
            let one_token = TokenAmount(1);
            let tokens_with_same_output = TokenAmount(85);
            let zero_token = TokenAmount(0);
            let by_amount_in = false;
            let max_fee = FixedPoint::from_scale(9, 1);
            let min_fee = FixedPoint::from_integer(0);

            let one_token_result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                one_token,
                by_amount_in,
                max_fee,
            );
            let tokens_with_same_output_result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                tokens_with_same_output,
                by_amount_in,
                max_fee,
            );
            let zero_token_result = compute_swap_step(
                current_price_sqrt,
                target_price_sqrt,
                liquidity,
                zero_token,
                by_amount_in,
                min_fee,
            );
            /*
                86x -> [1, 85]y
                rounding due to price accuracy
                it does not matter if you want 1 or 85 y tokens, will take you the same input amount
            */
            let expected_one_token_result = SwapResult {
                next_price_sqrt: current_price_sqrt - Price::new(1),
                amount_in: TokenAmount(86),
                amount_out: TokenAmount(1),
                fee_amount: TokenAmount(78),
            };
            let expected_tokens_with_same_output_result = SwapResult {
                next_price_sqrt: current_price_sqrt - Price::new(1),
                amount_in: TokenAmount(86),
                amount_out: TokenAmount(85),
                fee_amount: TokenAmount(78),
            };
            let expected_zero_token_result = SwapResult {
                next_price_sqrt: current_price_sqrt,
                amount_in: TokenAmount(0),
                amount_out: TokenAmount(0),
                fee_amount: TokenAmount(0),
            };
            assert_eq!(one_token_result, expected_one_token_result);
            assert_eq!(
                tokens_with_same_output_result,
                expected_tokens_with_same_output_result
            );
            assert_eq!(zero_token_result, expected_zero_token_result);
        }
    }

    #[test]
    fn test_get_delta_x() {
        // zero at zero liquidity
        {
            let result = get_delta_x(
                Price::from_integer(1u8),
                Price::from_integer(1u8),
                Liquidity::new(0),
                false,
            )
            .unwrap();
            assert_eq!(result, TokenAmount(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_x(
                Price::from_integer(1u8),
                Price::from_integer(2u8),
                Liquidity::from_integer(2u8),
                false,
            )
            .unwrap();
            assert_eq!(result, TokenAmount(1));
        }
        // complex
        {
            let sqrt_price_a = Price::new(234__878_324_943_782_000000000000);
            let sqrt_price_b = Price::new(87__854_456_421_658_000000000000);
            let liquidity = Liquidity::new(983_983__249_092);

            let result_down = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, false).unwrap();
            let result_up = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, true).unwrap();

            // 7010.8199533068819376891841727789301497024557314488455622925765280
            assert_eq!(result_down, TokenAmount(7010));
            assert_eq!(result_up, TokenAmount(7011));
        }
        // big
        {
            let sqrt_price_a = Price::from_integer(1u8);
            let sqrt_price_b = Price::from_scale(5u8, 1);
            let liquidity = Liquidity::from_integer(2u128.pow(64) - 1);

            let result_down = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, false).unwrap();
            let result_up = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, true).unwrap();

            assert_eq!(result_down, TokenAmount::from_decimal(liquidity));
            assert_eq!(result_up, TokenAmount::from_decimal(liquidity));
        }
        // overflow
        {
            let sqrt_price_a = Price::from_integer(1u8);
            let sqrt_price_b = Price::from_scale(5u8, 1);
            let liquidity = Liquidity::from_integer(2u128.pow(64));

            let result_down = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, false);
            let result_up = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, true);

            assert!(result_down.is_none());
            assert!(result_up.is_none());
        }
        // huge liquidity
        {
            let sqrt_price_a = Price::from_integer(1u8);
            let sqrt_price_b = Price::new(Price::one()) + Price::new(1000000);
            let liquidity = Liquidity::from_integer(2u128.pow(80));

            let result_down = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, false);
            let result_up = get_delta_x(sqrt_price_a, sqrt_price_b, liquidity, true);

            assert!(result_down.is_some());
            assert!(result_up.is_some());
        }
    }

    #[test]
    fn test_get_delta_y() {
        // zero at zero liquidity
        {
            let result = get_delta_y(
                Price::from_integer(1),
                Price::from_integer(1),
                Liquidity::new(0),
                false,
            )
            .unwrap();
            assert_eq!(result, TokenAmount(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_y(
                Price::from_integer(1),
                Price::from_integer(2),
                Liquidity::from_integer(2),
                false,
            )
            .unwrap();
            assert_eq!(result, TokenAmount(2));
        }
        // big numbers
        {
            let sqrt_price_a = Price::new(234__878_324_943_782_000000000000);
            let sqrt_price_b = Price::new(87__854_456_421_658_000000000000);
            let liquidity = Liquidity::new(983_983__249_092);

            let result_down = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, false).unwrap();
            let result_up = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, true).unwrap();

            // 144669023.842474597804911408
            assert_eq!(result_down, TokenAmount(144669023));
            assert_eq!(result_up, TokenAmount(144669024));
        }
        // big
        {
            let sqrt_price_a = Price::from_integer(1u8);
            let sqrt_price_b = Price::from_integer(2u8);
            let liquidity = Liquidity::from_integer(2u128.pow(64) - 1);

            let result_down = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, false).unwrap();
            let result_up = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, true).unwrap();

            assert_eq!(result_down, TokenAmount::from_decimal(liquidity));
            assert_eq!(result_up, TokenAmount::from_decimal(liquidity));
        }
        // overflow
        {
            let sqrt_price_a = Price::from_integer(1u8);
            let sqrt_price_b = Price::from_integer(2u8);
            let liquidity = Liquidity::from_integer(2u128.pow(64));

            let result_down = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, false);
            let result_up = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, true);

            assert!(result_down.is_none());
            assert!(result_up.is_none());
        }
        // huge liquidity
        {
            let sqrt_price_a = Price::from_integer(1u8);
            let sqrt_price_b = Price::new(Price::one()) + Price::new(1000000);
            let liquidity = Liquidity::from_integer(2u128.pow(80));

            let result_down = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, false);
            let result_up = get_delta_y(sqrt_price_a, sqrt_price_b, liquidity, true);

            assert!(result_down.is_some());
            assert!(result_up.is_some());
        }
    }

    #[test]
    fn test_calculate_price_sqrt() {
        {
            let price_sqrt = calculate_price_sqrt(20_000);
            // expected 2.718145925979
            // real     2.718145926825...
            assert_eq!(price_sqrt, Price::from_scale(2718145925979u128, 12));
        }
        {
            let price_sqrt = calculate_price_sqrt(200_000);
            // expected 22015.455979766288
            // real     22015.456048527954...
            assert_eq!(price_sqrt, Price::from_scale(22015455979766288u128, 12));
        }
        {
            let price_sqrt = calculate_price_sqrt(-20_000);
            // expected 0.367897834491
            // real     0.36789783437712...
            assert_eq!(price_sqrt, Price::from_scale(367897834491u128, 12));
        }
        {
            let price_sqrt = calculate_price_sqrt(-200_000);
            // expected 0.000045422634
            // real     0.00004542263388...
            assert_eq!(price_sqrt, Price::from_scale(45422634u128, 12))
        }
        {
            let price_sqrt = calculate_price_sqrt(0);
            assert_eq!(price_sqrt, Price::from_integer(1));
        }
        {
            let price_sqrt = calculate_price_sqrt(MAX_TICK);
            // expected 65535.383934512647
            // real     65535.384161610681...
            assert_eq!(price_sqrt, Price::from_scale(65535383934512647u128, 12))
        }
        {
            let price_sqrt = calculate_price_sqrt(-MAX_TICK);
            // expected 0.000015258932
            // real     0.0000152589324...
            assert_eq!(price_sqrt, Price::from_scale(15258932u128, 12))
        }
    }

    #[test]
    fn edge_prices_regression_test() {
        let min_sqrt_price = calculate_price_sqrt(-MAX_TICK);
        let max_sqrt_price = calculate_price_sqrt(MAX_TICK);

        assert_eq!(min_sqrt_price, Price::new(MIN_SQRT_PRICE));
        assert_eq!(max_sqrt_price, Price::new(MAX_SQRT_PRICE));
    }

    #[test]
    fn test_get_next_sqrt_price_x_up() {
        // Add
        {
            let price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(1);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(result, Price::from_scale(5, 1));
        }
        {
            let price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(2);
            let amount = TokenAmount(3);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(result, Price::from_scale(4, 1));
        }
        {
            let price_sqrt = Price::from_integer(2);
            let liquidity = Liquidity::from_integer(3);
            let amount = TokenAmount(5);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Price::new(461538461538461538461539) // rounded up Decimal::from_integer(6).div(Decimal::from_integer(13))
            );
        }
        {
            let price_sqrt = Price::from_integer(24234);
            let liquidity = Liquidity::from_integer(3000);
            let amount = TokenAmount(5000);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Price::new(599985145205615112277488) // rounded up Decimal::from_integer(24234).div(Decimal::from_integer(40391))
            );
        }
        // Subtract
        {
            let price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(2);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Price::from_integer(2));
        }
        {
            let price_sqrt = Price::from_integer(100_000);
            let liquidity = Liquidity::from_integer(500_000_000);
            let amount = TokenAmount(4_000);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Price::from_integer(500_000));
        }
        {
            let price_sqrt = Price::new(3_333333333333333333333333);
            let liquidity = Liquidity::new(222_222222);
            let amount = TokenAmount(37);

            // expected 7.490636713462104974072145
            // real     7.4906367134621049740721443...
            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Price::new(7490636713462104974072145));
        }
    }

    #[test]
    fn test_get_next_sqrt_price_y_down() {
        {
            let price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(1);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(result, Price::from_integer(2));
        }
        {
            let price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(2);
            let amount = TokenAmount(3);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(result, Price::from_scale(25, 1));
        }
        {
            let price_sqrt = Price::from_integer(2);
            let liquidity = Liquidity::from_integer(3);
            let amount = TokenAmount(5);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Price::from_integer(11).big_div(Price::from_integer(3))
            );
        }
        {
            let price_sqrt = Price::from_integer(24234);
            let liquidity = Liquidity::from_integer(3000);
            let amount = TokenAmount(5000);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Price::from_integer(72707).big_div(Price::from_integer(3))
            );
        }
        // bool = false
        {
            let price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(2);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Price::from_scale(5, 1));
        }
        {
            let price_sqrt = Price::from_integer(100_000);
            let liquidity = Liquidity::from_integer(500_000_000);
            let amount = TokenAmount(4_000);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);
            assert_eq!(result, Price::new(99999999992000000_000000000000));
        }
        {
            let price_sqrt = Price::from_integer(3);
            let liquidity = Liquidity::from_integer(222);
            let amount = TokenAmount(37);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            // expected 2.833333333333
            // real     2.999999999999833...
            assert_eq!(result, Price::new(2833333333333_333333333333));
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
        // current tick between lower tick and upper tick
        {
            let mut pool = Pool {
                liquidity: Liquidity::from_integer(0),
                sqrt_price: Price::new(1000140000000_000000000000),
                current_tick_index: 2,
                ..Default::default()
            };

            let liquidity_delta = Liquidity::from_integer(5_000_000);
            let liquidity_sign = true;
            let upper_tick = 3;
            let lower_tick = 0;

            let (x, y) = calculate_amount_delta(
                &mut pool,
                liquidity_delta,
                liquidity_sign,
                upper_tick,
                lower_tick,
            )
            .unwrap();

            assert_eq!(x, TokenAmount(51));
            assert_eq!(y, TokenAmount(700));
        }
        // current tick smaller than lower tick
        {
            let mut pool = Pool {
                liquidity: Liquidity::from_integer(0),
                current_tick_index: 0,
                ..Default::default()
            };

            let liquidity_delta = Liquidity::from_integer(10);
            let liquidity_sign = true;
            let upper_tick = 4;
            let lower_tick = 2;

            let (x, y) = calculate_amount_delta(
                &mut pool,
                liquidity_delta,
                liquidity_sign,
                upper_tick,
                lower_tick,
            )
            .unwrap();

            assert_eq!(x, TokenAmount(1));
            assert_eq!(y, TokenAmount(0));
        }
        // current tick greater than upper tick
        {
            let mut pool = Pool {
                liquidity: Liquidity::from_integer(0),
                current_tick_index: 6,
                ..Default::default()
            };

            let liquidity_delta = Liquidity::from_integer(10);
            let liquidity_sign = true;
            let upper_tick = 4;
            let lower_tick = 2;

            let (x, y) = calculate_amount_delta(
                &mut pool,
                liquidity_delta,
                liquidity_sign,
                upper_tick,
                lower_tick,
            )
            .unwrap();

            assert_eq!(x, TokenAmount(0));
            assert_eq!(y, TokenAmount(1));
        }
    }
    #[test]
    fn test_update_seconds_per_liquidity_global() {
        let mut pool = Pool {
            liquidity: Liquidity::from_integer(1000),
            start_timestamp: 0,
            last_timestamp: 0,
            seconds_per_liquidity_global: FixedPoint::new(0),
            ..Default::default()
        };

        let current_timestamp = 100;
        pool.update_seconds_per_liquidity_global(current_timestamp);
        assert_eq!({ pool.seconds_per_liquidity_global }.get(), 100000000000);
    }
    #[test]
    fn test_calculate_seconds_per_liquidity_inside() {
        let mut tick_lower = Tick {
            index: 0,
            seconds_per_liquidity_outside: FixedPoint::new(3012300000),
            ..Default::default()
        };
        let mut tick_upper = Tick {
            index: 10,
            seconds_per_liquidity_outside: FixedPoint::new(2030400000),
            ..Default::default()
        };
        let mut pool = Pool {
            liquidity: Liquidity::from_integer(1000),
            start_timestamp: 0,
            last_timestamp: 0,
            seconds_per_liquidity_global: FixedPoint::new(0),
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
            assert_eq!(seconds_per_liquidity_inside.get(), 981900000);
        }

        {
            pool.current_tick_index = 0;
            let seconds_per_liquidity_inside = calculate_seconds_per_liquidity_inside(
                tick_lower,
                tick_upper,
                &mut pool,
                current_timestamp,
            );
            assert_eq!(seconds_per_liquidity_inside.get(), 94957300000);
        }

        {
            tick_lower.seconds_per_liquidity_outside = FixedPoint::new(2012333200);
            tick_upper.seconds_per_liquidity_outside = FixedPoint::new(3012333310);
            pool.current_tick_index = 20;
            let seconds_per_liquidity_inside = calculate_seconds_per_liquidity_inside(
                tick_lower,
                tick_upper,
                &mut pool,
                current_timestamp,
            );
            assert_eq!(seconds_per_liquidity_inside.get(), 1000000110);
        }

        {
            tick_lower.seconds_per_liquidity_outside = FixedPoint::new(201233320000);
            tick_upper.seconds_per_liquidity_outside = FixedPoint::new(301233331000);
            pool.current_tick_index = 20;
            let seconds_per_liquidity_inside = calculate_seconds_per_liquidity_inside(
                tick_lower,
                tick_upper,
                &mut pool,
                current_timestamp,
            );
            assert_eq!(seconds_per_liquidity_inside.get(), 100000011000);
        }
        {
            tick_lower.seconds_per_liquidity_outside = FixedPoint::new(201233320000);
            tick_upper.seconds_per_liquidity_outside = FixedPoint::new(301233331000);
            pool.current_tick_index = -20;
            let seconds_per_liquidity_inside = calculate_seconds_per_liquidity_inside(
                tick_lower,
                tick_upper,
                &mut pool,
                current_timestamp,
            );
            assert_eq!(
                seconds_per_liquidity_inside.get(),
                340282366920938463463374607331768200456
            );
        }
    }
    #[test]
    fn test_is_enough_amount_to_push_price() {
        let current_price_sqrt = calculate_price_sqrt(-20); // at -20 tick
        let liquidity = Liquidity::new(20006000000000000000);
        let fee = FixedPoint::from_scale(6, 4); // 0.0006 -> 0.06%

        // -20 crossing tick with 1 token amount by amount in
        {
            let amount = TokenAmount(1);
            let by_amount_in = true;
            let x_to_y = true;

            let result = is_enough_amount_to_push_price(
                amount,
                current_price_sqrt,
                liquidity,
                fee,
                by_amount_in,
                x_to_y,
            );
            assert_eq!(result, false);
        }
        // -20 crossing tick with 1 token amount by amount out
        {
            let amount = TokenAmount(1);
            let by_amount_in = false;
            let x_to_y = true;

            let result = is_enough_amount_to_push_price(
                amount,
                current_price_sqrt,
                liquidity,
                fee,
                by_amount_in,
                x_to_y,
            );
            assert_eq!(result, true);
        }
        // -20 crossing tick with 2 token amount by amount in
        {
            let amount = TokenAmount(2);
            let by_amount_in = true;
            let x_to_y = true;

            let result = is_enough_amount_to_push_price(
                amount,
                current_price_sqrt,
                liquidity,
                fee,
                by_amount_in,
                x_to_y,
            );
            assert_eq!(result, true);
        }
        // zero amount
        {
            let max_liquidity = Liquidity::from_integer(340282366920938463463374607u128);
            let zero_amount = TokenAmount(0);

            let result_by_amount_out_x_to_y = is_enough_amount_to_push_price(
                zero_amount,
                current_price_sqrt,
                max_liquidity,
                fee,
                false,
                true,
            );
            let result_by_amount_out_y_to_x = is_enough_amount_to_push_price(
                zero_amount,
                current_price_sqrt,
                max_liquidity,
                fee,
                false,
                false,
            );
            let result_by_amount_in_x_to_y = is_enough_amount_to_push_price(
                zero_amount,
                current_price_sqrt,
                max_liquidity,
                fee,
                true,
                true,
            );
            let result_by_amount_in_y_to_x = is_enough_amount_to_push_price(
                zero_amount,
                current_price_sqrt,
                max_liquidity,
                fee,
                true,
                false,
            );
            assert_eq!(result_by_amount_out_x_to_y, false);
            assert_eq!(result_by_amount_out_y_to_x, false);
            assert_eq!(result_by_amount_in_x_to_y, false);
            assert_eq!(result_by_amount_in_y_to_x, false);
        }
        // should always be enough amount to cross tick when pool liquidity is zero
        {
            let no_liquidity = Decimal::new(0);
            let amount = TokenAmount(1);
            let by_amount_in = true;
            let x_to_y = true;

            let result = is_enough_amount_to_push_price(
                amount,
                current_price_sqrt,
                no_liquidity,
                fee,
                by_amount_in,
                x_to_y,
            );
            assert_eq!(result, true);
        }
    }

    #[test]
    fn test_calculate_max_liquidity_per_tick() {
        let max_liquidity_per_tick_limited_by_space =
            Liquidity::new(3835118191787693439087713094308090u128);
        // tick_spacing 1 [L_MAX / 88_728]
        {
            let max_l = calculate_max_liquidity_per_tick(1);
            assert_eq!(max_l, max_liquidity_per_tick_limited_by_space);
        };
        // tick_spacing 2 [L_MAX / 88_728]
        {
            let max_l = calculate_max_liquidity_per_tick(2);
            assert_eq!(max_l, max_liquidity_per_tick_limited_by_space);
        }
        // tick_spacing 5 [L_MAX / 88_727]
        {
            let max_l = calculate_max_liquidity_per_tick(5);
            assert_eq!(max_l, Liquidity::new(3835161415588698631345301964810804));
        }
        // tick_spacing 100 [L_MAX / 4436]
        {
            let max_l = calculate_max_liquidity_per_tick(100);
            assert_eq!(max_l, Liquidity::new(76709280189571339824926647302021688));
        }
    }

    #[test]
    fn test_max_liquidity_amount() {
        let liquidity_denominator = U256::from(Liquidity::from_integer(1).get());
        let price_denominator = U256::from(Price::from_integer(1).get());
        let max_token_amount: u64 = (10u128.pow(64) - 1) as u64;
        let max_sqrt_price = calculate_price_sqrt(MAX_TICK);
        let min_tick_spacing_reachable_max_price = (MAX_TICK + TICK_LIMIT - 1) / TICK_LIMIT; // 5
        let almost_max_sqrt_price =
            calculate_price_sqrt(MAX_TICK - min_tick_spacing_reachable_max_price);
        let max_u64 = u64::max_value() as u128;
        let max_u128 = u128::max_value();

        // position range below current price
        // L = y / (sqrt(pu) - sqrt(pl))
        // L is greatest for max token amount and in price difference between position ticks
        // 2^128 > L_MAX * ACCURACY > 2^64
        {
            let max_y: TokenAmount = TokenAmount::new(max_token_amount);
            let upper_sqrt_price = calculate_price_sqrt(0);
            let lower_sqrt_price = calculate_price_sqrt(-1);
            let min_price_diff_between_tick = upper_sqrt_price - lower_sqrt_price;

            // MAX_LIQUIDITY = ~2^79 * 10^6 = ~2^99
            let max_liquidity = U256::from(max_y.get())
                .checked_mul(liquidity_denominator)
                .unwrap()
                .checked_mul(price_denominator)
                .unwrap()
                .checked_div(U256::from(min_price_diff_between_tick.v))
                .unwrap();

            assert!(max_liquidity.as_u128().gt(&max_u64));
            assert!(max_liquidity.as_u128().lt(&max_u128));

            assert_eq!(368962546285911549948015102172u128, max_liquidity.as_u128());

            // delta x (x amount require to fill position)
            // impossible to fully fill position with max liquidity
            // delta x ~ 2^65
            let price_product = lower_sqrt_price.big_mul(upper_sqrt_price);
            let delta_x = max_liquidity
                .checked_mul(U256::from(min_price_diff_between_tick.v))
                .unwrap()
                .checked_div(U256::from(price_product.v))
                .unwrap()
                .checked_div(liquidity_denominator)
                .unwrap();

            assert!(delta_x.gt(&U256::from(u64::MAX)));
            assert_eq!(delta_x, U256::from(18447666387868643759u128));
        }
        // position range above current price
        // L = x * sqrt(pl) * sqrt(pu) / (sqrt(pu) - sqrt(pl))
        // L is greatest for max token amount and in minimal price difference for the highest price
        // 2^128 > L_MAX > 2^64
        // 2^256 > L_MAX * ACCURACY > 2^128
        {
            let product = U256::from(max_sqrt_price.v)
                .checked_mul(U256::from(almost_max_sqrt_price.v))
                .unwrap()
                .checked_mul(liquidity_denominator)
                .unwrap()
                .checked_div(price_denominator)
                .unwrap();
            let diff = U256::from(max_sqrt_price.v)
                .checked_sub(U256::from(almost_max_sqrt_price.v))
                .unwrap();

            //  ~2^29 * 10^6 = ~ 2^49
            let multiplier = product.checked_div(diff).unwrap();

            // ~2^93 * 10^6 = ~2^113
            let max_liquidity = U256::from(max_token_amount)
                .checked_mul(multiplier)
                .unwrap();

            assert!(max_liquidity.lt(&U256::from(u128::MAX)));
            assert_eq!(
                max_liquidity,
                U256::from(4835295146534425838005632517460130u128)
            );

            // delta y (y amount require to fill position)
            // delta y ~ 2^88
            // impossible to fully fill position with max liquidity
            let delta_y = max_liquidity
                .checked_mul(price_denominator)
                .unwrap()
                .checked_div(diff)
                .unwrap()
                .checked_div(liquidity_denominator)
                .unwrap();

            assert!(delta_y.gt(&U256::from(u64::MAX)));
            assert_eq!(delta_y, U256::from(295177416098739345480985970u128));
        }
        // position range below current price
        // L (by x) = x * sqrt(pu) * sqrt(pc)  / (sqrt(pu) - sqrt(pc))
        // L is greatest for max token amount and in minimal price difference for the highest price
        {
            let almost_max_sqrt_price = max_sqrt_price - Price::new(1);

            let product = U256::from(max_sqrt_price.v)
                .checked_mul(U256::from(almost_max_sqrt_price.v))
                .unwrap()
                .checked_mul(liquidity_denominator)
                .unwrap()
                .checked_div(price_denominator)
                .unwrap();
            let diff = U256::from(max_sqrt_price.v)
                .checked_sub(U256::from(almost_max_sqrt_price.v))
                .unwrap();

            // ~2^112 * 10^6 = ~2^131
            let multiplier = product.checked_div(diff).unwrap();

            // ~2^176 * 10^6 = ~2^196
            let max_liquidity = U256::from(max_token_amount)
                .checked_mul(multiplier)
                .unwrap();

            assert!(max_liquidity.gt(&U256::from(u128::MAX)));
            assert!(max_liquidity
                .eq(&U256::from_str("C9F1D0F9A36142B8E4CBC87BC4509E926142668A984E1EB3F").unwrap()));
        }
    }
}
