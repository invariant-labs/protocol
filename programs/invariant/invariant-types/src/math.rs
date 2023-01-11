use anchor_lang::*;

use crate::{
    decimals::*,
    errors::InvariantErrorCode,
    structs::{get_search_limit, Tickmap, MAX_TICK},
};

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
