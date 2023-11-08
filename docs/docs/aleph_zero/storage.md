---
title: Storage

slug: /aleph_zero/storage
---

## FeeTier

```rust
#[derive(scale::Decode, scale::Encode, Debug, Copy, Clone, PartialEq)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
pub struct FeeTier {
    pub fee: Percentage,
    pub tick_spacing: u16,
}
```
|Name|Type|Description|
|-|-|-|
|fee|Percentage||
|tick_spacing|u16||

## PoolKey

```rust
#[derive(scale::Decode, scale::Encode, Debug, Copy, Clone, PartialEq)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]

pub struct PoolKey {
    pub token_x: AccountId,
    pub token_y: AccountId,
    pub fee_tier: FeeTier,
}
```
|Name|Type|Description|
|-|-|-|
|token_x|AccountId||
|token_y|AccountId||
|fee_tier|FeeTier||

## Pool

```rust
#[derive(PartialEq, Debug, Clone, scale::Decode, scale::Encode)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
pub struct Pool {
    pub liquidity: Liquidity,
    pub sqrt_price: SqrtPrice,
    pub current_tick_index: i32, // nearest tick below the current sqrt_price
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
|liquidity|Liquidity||
|sqrt_price|SqrtPrice|.|
|current_tick_index|i32|.|
|fee_growth_global_x|FeeGrowth|.|
|fee_growth_global_y|FeeGrowth|.|
|fee_protocol_token_x|TokenAmount|.|
|fee_protocol_token_y|TokenAmount|.|
|seconds_per_liquidity_global|SecondsPerLiquidity|.|
|start_timestamp|u64|.|
|last_timestamp|u64|.|
|fee_receiver|AccountId|.|
|oracle_address|Oraclec|.|
|oracle_initialized|bool|.|

## Position

```rust
#[derive(PartialEq, Default, Debug, Copy, Clone, scale::Decode, scale::Encode)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
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
|pool_key|PoolKey|.|
|liquidity|Liquidity|.|
|lower_tick_index|i32|.|
|upper_tick_index|i32|.|
|fee_growth_inside_x|FeeGrowth|.|
|fee_growth_inside_y|FeeGrowth|.|
|seconds_per_liquidity_inside|SecondsPerLiquidity|.|
|last_block_number|u64|.|
|tokens_owed_x|TokenAmount|.|
|tokens_owed_y|TokenAmount|.|


## Tick

```rust
#[derive(Debug, Copy, Clone, scale::Decode, scale::Encode, PartialEq)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
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
|index|i32|.|
|sign|bool|.|
|liquidity_change|Liquidity|.|
|liquidity_gross|Liquidity|.|
|sqrt_price|SqrtPrice|.|
|fee_growth_outside_x|FeeGrowth|.|
|fee_growth_outside_y|FeeGrowth|.|
|seconds_per_liquidity_outside|SecondsPerLiquidity|.|
|seconds_outside|u64|.|

## State

```rust
#[ink::storage_item]
#[derive(Debug)]
pub struct State {
    pub admin: AccountId,
    pub protocol_fee: Percentage,
}
```
|Name|Type|Description|
|-|-|-|
|admin|AccountId|.|
|protocol_fee|Percentage|.|

## Oracle

```rust
#[derive(Default, Debug, PartialEq, Clone, scale::Decode, scale::Encode)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
pub struct Oracle {
    pub data: Vec<Record>,
    pub head: u16,
    pub amount: u16,
    pub size: u16,
}
```

|Name|Type|Description|
|-|-|-|
|data|Vec<Record>|.|
|head|u16|.|
|amount|u16|.|
|Size|u16|.|

## Record

```rust
#[derive(Default, Debug, PartialEq, Copy, Clone, scale::Decode, scale::Encode)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
pub struct Record {
    pub timestamp: u64,
    pub price: SqrtPrice,
}
```

|Name|Type|Description|
|-|-|-|
|timestamp|u64|.|
|price|SqrtPrice|.|




## Tickmap

```rust
#[derive(Debug)]
#[ink::storage_item]
pub struct Tickmap {
    pub bitmap: Mapping<(u16, PoolKey), u64>,
}
```

|Name|Type|Description|
|-|-|-|
|protocol_fee|Percentage|.|
