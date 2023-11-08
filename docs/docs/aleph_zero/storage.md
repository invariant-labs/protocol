---
title: Storage

slug: /aleph_zero/storage
---

## FeeTier

```rust
pub struct FeeTier {
    pub fee: Percentage,
    pub tick_spacing: u16,
}
```
|Name|Type|Description|
|-|-|-|
|fee|Percentage|Percentage of the fee collected upon every swap in the pool|
|tick_spacing|u16|The spacing between usable ticks|

## PoolKey

```rust
pub struct PoolKey {
    pub token_x: AccountId,
    pub token_y: AccountId,
    pub fee_tier: FeeTier,
}
```
|Name|Type|Description|
|-|-|-|
|token_x|AccountId|address of token_x|
|token_y|AccountId|address of token_y|
|fee_tier|FeeTier|FeeTier associated with pool|

## Pool

```rust
pub struct Pool {
    pub liquidity: Liquidity,
    pub sqrt_price: SqrtPrice,
    pub current_tick_index: i32,
    pub fee_growth_global_x: FeeGrowth,
    pub fee_growth_global_y: FeeGrowth,
    pub fee_protocol_token_x: TokenAmount,
    pub fee_protocol_token_y: TokenAmount,
    pub seconds_per_liquidity_global: SecondsPerLiquidity,
    pub start_timestamp: u64,
    pub last_timestamp: u64,
    pub fee_receiver: AccountId,
    pub oracle_address: Oracle,
    pub oracle_initialized: bool,
}
```
|Name|Type|Description|
|-|-|-|
|liquidity|Liquidity|Amount of virtual liquidity that the position represented the last time this position was touched. The diffrence between virtual and actual liquidity reflect the increased capital efficiency in Invariant|
|sqrt_price|SqrtPrice|Square root of current price|
|current_tick_index|i32|The nearest tick below the current price|
|fee_growth_global_x|FeeGrowth|Amount of fees accumulated in token_x in per one integer unit of Liquidity|
|fee_growth_global_y|FeeGrowth|Amount of fees accumulated in token_y in per one integer unit of Liquidity|
|fee_protocol_token_x|TokenAmount|Amount of protocol tokens accumulated in token_x in per one integer unit of Liquidity|
|fee_protocol_token_y|TokenAmount|Amount of protocol tokens accumulated in token_y in per one integer unit of Liquidity|
|seconds_per_liquidity_global|SecondsPerLiquidity|Cumulative seconds per liquidity-in-range value|
|start_timestamp|u64|Time of initialization|
|last_timestamp|u64|Last update|
|fee_receiver|AccountId|Address of entity enabling to claim protocol fee. By default it's admin but can be change for specific pool|
|oracle_address|Oracle|Oracle associated with Pool|
|oracle_initialized|bool|Is oracle set for Pool|

## Position

```rust
pub struct Position {
    pub pool_key: PoolKey,
    pub liquidity: Liquidity,
    pub lower_tick_index: i32,
    pub upper_tick_index: i32,
    pub fee_growth_inside_x: FeeGrowth,
    pub fee_growth_inside_y: FeeGrowth,
    pub seconds_per_liquidity_inside: SecondsPerLiquidity,
    pub last_block_number: u64,
    pub tokens_owed_x: TokenAmount,
    pub tokens_owed_y: TokenAmount,
}
```
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key identificating on which Pool the position has been opened|
|liquidity|Liquidity|Amount of virtual liquidity that the position represented the last time this position was touched|
|lower_tick_index|i32|Lower tick index of the Position|
|upper_tick_index|i32|Upper tick index of the Position|
|fee_growth_inside_x|FeeGrowth|Amount of fees accumulated in token_x in-range|
|fee_growth_inside_y|FeeGrowth|Amount of fees accumulated in token_y in-range|
|seconds_per_liquidity_inside|SecondsPerLiquidity|Seconds spent in-range|
|last_block_number|u64|Last update|
|tokens_owed_x|TokenAmount|Amount of token_x that can be claimed|
|tokens_owed_y|TokenAmount|Amount of token_y that can be claimed|


## Tick

```rust
pub struct Tick {
    pub index: i32,
    pub sign: bool,
    pub liquidity_change: Liquidity,
    pub liquidity_gross: Liquidity,
    pub sqrt_price: SqrtPrice,
    pub fee_growth_outside_x: FeeGrowth,
    pub fee_growth_outside_y: FeeGrowth,
    pub seconds_per_liquidity_outside: SecondsPerLiquidity,
    pub seconds_outside: u64,
}
```
|Name|Type|Description|
|-|-|-|
|index|i32|Index of tick|
|sign|bool|Determine if the liquidity will be added or substracted on cross|
|liquidity_change|Liquidity|Amount of virtaul liqidity to adjust while crossing|
|liquidity_gross|Liquidity|Amount of virtual liquidity|
|sqrt_price|SqrtPrice|Square root of tick price|
|fee_growth_outside_x|FeeGrowth|Amount of Fees accumulated in token_x outside-range|
|fee_growth_outside_y|FeeGrowth|Amount of Fees accumulated in token_y outside-range|
|seconds_per_liquidity_outside|SecondsPerLiquidity|Cumulative seconds per liquidity outside-range|
|seconds_outside|u64|Seconds outside-range|

## State

```rust
pub struct State {
    pub admin: AccountId,
    pub protocol_fee: Percentage,
}
```
|Name|Type|Description|
|-|-|-|
|admin|AccountId|Account address of pool admin|
|protocol_fee|Percentage|Percentage of the fee collected upon every swap in the pool|

## Oracle

```rust
pub struct Oracle {
    pub data: Vec<Record>,
    pub head: u16,
    pub amount: u16,
    pub size: u16,
}
```

|Name|Type|Description|
|-|-|-|
|data|Vec Record |.|
|head|u16|.|
|amount|u16|.|
|Size|u16|.|

## Record

```rust
pub struct Record {
    pub timestamp: u64,
    pub price: SqrtPrice,
}
```

|Name|Type|Description|
|-|-|-|
|timestamp|u64| Last update|
|price|SqrtPrice|Square root of price in the last update|
