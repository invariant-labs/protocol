---
title: Storage

slug: /aleph_zero/storage
---

This section provides an in-depth exploration of key data structures integral to the Invariant protocol's storage mechanism. These structs are specifically crafted to facilitate the sharing of the state of the exchange within the CLAMM model. These data structures play a pivotal role in maintaining and organizing information related to the exchange, ensuring efficient and organized handling of data.

## Contract State

```rust
#[ink::storage_item]
#[derive(Debug)]
pub struct InvariantConfig {
    pub admin: AccountId,
    pub protocol_fee: Percentage,
}
```

| Name         | Type       | Description                                                                                                                                                                                 |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| admin        | AccountId  | Account address of protocol admin. Admin is able to change fee, claim protocol fee or set the fee receiver, but cannot interfere with user positions or deposits and cannot close the pool. |
| protocol_fee | Percentage | Percentage of the fee collected upon every swap in the pool that goes to the protocol, rest goes to LP.                                                                                     |

## FeeTier

```rust
#[derive(scale::Decode, scale::Encode)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
pub struct FeeTier {
    pub fee: Percentage,
    pub tick_spacing: u16,
}
```

| Name         | Type       | Description                                                  |
| ------------ | ---------- | ------------------------------------------------------------ |
| fee          | Percentage | Percentage of the fee collected upon every swap in the pool. |
| tick_spacing | u16        | The spacing between usable ticks.                            |

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

| Name     | Type      | Description                   |
| -------- | --------- | ----------------------------- |
| token_x  | AccountId | address of x token.           |
| token_y  | AccountId | address of y token.           |
| fee_tier | FeeTier   | FeeTier associated with pool. |

## Pool

```rust
#[derive(scale::Decode, scale::Encode)]
#[cfg_attr(
    feature = "std",
    derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
)]
pub struct Pool {
    pub liquidity: Liquidity,
    pub sqrt_price: SqrtPrice,
    pub current_tick_index: i32,
    pub fee_growth_global_x: FeeGrowth,
    pub fee_growth_global_y: FeeGrowth,
    pub fee_protocol_token_x: TokenAmount,
    pub fee_protocol_token_y: TokenAmount,
    pub start_timestamp: u64,
    pub last_timestamp: u64,
    pub fee_receiver: AccountId,
}
```

| Name                 | Type        | Description                                                                                                                                     |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| liquidity            | Liquidity   | Amount of virtual liquidity on pool. The difference between virtual and actual liquidity reflect the increased capital efficiency in Invariant. |
| sqrt_price           | SqrtPrice   | Square root of current price.                                                                                                                   |
| current_tick_index   | i32         | The nearest tick below the current price.                                                                                                       |
| fee_growth_global_x  | FeeGrowth   | Amount of fees accumulated in x token in per one integer unit of Liquidity since pool initialization.                                           |
| fee_growth_global_y  | FeeGrowth   | Amount of fees accumulated in y token in per one integer unit of Liquidity since pool initialization.                                           |
| fee_protocol_token_x | TokenAmount | Amount of protocol tokens accumulated in x token that are available to claim.                                                                   |
| fee_protocol_token_y | TokenAmount | Amount of protocol tokens accumulated in y token that are available to claim.                                                                   |
| start_timestamp      | u64         | Time of pool initialization.                                                                                                                    |
| last_timestamp       | u64         | Last update of pool.                                                                                                                            |
| fee_receiver         | AccountId   | Address of entity enabling to claim protocol fee. By default it's admin but can be change for specific pool.                                    |

## Position

```rust
#[derive(scale::Decode, scale::Encode)]
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
    pub last_block_number: u64,
    pub tokens_owed_x: TokenAmount,
    pub tokens_owed_y: TokenAmount,
}
```

| Name                | Type        | Description                                                                                                                             |
| ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| pool_key            | PoolKey     | Pool key identificating on which Pool the position has been opened.                                                                     |
| liquidity           | Liquidity   | Amount of immutable virtual liquidity that the position represents.                                                                     |
| lower_tick_index    | i32         | Lower tick index of the Position.                                                                                                       |
| upper_tick_index    | i32         | Upper tick index of the Position.                                                                                                       |
| fee_growth_inside_x | FeeGrowth   | Amount of fees accumulated in x token per one integer unit of Liquidity in-range. It is used to determine the shares of collected fees. |
| fee_growth_inside_y | FeeGrowth   | Amount of fees accumulated in y token per one integer unit of Liquidity in-range. It is used to determine the shares of collected fees. |
| last_block_number   | u64         | Last update of position expressed in block number.                                                                                      |
| tokens_owed_x       | TokenAmount | The quantity of x tokens collected in fees that is available for claiming.                                                              |
| tokens_owed_y       | TokenAmount | The quantity of y tokens collected in fees that is available for claiming.                                                              |

## Tick

```rust
#[derive(scale::Decode, scale::Encode)]
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
    pub seconds_outside: u64,
}
```

| Name                 | Type      | Description                                                                                                                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| index                | i32       | Index of tick.                                                                                                                                                              |
| sign                 | bool      | Determine if the liquidity will be added or subtracted on cross.                                                                                                            |
| liquidity_change     | Liquidity | Amount of virtual liquidity to adjust while. crossing.                                                                                                                      |
| liquidity_gross      | Liquidity | Amount of virtual liquidity to be added on the tick, excluding liquidity taken on that tick. It is used to impose the maximum liquidity that can be place on a single tick. |
| sqrt_price           | SqrtPrice | Square root of tick price.                                                                                                                                                  |
| fee_growth_outside_x | FeeGrowth | Amount of Fees accumulated in x token outside-range.                                                                                                                        |
| fee_growth_outside_y | FeeGrowth | Amount of Fees accumulated in y token outside-range.                                                                                                                        |
| seconds_outside      | u64       | Seconds outside-range.                                                                                                                                                      |
