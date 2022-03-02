---
title: Math

slug: /invariant_bonds/math
---

The Bonds, are price mechanisms that tries to sell tokens at a predetermined rate over a specified period of time.
Assume a Seller wishes to sell one token in exchange for a
another one. BondSale is launched by the seller, who configures ﬁve variables:

- `bond amount`,
- `floor price`,
- `sale time`,
- `up bound`,
- and `velocity`.

|               |
| ------------- | ---------------------------------------------------------------------------------------- |
| `bond_amount` | The amount of tokens that the Seller wishes to sell. of token which Seller want to sale. |
| `floor_price` | Minimal (and starting) price of a selling token.                                         |
| `sale_time`   | BondSale exists at this time.                                                            |
| `up_bound`    | Defines the percentage difference between ceil price and floor price.                    |
| `velocity`    | Defines how quickly prices fall over time.                                               |

For each trade, we call the function

```rust title="/src/math.rs"
pub fn calculate_new_price(
    bond_sale: &mut BondSale,
    current_time: u64,
    buy_amount: TokenAmount,
) -> Decimal {
    let delta_time = current_time - bond_sale.last_trade;
    let sale_time = bond_sale.end_time - bond_sale.start_time;
    let time_ratio = Decimal::from_integer(delta_time.try_into().unwrap())
        / Decimal::from_integer(sale_time.try_into().unwrap());

    let delta_price = bond_sale.velocity * bond_sale.up_bound * bond_sale.floor_price * time_ratio;
    let supply_ratio = buy_amount.percent(bond_sale.bond_amount);

    let price = match { bond_sale.previous_price } < { bond_sale.floor_price + delta_price } {
        true => bond_sale.floor_price,
        false => bond_sale.previous_price - delta_price,
    };
    let jump = supply_ratio * bond_sale.up_bound * bond_sale.floor_price;

    bond_sale.previous_price = price + jump;
    bond_sale.remaining_amount = bond_sale.remaining_amount - buy_amount;
    bond_sale.last_trade = current_time;

    price + Decimal::from_decimal(50, 2) * jump
}
```

where `current_time` measures how much time has passed
since the start of the bonds and `buy_amount` is how much trader wants to buy.

Locally, in `trade_time`, the price chart looks like this:

![Bond locally](/img/docs/math/bond_locally.png)
