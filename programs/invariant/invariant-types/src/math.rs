use std::{cell::RefMut, convert::TryInto};

use anchor_lang::*;

use crate::{
    decimals::*,
    errors::InvariantErrorCode,
    structs::{get_search_limit, Pool, Tick, Tickmap, MAX_TICK, TICK_LIMIT},
};

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

            require!(current_tick != index, InvariantErrorCode::LimitReached);

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

pub fn cross_tick(tick: &mut RefMut<Tick>, pool: &mut Pool) -> Result<()> {
    tick.fee_growth_outside_x = pool
        .fee_growth_global_x
        .unchecked_sub(tick.fee_growth_outside_x);
    tick.fee_growth_outside_y = pool
        .fee_growth_global_y
        .unchecked_sub(tick.fee_growth_outside_y);

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

pub fn get_max_sqrt_price(tick_spacing: u16) -> Price {
    let limit_by_space = TICK_LIMIT
        .checked_sub(1)
        .unwrap()
        .checked_mul(tick_spacing.into())
        .unwrap();
    let max_tick = limit_by_space.min(MAX_TICK);
    calculate_price_sqrt(max_tick)
}

pub fn get_min_sqrt_price(tick_spacing: u16) -> Price {
    let limit_by_space = (-TICK_LIMIT)
        .checked_add(1)
        .unwrap()
        .checked_mul(tick_spacing.into())
        .unwrap();
    let min_tick = limit_by_space.max(-MAX_TICK);
    calculate_price_sqrt(min_tick)
}

#[cfg(test)]
mod tests {
    use decimal::Decimal;

    use crate::{
        decimals::Price,
        math::{get_max_sqrt_price, get_min_sqrt_price},
    };

    #[test]
    fn test_price_limitation() {
        let let_max_price = get_max_sqrt_price(1);
        assert_eq!(let_max_price, Price::new(9189293893553000000000000));
        let let_max_price = get_max_sqrt_price(2);
        assert_eq!(let_max_price, Price::new(84443122262186000000000000));
        let let_max_price = get_max_sqrt_price(5);
        assert_eq!(let_max_price, Price::new(65525554855399275000000000000));
        let let_max_price = get_max_sqrt_price(10);
        assert_eq!(let_max_price, Price::new(65535383934512647000000000000));
        let let_max_price = get_max_sqrt_price(100);
        assert_eq!(let_max_price, Price::new(65535383934512647000000000000));

        let let_min_price = get_min_sqrt_price(1);
        assert_eq!(let_min_price, Price::new(108822289458000000000000));
        let let_min_price = get_min_sqrt_price(2);
        assert_eq!(let_min_price, Price::new(11842290682000000000000));
        let let_min_price = get_min_sqrt_price(5);
        assert_eq!(let_min_price, Price::new(15261221000000000000));
        let let_min_price = get_min_sqrt_price(10);
        assert_eq!(let_min_price, Price::new(15258932000000000000));
        let let_min_price = get_min_sqrt_price(100);
        assert_eq!(let_min_price, Price::new(15258932000000000000));
    }
}
