---
title: Pool

slug: /technical_side/pool
---

### Structure of Pool

Each pool has following structure:

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
| token_x                      | Pubkey     | Address of token_x.                                                                   |
| token_y                      | Pubkey     | Address of token_y.                                                                   |
| token_x_reserve              | Pubkey     | Account of token_x controlled by Authority.                                           |
| token_y_reserve              | Pubkey     | Account of token_y controlled by Authority                                            |
| position_iterator            | u128       | Unique ID of each position in current pool.                                           |
| tick_spacing                 | u16        | The spacing between usable ticks                                                      |
| fee                          | FixedPoint | Percentage The fee collected upon every swap in the pool.                             |
| protocol_fee                 | FixedPoint | Percentage The protocol fee collected upon every swap in the pool.                    |
| liquidity                    | Liquidity  | Liquidity in current pool                                                             |
| sqrt_price                   | Price      | Square root of current price.                                                         |
| current_tick_index           | i32        | The nearest tick below the current price                                              |
| tickmap                      | Pubkey     | Address of the tick map.                                                              |
| fee_growth_global_x          | FeeGrowth  | Amount of fees accumulated in token_x in per one unit of Liquidity.                   |
| fee_growth_global_y          | FeeGrowth  | Amount of fees accumulated in token_x in per one unit of Liquidity.                   |
| fee_protocol_token_x         | u64        | Amount of protocol fees accumulated in token_x in per one unit of Liquidity.          |
| fee_protocol_token_y         | u64        | Amount of protocol fees accumulated in token_x in per one unit of Liquidity.          |
| seconds_per_liquidity_global | FixedPoint | Cumulative seconds per liquidity-in-range value.                                      |
| start_timestamp              | u64        | Time of initialization.                                                               |
| last_timestamp               | u64        | Last update.                                                                          |
| fee_receiver                 | Pubkey     | Address of creator of the pool.                                                       |
| bump                         | u8         | Deed used to ensure the generated address doesn't collide with any other existing one |
