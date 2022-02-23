use crate::decimals::*;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::MAX_TICK;
use crate::uint::U256;
use crate::*;

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
        price = price * FixedPoint::new(1000049998750);
    }
    if tick & 0x2 != 0 {
        price = price * FixedPoint::new(1000100000000);
    }
    if tick & 0x4 != 0 {
        price = price * FixedPoint::new(1000200010000);
    }
    if tick & 0x8 != 0 {
        price = price * FixedPoint::new(1000400060004);
    }
    if tick & 0x10 != 0 {
        price = price * FixedPoint::new(1000800280056);
    }
    if tick & 0x20 != 0 {
        price = price * FixedPoint::new(1001601200560);
    }
    if tick & 0x40 != 0 {
        price = price * FixedPoint::new(1003204964963);
    }
    if tick & 0x80 != 0 {
        price = price * FixedPoint::new(1006420201726);
    }
    if tick & 0x100 != 0 {
        price = price * FixedPoint::new(1012881622442);
    }
    if tick & 0x200 != 0 {
        price = price * FixedPoint::new(1025929181080);
    }
    if tick & 0x400 != 0 {
        price = price * FixedPoint::new(1052530684591);
    }
    if tick & 0x800 != 0 {
        price = price * FixedPoint::new(1107820842005);
    }
    if tick & 0x1000 != 0 {
        price = price * FixedPoint::new(1227267017980);
    }
    if tick & 0x2000 != 0 {
        price = price * FixedPoint::new(1506184333421);
    }
    if tick & 0x4000 != 0 {
        price = price * FixedPoint::new(2268591246242);
    }
    if tick & 0x8000 != 0 {
        price = price * FixedPoint::new(5146506242525);
    }
    if tick & 0x0001_0000 != 0 {
        price = price * FixedPoint::new(26486526504348);
    }
    if tick & 0x0002_0000 != 0 {
        price = price * FixedPoint::new(701536086265529);
    }

    if tick_index < 0 {
        price = FixedPoint::new(
            U256::from(FixedPoint::from_integer(1).v)
                .checked_mul(U256::from(FixedPoint::from_integer(1).v))
                .unwrap()
                .checked_div(U256::from(price.v))
                .unwrap()
                .as_u128(),
        );
    }

    Price::from_decimal(price)
}

pub fn compute_swap_step(
    current_price_sqrt: Price,
    target_price_sqrt: Price,
    liquidity: Liquidity,
    amount: TokenAmount,
    by_amount_in: bool,
    fee: FixedPoint,
) -> SwapResult {
    let x_to_y = current_price_sqrt >= target_price_sqrt;

    let next_price_sqrt;
    let mut amount_in = TokenAmount(0);
    let mut amount_out = TokenAmount(0);

    if by_amount_in {
        let amount_after_fee = amount.big_mul(FixedPoint::from_integer(1) - fee);

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

    let not_max = target_price_sqrt != next_price_sqrt;

    if x_to_y {
        if not_max || !by_amount_in {
            amount_in = get_delta_x(next_price_sqrt, current_price_sqrt, liquidity, true)
        };
        if not_max || by_amount_in {
            amount_out = get_delta_y(next_price_sqrt, current_price_sqrt, liquidity, false)
        }
    } else {
        if not_max || !by_amount_in {
            amount_in = get_delta_y(current_price_sqrt, next_price_sqrt, liquidity, true)
        };
        if not_max || by_amount_in {
            amount_out = get_delta_x(current_price_sqrt, next_price_sqrt, liquidity, false)
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
) -> TokenAmount {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    let nominator = delta_price.big_mul(liquidity);

    // TODO this will overflow but want to make it compile before fixing
    match up {
        true => TokenAmount::from_decimal_up(nominator.big_div_up(sqrt_price_a * sqrt_price_b)),
        false => TokenAmount::from_decimal(nominator.big_div(sqrt_price_a.mul_up(sqrt_price_b))),
    }
}

// delta y = L * delta_sqrt_price
pub fn get_delta_y(
    sqrt_price_a: Price,
    sqrt_price_b: Price,
    liquidity: Liquidity,
    up: bool,
) -> TokenAmount {
    let delta_price = if sqrt_price_a > sqrt_price_b {
        sqrt_price_a - sqrt_price_b
    } else {
        sqrt_price_b - sqrt_price_a
    };

    match up {
        true => TokenAmount::from_decimal_up(delta_price.big_mul_up(liquidity)),
        false => TokenAmount::from_decimal(delta_price.big_mul(liquidity)),
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

    let denominator = match add {
        true => liquidity + Liquidity::from_decimal(price_sqrt.big_mul(amount)),
        false => liquidity - Liquidity::from_decimal(price_sqrt.big_mul(amount)),
    };

    price_sqrt.big_mul_up(liquidity).big_div_up(denominator)
}

// price +- (amount / L),
fn get_next_sqrt_price_y_down(
    price_sqrt: Price,
    liquidity: Liquidity,
    amount: TokenAmount,
    add: bool,
) -> Price {
    if add {
        price_sqrt + Price::from_decimal(amount.big_div(liquidity))
    } else {
        let quotient = Price::from_decimal(amount.big_div_up(liquidity));
        assert!(!quotient.is_zero());
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
    let fee_growth_inside_x = FeeGrowth::new(
        fee_growth_global_x.get() - fee_growth_below_x.get() - fee_growth_above_x.get(),
    );
    let fee_growth_inside_y = FeeGrowth::new(
        fee_growth_global_y.get() - fee_growth_below_y.get() - fee_growth_above_y.get(),
    );

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
        pool.seconds_per_liquidity_global - tick_lower.seconds_per_liquidity_outside
    };

    let seconds_per_liquidity_above = if current_below_upper {
        tick_upper.seconds_per_liquidity_outside
    } else {
        pool.seconds_per_liquidity_global - tick_upper.seconds_per_liquidity_outside
    };

    pool.seconds_per_liquidity_global - seconds_per_liquidity_below - seconds_per_liquidity_above
}

pub fn is_enough_amount_to_push_price(
    amount: TokenAmount,
    current_price_sqrt: Price,
    liquidity: Liquidity,
    fee: FixedPoint,
    by_amount_in: bool,
    x_to_y: bool,
) -> bool {
    let next_price_sqrt = if by_amount_in {
        let amount_after_fee = amount.big_mul(FixedPoint::from_integer(1) - fee);
        get_next_sqrt_price_from_input(current_price_sqrt, liquidity, amount_after_fee, x_to_y)
    } else {
        get_next_sqrt_price_from_output(current_price_sqrt, liquidity, amount, x_to_y)
    };

    current_price_sqrt.ne(&next_price_sqrt)
}

#[cfg(test)]
mod tests {
    use std::ops::Div;

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
            let price = Price::from_integer(101) / Price::from_integer(100);
            let target = Price::from_integer(10);
            let liquidity = Liquidity::from_integer(300000000);
            let amount = TokenAmount(1000000);
            let fee = FixedPoint::from_scale(6, 4);

            let result = compute_swap_step(price, target, liquidity, amount, true, fee);
            let expected_result = SwapResult {
                next_price_sqrt: Price::new(1013331333333),
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
                next_price_sqrt: Price::new(100999999600000),
                amount_in: TokenAmount(197), // (5000000000000 * (101 - 100.9999996)) /  (101 * 100.9999996)
                amount_out: amount,
                fee_amount: TokenAmount(1),
            };
            assert_eq!(result, expected_result)
        }
        // empty swap step when price is at tick
        {
            let current_price_sqrt = Price::new(999500149965);
            let target_price_sqrt = Price::new(999500149965);
            let liquidity = Liquidity::new(20006000000000000000);
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
    }

    #[test]
    fn test_get_delta_x() {
        // zero at zero liquidity
        {
            let result = get_delta_x(
                Price::from_integer(1),
                Price::from_integer(1),
                Liquidity::new(0),
                false,
            );
            assert_eq!(result, TokenAmount(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_x(
                Price::from_integer(1),
                Price::from_integer(2),
                Liquidity::from_integer(2),
                false,
            );
            assert_eq!(result, TokenAmount(1));
        }
        // complex
        {
            let sqrt_price_a = Price::new(234__878_324_943_782);
            let sqrt_price_b = Price::new(87__854_456_421_658);
            let liquidity = Liquidity::new(983_983__249_092_300_399);

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
                Price::from_integer(1),
                Price::from_integer(1),
                Liquidity::new(0),
                false,
            );
            assert_eq!(result, TokenAmount(0));
        }
        // equal at equal liquidity
        {
            let result = get_delta_y(
                Price::from_integer(1),
                Price::from_integer(2),
                Liquidity::from_integer(2),
                false,
            );
            assert_eq!(result, TokenAmount(2));
        }
        // big numbers
        {
            let sqrt_price_a = Price::new(234__878_324_943_782);
            let sqrt_price_b = Price::new(87__854_456_421_658);
            let liquidity = Liquidity::new(983_983__249_092_300_399);

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
            assert_eq!(result, Price::from_integer(1));
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

            // TODO will need more precision
            assert_eq!(
                result,
                Price::new(461538461539) // rounded up Decimal::from_integer(6).div(Decimal::from_integer(13))
            );
        }
        {
            let price_sqrt = Price::from_integer(24234);
            let liquidity = Liquidity::from_integer(3000);
            let amount = TokenAmount(5000);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Price::new(599985145206) // rounded up Decimal::from_integer(24234).div(Decimal::from_integer(40391))
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
            let price_sqrt = Price::new(3_333333333333);
            let liquidity = Liquidity::new(222_222222222222);
            let amount = TokenAmount(37);

            let result = get_next_sqrt_price_x_up(price_sqrt, liquidity, amount, false);
            // TODO: will need more precision
            assert_eq!(result, Price::new(7_490636704119));
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

            assert_eq!(result, Price::from_integer(11).div(Price::from_integer(3)));
        }
        {
            let price_sqrt = Price::from_integer(24234);
            let liquidity = Liquidity::from_integer(3000);
            let amount = TokenAmount(5000);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, true);

            assert_eq!(
                result,
                Price::from_integer(72707).div(Price::from_integer(3))
            );
        }
        // bool = false
        {
            let price_sqrt = Price::from_integer(1);
            let liquidity = Liquidity::from_integer(2);
            let amount = TokenAmount(1);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            assert_eq!(result, Price::from_scale(1, 2));
        }
        {
            let price_sqrt = Price::from_integer(100_000);
            let liquidity = Liquidity::from_integer(500_000_000);
            let amount = TokenAmount(4_000);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);
            assert_eq!(result, Price::new(99999999992000000));
        }
        {
            let price_sqrt = Price::from_integer(3);
            let liquidity = Liquidity::from_integer(222);
            let amount = TokenAmount(37);

            let result = get_next_sqrt_price_y_down(price_sqrt, liquidity, amount, false);

            // expected 2.833333333333
            // real     2.999999999999833...
            assert_eq!(result, Price::new(2833333333333));
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
                sqrt_price: Price::new(1000140000000),
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
        // // current tick smaller than lower tick
        // {
        //     let mut pool = Pool {
        //         liquidity: Liquidity::from_integer(0),
        //         current_tick_index: 0,
        //         ..Default::default()
        //     };

        //     let liquidity_delta = Liquidity::from_integer(10);
        //     let liquidity_sign = true;
        //     let upper_tick = 4;
        //     let lower_tick = 2;

        //     let (x, y) = calculate_amount_delta(
        //         &mut pool,
        //         liquidity_delta,
        //         liquidity_sign,
        //         upper_tick,
        //         lower_tick,
        //     )
        //     .unwrap();

        //     assert_eq!(x, TokenAmount(1));
        //     assert_eq!(y, TokenAmount(0));
        // }
        // // current tick greater than upper tick
        // {
        //     let mut pool = Pool {
        //         liquidity: Liquidity::from_integer(0),
        //         current_tick_index: 6,
        //         ..Default::default()
        //     };

        //     let liquidity_delta = Liquidity::from_integer(10);
        //     let liquidity_sign = true;
        //     let upper_tick = 4;
        //     let lower_tick = 2;

        //     let (x, y) = calculate_amount_delta(
        //         &mut pool,
        //         liquidity_delta,
        //         liquidity_sign,
        //         upper_tick,
        //         lower_tick,
        //     )
        //     .unwrap();

        //     assert_eq!(x, TokenAmount(0));
        //     assert_eq!(y, TokenAmount(1));
        // }
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
        assert_eq!(pool.seconds_per_liquidity_global.v, 100000000000);
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
            tick_lower.seconds_per_liquidity_outside = FixedPoint::new(2012333200);
            tick_upper.seconds_per_liquidity_outside = FixedPoint::new(3012333310);
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
    #[test]
    fn test_is_enough_amount_to_push_price() {
        let current_price_sqrt = Price::new(999500149965); // at -20 tick
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
    }
}
