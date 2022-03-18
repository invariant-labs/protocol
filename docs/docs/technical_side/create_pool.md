---
title: Creating a Pool

slug: /sdk/create_pool
---

### Structure of Pool

The date structure is defined as:

```rust
pub struct Pool {
    pub token_x: Pubkey,
    pub token_y: Pubkey,
    pub token_x_reserve: Pubkey,
    pub token_y_reserve: Pubkey,
    pub position_iterator: u128,
    pub tick_spacing: u16,
    pub fee: FixedPoint,
    pub protocol_fee: FixedPoint,
    pub liquidity: Liquidity,
    pub sqrt_price: Price,
    pub current_tick_index: i32,
    pub tickmap: Pubkey,
    pub fee_growth_global_x: FeeGrowth,
    pub fee_growth_global_y: FeeGrowth,
    pub fee_protocol_token_x: u64,
    pub fee_protocol_token_y: u64,
    pub seconds_per_liquidity_global: FixedPoint,
    pub start_timestamp: u64,
    pub last_timestamp: u64,
    pub fee_receiver: Pubkey,
    pub oracle_address: Pubkey,
    pub oracle_initialized: bool,
    pub bump: u8,
}
```

| Name                         | Type       | Description                                                                           |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| token_x                      | Pubkey     | The contract address of token_x.                                                      |
| token_y                      | Pubkey     | The contract address of token_y.                                                      |
| token_x_reserve              | Pubkey     | The contract address of either token_x or token_y.                                    |
| token_y_reserve              | Pubkey     | The contract address of the other token.                                              |
| position_iterator            | u128       | Index of each position i current pool.                                                |
| tick_spacing                 | u16        | The spacing between usable ticks                                                      |
| fee                          | FixedPoint | The fee collected upon every swap in the pool.                                        |
| protocol_fee                 | FixedPoint | The protocol fee collected upon every swap in the pool.                               |
| liquidity                    | Liquidity  | Square root of liquidity in current pool                                              |
| sqrt_price                   | Price      | Square root of current price.                                                         |
| current_tick_index           | i32        | nearest tick below the current price                                                  |
| tickmap                      | Pubkey     | The contract address of the tick map.                                                 |
| fee_growth_global_x          | FeeGrowth  | Used to track how many fees were accumulated in terms of token_x.                     |
| fee_growth_global_y          | FeeGrowth  | Used to track how many fees were accumulated in terms of token_x.                     |
| fee_protocol_token_x         | u64        | Protocol fee in token_x.                                                              |
| fee_protocol_token_y         | u64        | Protocol fee in token_y.                                                              |
| seconds_per_liquidity_global | FixedPoint | Cumulative seconds per liquidity-in-range value.                                      |
| start_timestamp              | u64        | Time of initialization.                                                               |
| last_timestamp               | u64        | Last update.                                                                          |
| fee_receiver                 | Pubkey     | The contract address of creator of the pool.                                          |
| oracle_address               | Pubkey     | The contract address                                                                  |
| oracle_initialized           | bool       | True or False                                                                         |
| bump                         | u8         | seed used to ensure the generated address doesn't collide with any other existing one |

### Pool Creation

```rust
pub fn create_pool(ctx: Context<CreatePool>, init_tick: i32) -> ProgramResult {
        ctx.accounts
            .handler(init_tick, *ctx.bumps.get("pool").unwrap())
    }
```

The `init_tick` is just the initial tick of the Pool. For stable pair initial tick should be near to 0.
