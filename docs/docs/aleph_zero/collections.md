---
title: Collections

slug: /aleph_zero/collections
---

This segment explores key storage structures that manage various entities within the Aleph Zero protocol. Understanding these structures is crucial for developers and integrators engaging with the protocol's data.

## Positions

```rust
#[ink::storage_item]
#[derive(Debug, Default)]
pub struct Positions {
    positions: Mapping<AccountId, (u32, Vec<Position>)>,
}
```

|Key|Value|
|-|-|
|Unique account identifier| A tuple containing the number of positions (u32) and a vector of `Position` objects |

The `Positions` struct is designed to manage positions associated with different accounts. It uses a mapping data structure, where each account is uniquely identified by its `AccountId`, and a tuple containing the number of positions and a vector of positions is stored as the associated value. The provided functions allow you to add, update, remove, transfer, and retrieve positions associated with specific accounts.

This documentation should help users understand the purpose of the `Positions` struct and how to use its functions effectively.

**Why Positions are Stored in State Instead of NFTs:**

We have chosen to store positions in the state rather than using NFTs for several reasons:

1. **Optimal determining user's positions and iterating through them**: Main reason is independence from blockchain token indexer. Iterating through NFTs can be problematic and less efficient, especially when dealing with a large number of unique NFTs. Storing positions in a state makes it easier to manage and access them. Maintaining positions in the state can be more cost-effective in terms of gas fees and contract execution. NFTs can involve additional costs for minting, transferring, and managing unique tokens.

2. **Optimal Search**: Searching for and accessing specified positions is more optimal when positions are stored in the state. It simplifies the process of retrieving and managing positions for specific accounts.


### Functions within the `Positions` Struct

```rust 
    pub fn add(&mut self, account_id: AccountId, position: Position) {}
```

- **Description**: Adds a new position to the specified account.
- **Parameters**: `account_id` (AccountId), `position` (Position)
- **Edge Cases**: None

```rust
    pub fn update(
        &mut self,
        account_id: AccountId,
        index: u32,
        position: &Position,
    ) -> Result<(), ContractErrors> {}
```
- **Description**: Updates an existing position at a specific index for the specified account.
- **Parameters**: `account_id` (AccountId), `index` (u32), `position` (Position)
- **Edge Cases**: Returns an error if the specified index is out of bounds.

```rust
    pub fn remove(
        &mut self,
        account_id: AccountId,
        index: u32,
    ) -> Result<Position, ContractErrors> {}
```
- **Description**: Removes a position at a specific index for the specified account.
- **Parameters**: `account_id` (AccountId), `index` (u32)
- **Edge Cases**: Returns an error if the specified index is out of bounds.

```rust
    pub fn transfer(
        &mut self,
        account_id: AccountId,
        index: u32,
        receiver: AccountId,
    ) -> Result<(), ContractErrors> {}
```

- **Description**: Transfers a position from one account to another.
- **Parameters**: `account_id` (AccountId), `index` (u32), `receiver` (AccountId)
- **Edge Cases**: Returns an error if the position does not exist.

```rust
    pub fn get_all(&self, account_id: AccountId) -> Vec<Position> {}
```

- **Description**: Retrieves all positions associated with the specified account.
- **Parameters**: `account_id` (AccountId)
- **Edge Cases**: None

```rust
    pub fn get(&mut self, account_id: AccountId, index: u32) -> Option<Position> {}
```

- **Description**: Retrieves a position at a specific index for the specified account.
- **Parameters**: `account_id` (AccountId), `index` (u32)
- **Edge Cases**: Returns `None` if the specified index is out of bounds.

```rust
    fn get_length(&self, account_id: AccountId) -> u32 {}
```
- **Description**: Retrieves the number of positions associated with the specified account.
- **Parameters**: `account_id` (AccountId)
- **Edge Cases**: None

```rust
    fn get_value(&self, account_id: AccountId) -> (u32, Vec<Position>) {}
```
- **Description**: Retrieves the tuple containing the number of positions and the vector of positions associated with the specified account.
- **Parameters**: `account_id` (AccountId)
- **Edge Cases**: None



## Ticks

```rust
#[ink::storage_item]
#[derive(Debug, Default)]
pub struct Ticks {
    ticks: Mapping<(PoolKey, i32), Tick>,
}

```

|Key|Value|
|-|-|
|A tuple of `PoolKey` and `i32` values, uniquely identifying a specific tick.| A `Tick` object associated with the key |

The Ticks struct is designed to manage ticks associated between different pools. It uses a mapping data structure, where each tick is identified by a tuple of PoolKey and i32 (tick index), and a Tick object is stored as the associated value. The provided functions allow you to retrieve, add, update, and remove ticks associated with specific PoolKey values.



### Functions within the `Ticks` Struct

```rust
pub fn get_tick(&self, key: PoolKey, index: i32) -> Option<Tick> {}
```

- **Description**: Retrieves a Tick object associated with a specific PoolKey and index.
- **Parameters**: key (PoolKey), index (i32)
- **Edge Cases**: None

```rust
pub fn remove_tick(&mut self, key: PoolKey, index: i32) -> Result<(), ContractErrors> {}
```

- **Description**: Removes a tick associated with a specific PoolKey and index.
- **Parameters**: key (PoolKey), index (i32)
- **Edge Cases**: Returns an error if the specified tick does not exist.

```rust
pub fn add_tick(&mut self, key: PoolKey, index: i32, tick: Tick) {}
```

- **Description**: Adds a new tick associated with a specific PoolKey and index.
- **Parameters**: key (PoolKey), index (i32), tick (Tick)
- **Edge Cases**: None

```rust
pub fn update_tick(
    &mut self,
    key: PoolKey,
    index: i32,
    tick: &Tick,
) -> Result<(), ContractErrors> {}
```

- **Description**: Updates an existing tick associated with a specific PoolKey and index.
- **Parameters**: key (PoolKey), index (i32), tick: (&Tick)
- **Edge Cases**: Returns an error if the specified tick does not exist.

## Pools

```rust

#[ink::storage_item]
#[derive(Debug, Default)]
pub struct Pools {
    pools: Mapping<PoolKey, Pool>,
}
```

|Key|Value|
|-|-|
|A unique identifier for a pool| A `Pool` object associated with the key |

The `Pools` struct is designed to manage pools associated with different `PoolKey` values. It uses a mapping data structure, where each pool is identified by a unique `PoolKey`, and a `Pool` object is stored as the associated value. The provided functions allow you to add, retrieve, update, and remove pools associated with specific `PoolKey` values.


### Functions within the `Pools` Struct

```rust
    pub fn add(&mut self, pool_key: PoolKey, pool: &Pool) -> Result<(), ContractErrors> {}
```

- **Description**: Adds a new pool associated with the specified `PoolKey`.
- **Parameters**: `pool_key` (PoolKey), `pool` (Pool)
- **Edge Cases**: Returns an error if a pool with the same `PoolKey` already exists.

```rust
    pub fn get(&self, pool_key: PoolKey) -> Result<Pool, ContractErrors> {}
```

- **Description**: Retrieves a pool associated with the specified `PoolKey`.
- **Parameters**: `pool_key` (PoolKey)
- **Edge Cases**: Returns an error if the specified pool does not exist.

```rust
    pub fn update(&mut self, pool_key: PoolKey, pool: &Pool) -> Result<(), ContractErrors> {}
```

- **Description**: Updates an existing pool associated with the specified `PoolKey`.
- **Parameters**: `pool_key` (PoolKey), `pool` (Pool)
- **Edge Cases**: Returns an error if the specified pool does not exist.

```rust
    pub fn remove(&mut self, pool_key: PoolKey) -> Result<(), ContractErrors> {}
```

- **Description**: Removes a pool associated with the specified `PoolKey`.
- **Parameters**: `pool_key` (PoolKey)
- **Edge Cases**: Returns an error if the specified pool does not exist.


## Fee Tiers

```rust
#[ink::storage_item]
#[derive(Debug, Default)]
pub struct FeeTiers {
    fee_tiers: Mapping<FeeTierKey, ()>,
}
```

|Key|Value|
|-|-|
|`FeeTierKey` - A key comprised of `Percentage` and `u16`, uniquely identifying a fee tier| An empty tuple `()` as a placeholder |
The `FeeTiers` struct is designed to manage fee tiers associated with different `FeeTierKey` values. It uses a mapping data structure, where each fee tier is identified by a `FeeTierKey`, and an empty tuple `()` serves as a placeholder for the associated value. The provided functions allow you to retrieve, add, and remove fee tiers based on specific `FeeTierKey` values.

### Functions within the `FeeTiers` Struct

```rust
    pub fn get_fee_tier(&self, key: FeeTierKey) -> Option<()> {}
```
- **Description**: Retrieves a fee tier associated with the specified `FeeTierKey`.
- **Parameters**: `key` (FeeTierKey)
- **Edge Cases**: None

```rust
    pub fn add_fee_tier(&mut self, key: FeeTierKey) {}
```
- **Description**: Adds a new fee tier associated with the specified `FeeTierKey`.
- **Parameters**: `key` (FeeTierKey)
- **Edge Cases**: None

```rust
    pub fn remove_fee_tier(&mut self, key: FeeTierKey) {}
```
- **Description**: Removes a fee tier associated with the specified `FeeTierKey`.
- **Parameters**: `key` (FeeTierKey)
- **Edge Cases**: None

## Pool Keys and Fee Tier Keys

```rust
    #[ink(storage)]
    #[derive(Default)]
    pub struct Contract {
        fee_tier_keys: Vec<FeeTierKey>,
        pool_keys: Vec<PoolKey>,
        ...
    }
```

- `fee_tier_keys`: A `Vec` (vector) of `FeeTierKey` instances that define various fee tiers for the system.

- `pool_keys`: A `Vec` of `PoolKey` instances used to identify liquidity pools within the ecosystem.

These collections play a pivotal role in ensuring the seamless operation and interaction within the system by allowing easy access to fee tier data and providing a store for supported tokens.
