---
title: Collections

slug: /aleph_zero/collections
---

This segment explores key storage structures that manage various entities within the Invariant Protocol. These collections play a crucial role in organizing and managing data in a structured manner, enhancing the overall functionality and performance of our contract. Within our collection interface, we enforce a tightly defined set of operations available for all data collections. Each collection implements the same basic methods, allowing for consistent data management regardless of the underlying data structures (vectors or mappings).

## Positions

```rust
#[ink::storage_item]
pub struct Positions {
    positions_length: Mapping<AccountId, u32>,
    positions: Mapping<(AccountId, u32), Position>,
}
```

The `Positions` struct is designed to manage positions associated with different accounts. It uses a mapping data structure where each position is uniquely identified by the user's address and the index position within the user's position list. The provided functions allow you to add, update, remove, transfer, and retrieve positions and the number of positions associated with specific addresses.

| Type                                | Key                                                              | Value                                        |
| ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Mapping<AccountId, u32>             | User's address.                                                  | Number of the user's positions.              |
| Mapping<(AccountId, u32), Position> | Tuple containing the user's address and the index of a position. | Position struct holding the position's data. |

### Position Storage Standard

Why are positions stored in the state instead of NFTs? We have chosen to store positions in the contract state rather than using NFTs for several reasons:

1. **Efficient Search Operations**: One primary advantage is the enhanced efficiency in searching for and accessing specified positions. Independence from blockchain token indexers distinguishes this approach. Unlike the alternative, where determining a user's position may require iterating through all available NFTs, storing positions in the state streamlines the process of retrieving and managing positions for specific accounts. This makes it a more optimal choice when precision and speed are crucial.

2. **Gas Cost Optimization**: Iterating through NFTs can pose challenges and inefficiencies, particularly with a substantial number of unique tokens. Storing positions in the state not only simplifies management and access but also proves to be more cost-effective in terms of gas fees and overall contract execution, leading to improved gas cost optimization. Unlike NFTs, which may incur additional costs for minting, transferring, and managing unique tokens, the state-based approach offers a more streamlined and economical solution.

3. **Data Integrity and Recovery**: In scenarios where accidental deletion or burning of NFTs may occur, the state-based approach ensures the preservation of critical position data. This safeguards against potential data loss, offering an added layer of security and resilience to unforeseen circumstances.

### Add Position

```rust
pub fn add(&mut self, account_id: AccountId, position: &Position);
```

Adds a new position to the specified account.

#### Input parameters

| Name       | Type      | Description                                            |
| ---------- | --------- | ------------------------------------------------------ |
| account_id | AccountId | The address of the user who will receive the position. |
| position   | Position  | The Position struct with data.                         |

### Update Position

```rust
pub fn update(
    &mut self,
    account_id: AccountId,
    index: u32,
    position: &Position,
) -> Result<(), InvariantError>;
```

Updates an existing position at a specific index for the specified account. Returns an error if the specified index is out of bounds.

#### Input parameters

| Name       | Type      | Description                                                            |
| ---------- | --------- | ---------------------------------------------------------------------- |
| account_id | AccountId | The address of the user whose position will be updated.                |
| index      | u32       | The index of an existing position of the user.                         |
| position   | Position  | The Position struct with data that will replace the existing position. |

### Remove Position

```rust
pub fn remove(
    &mut self,
    account_id: AccountId,
    index: u32,
) -> Result<Position, InvariantError>;
```

Removes a position at a specific index for the specified account. Returns an error if the specified index is out of bounds.

#### Input parameters

| Name       | Type      | Description                                             |
| ---------- | --------- | ------------------------------------------------------- |
| account_id | AccountId | The address of the user whose position will be removed. |
| index      | u32       | The index of an existing position of the user.          |

#### Output parameters

| Type     | Description                                    |
| -------- | ---------------------------------------------- |
| Position | Position struct with data of removed position. |

### Transfer Position

```rust
pub fn transfer(
    &mut self,
    account_id: AccountId,
    index: u32,
    receiver: AccountId,
) -> Result<(), InvariantError>;
```

Transfers a position from one account to another. Returns an error if the position does not exist.

#### Input parameters

| Name       | Type      | Description                                                 |
| ---------- | --------- | ----------------------------------------------------------- |
| account_id | AccountId | The address of the user whose position will be transferred. |
| index      | u32       | The index of an existing position of the user.              |
| receiver   | AccountId | The address of the user who will receive the position.      |

### Get All Positions

```rust
pub fn get_all(&self, account_id: AccountId, size: u32, offset: u32) -> Vec<Position>;
```

Retrieves all positions associated with the specified account.

#### Input parameters

| Name       | Type      | Description                                                  |
| ---------- | --------- | ------------------------------------------------------------ |
| account_id | AccountId | The address of the user whose positions will be returned.    |
| size       | u32       | Max size of the query, up to `MAX_POSITIONS_RETURNED` (143). |
| offset     | u32       | Index to start querying from.                                |

#### Output parameters

| Type           | Description                               |
| -------------- | ----------------------------------------- |
| Vec<Position\> | A vector containing the user's positions. |

### Get Position

```rust
pub fn get(&mut self, account_id: AccountId, index: u32) -> Option<Position>;
```

Retrieves a position at a specific index for the specified account. Returns none if the specified index is out of bounds.

#### Input parameters

| Name       | Type      | Description                                               |
| ---------- | --------- | --------------------------------------------------------- |
| account_id | AccountId | The address of the user whose position will be returned. |
| index | i32     | Index of a position.            |

#### Output parameters

| Type              | Description                                       |
| ----------------- | ------------------------------------------------- |
| Option<Position\> | An option containing the user's position or none. |

### Get Number Of Positions

```rust
fn get_length(&self, account_id: AccountId) -> u32;
```

Retrieves the number of positions associated with the specified account.

#### Input parameters

| Name       | Type      | Description                                                         |
| ---------- | --------- | ------------------------------------------------------------------- |
| account_id | AccountId | The address of the user whose number of positions will be returned. |

#### Output parameters

| Type | Description                         |
| ---- | ----------------------------------- |
| u32  | The number of the user's positions. |

## Ticks

```rust
#[ink::storage_item]
pub struct Ticks {
    ticks: Mapping<(PoolKey, i32), Tick>,
}
```

The `Ticks` struct is designed to manage ticks associated between different pools. It uses a mapping data structure, where each tick is identified by a tuple of `PoolKey` and `i32` (tick index), and a `Tick` object is stored as the associated value. The provided functions allow you to retrieve, add, update, and remove ticks associated with specific `PoolKey` values.

| Type                          | Key                                                         | Value                                |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| Mapping<(PoolKey, i32), Tick> | Tuple containing the pool key and the tick index of a tick. | Tick struct holding the tick's data. |

### Add tick

```rust
pub fn add(&mut self, key: PoolKey, index: i32, tick: &Tick) -> Result<(), InvariantError>;
```

Adds a new tick associated with a specific pool key and index. Returns an error if tick already exist.

| Name  | Type    | Description                 |
| ----- | ------- | --------------------------- |
| key   | PoolKey | Pool key of the pool.       |
| index | i32     | Index of a tick.            |
| tick  | Tick    | Tick struct with tick data. |

### Update tick

```rust
pub fn update(
    &mut self,
    key: PoolKey,
    index: i32,
    tick: &Tick,
) -> Result<(), InvariantError>;
```

Updates an existing tick associated with a specific pool key and index. Returns an error if the specified tick does not exist.

#### Input parameters

| Name  | Type    | Description                 |
| ----- | ------- | --------------------------- |
| key   | PoolKey | Pool key of the pool.       |
| index | i32     | Index of a tick.            |
| tick  | Tick    | Tick struct with tick data. |

### Remove tick

```rust
pub fn remove(&mut self, key: PoolKey, index: i32) -> Result<(), InvariantError>;
```

Removes a tick associated with a specific pool key and index. Returns an error if the specified tick does not exist.

#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| key   | PoolKey | Pool key of the pool. |
| index | i32     | Index of a tick.      |

### Get tick

Retrieves a tick associated with a specific pool key and index. Return an error if specified tick cannot be found.

```rust
pub fn get(&self, key: PoolKey, index: i32) -> Result<Tick, InvariantError>;
```

#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| key   | PoolKey | Pool key of the pool. |
| index | i32     | Index of a tick.      |

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| Tick | Tick struct with tick data. |

## Pools

```rust
#[ink::storage_item]
pub struct Pools {
    pools: Mapping<PoolKey, Pool>,
}
```

The `Pools` struct is designed to manage pools associated with different `PoolKey` values. It uses a mapping data structure, where each pool is identified by a unique `PoolKey`, and a `Pool` object is stored as the associated value. The provided functions allow you to add, retrieve, update, and remove pools associated with specific `PoolKey` values.

| Type                   | Key                               | Value                                 |
| ---------------------- | --------------------------------- | ------------------------------------- |
| Mapping<PoolKey, Pool> | The pool key of a specified pool. | Pool struct holding the pools' data. |

### Add pool

```rust
pub fn add(&mut self, pool_key: PoolKey, pool: &Pool) -> Result<(), InvariantError>;
```

Adds a new pool associated with the specified pool key. Returns an error if a pool with the same pool key already exists.

#### Input parameters

| Name     | Type    | Description                 |
| -------- | ------- | --------------------------- |
| pool_key | PoolKey | Pool key of the pool.       |
| pool     | Pool    | Pool struct with pool data. |

### Update pool

```rust
pub fn update(&mut self, pool_key: PoolKey, pool: &Pool) -> Result<(), InvariantError>;
```

Updates an existing pool associated with the specified pool key. Returns an error if the specified pool does not exist.

#### Input parameters

| Name     | Type    | Description                 |
| -------- | ------- | --------------------------- |
| pool_key | PoolKey | Pool key of the pool.       |
| pool     | Pool    | Pool struct with pool data. |

### Remove pool

```rust
pub fn remove(&mut self, pool_key: PoolKey) -> Result<(), InvariantError>;
```

Removes a pool associated with the specified pool key. Returns an error if the specified pool does not exist.

#### Input parameters

| Name     | Type    | Description           |
| -------- | ------- | --------------------- |
| pool_key | PoolKey | Pool key of the pool. |

### Get pool

```rust
pub fn get(&self, pool_key: PoolKey) -> Result<Pool, InvariantError>;
```

Retrieves a pool associated with the specified pool key. Returns an error if the specified pool does not exist.

#### Input parameters

| Name     | Type    | Description           |
| -------- | ------- | --------------------- |
| pool_key | PoolKey | Pool key of the pool. |

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| Pool | Pool struct with pool data. |

## Fee Tiers

```rust
#[ink::storage_item]
pub struct FeeTiers {
    fee_tiers: Vec<FeeTier>,
}
```

The `FeeTiers` struct is designed to manage fee tiers. It utilizes a vector (Vec) data structure, where each element corresponds to a different fee tier represented by a `FeeTier` object. The provided functions allow you to add, retrieve, update, and remove fee tiers within the collection. Each fee tier is uniquely identified within the vector, and you can perform operations on these fee tiers based on their positions in the vector.


| Type         | Description                                   |
|--------------|-----------------------------------------------|
| Vec<FeeTier\> | Vec holding the structs with fee tiers' data. |

### Add fee tier

```rust
pub fn add(&mut self, key: FeeTier) -> Result<(), InvariantError>;
```

Adds a new fee tier associated with the specified FeeTier. Returns an error if fee tier already exist.

#### Input parameters

| Name | Type    | Description               |
| ---- | ------- | ------------------------- |
| key  | FeeTier | Fee tier you want to add. |

### Remove fee tier

```rust
pub fn remove(&mut self, key: FeeTier) -> Result<(), InvariantError>;
```

Removes a fee tier associated with the specified FeeTier. Returns an error if fee tier cannot be found.

#### Input parameters

| Name | Type    | Description                  |
| ---- | ------- | ---------------------------- |
| key  | FeeTier | Fee tier you want to remove. |

### Contains fee tier

```rust
pub fn contains(&self, key: FeeTier) -> bool;
```

Verifies if specified fee tier exist.

#### Input parameters

| Name | Type    | Description                           |
| ---- | ------- | ------------------------------------- |
| key  | FeeTier | Fee tier you want to check if exists. |

#### Output parameters

| Type | Description                                      |
| ---- | ------------------------------------------------ |
| bool | Bool value indicating if fee tier exists or not. |

### Get all fee tiers

```rust
pub fn get_all(&self) -> Vec<FeeTier>;
```

Retrieves all fee tiers.

#### Output parameters

| Type          | Description                    |
| ------------- | ------------------------------ |
| Vec<FeeTier\> | A vector containing fee tiers. |

## Pool Keys

```rust
#[ink::storage_item]
pub struct PoolKeys {
    pool_keys: Mapping<PoolKey, u16>,
    pool_keys_by_index: Mapping<u16, PoolKey>,
    pool_keys_length: u16,
}
```

The `PoolKeys` struct is designed to manage pool keys. It utilizes a Mapping data structure, where each element corresponds to a different pool key represented by a `PoolKey` object. We have decided to choose a Mapping structure due to vector (Vec) size limitation of `16kB`. The provided functions allow you to add, retrieve, update, and remove pool keys within the collection. Each pool key is uniquely identified within the mapping, and you can perform operations on these pool keys based on their positions in the map.


| Type                   | Key                               | Value                                 |
| ---------------------- | --------------------------------- | ------------------------------------- |
| Mapping<PoolKey, u16> | The pool key of a specified pool. | Unique id of a pool key. |
| Mapping<u16, PoolKey> | Unique id of a pool key. | The pool key of a specified pool.|


### Add pool key

```rust
pub fn add(&mut self, pool_key: PoolKey) -> Result<(), InvariantError>;
```

Adds a new pool key. Returns an error if pool key already exist.

#### Input parameters

| Name     | Type    | Description               |
| -------- | ------- | ------------------------- |
| pool_key | PoolKey | Pool key you want to add. |

### Remove pool key

```rust
pub fn remove(&mut self, pool_key: PoolKey) -> Result<(), InvariantError>;
```

Removes a pool key. Returns an error if pool key cannot be found.

#### Input parameters

| Name     | Type    | Description                  |
| -------- | ------- | ---------------------------- |
| pool_key | PoolKey | Pool key you want to remove. |

### Contains pool key

```rust
pub fn contains(&self, pool_key: PoolKey) -> bool;
```

Verifies if specified pool key exist.

#### Input parameters

| Name     | Type    | Description                           |
| -------- | ------- | ------------------------------------- |
| pool_key | PoolKey | Pool key you want to check if exists. |

#### Output parameters

| Type | Description                                      |
| ---- | ------------------------------------------------ |
| bool | Bool value indicating if pool key exists or not. |

### Get pool key index

```rust
pub fn get_index(&mut self, pool_key: PoolKey) -> Result<(), InvariantError>;
```

Retrieves specified pool key index in mapping.

### Get all pool keys

```rust
pub fn get_all(&self, size: u16, offset: u16) -> Vec<PoolKey>;
```

Retrieves all pool keys.

#### Input parameters

| Name     | Type    | Description                                           |
| -------- | ------- | ----------------------------------------------------- |
| size     | u16     | Max query size, up to `MAX_POOL_KEYS_RETURNED` (910). |
| offset   | u16     | Index to start querying from.                         |

#### Output parameters

| Type          | Description                    |
| ------------- | ------------------------------ |
| Vec<PoolKey\> | A vector containing pool keys. |


## Tickmap
```rust
#[ink::storage_item]
pub struct Tickmap {
    pub chunk_lookups: Mapping<(u16, PoolKey), u64>,
    pub bitmap: Mapping<(u16, PoolKey), u64>,
}
```
`Tickmap` struct stores the positions of active ticks. It's done by storing active chunks in `bitmap` mapping. A chunk contains information about 64 ticks which reduces the cost of searching drastically. Additionally `chunk_lookups` mapping is used to allow for queries to be even more efficient. Functionality of this struct allows you to efficiently query and update information about tick state.

### Next initialized
```rust
pub fn next_initialized(&self, tick: i32, tick_spacing: u16, pool_key: PoolKey) -> Option<i32> 
```

Returns the index of the next initialized tick.

#### Input parameters

| Name          | Type    | Description                                                      |
| ------------- | ------- | ---------------------------------------------------------------- |
| tick          | i32     | Tick index to start searching from.                              |
| tick_spacing  | u16     | Distance between valid ticks.                                    |
| pool_key      | PoolKey | Key identifying the pool in which the tick should be looked for. |

#### Output parameters

| Type          | Description                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| Option<i32\>  | Index of the next initialized tick, if it exists within the SEARCH_LIMIT (256). |

### Prev initialized
```rust
pub fn prev_initialized(&self, tick: i32, tick_spacing: u16, pool_key: PoolKey) -> Option<i32> 
```

Returns the index of the previous initialized tick.

#### Input parameters

| Name          | Type    | Description                                                      |
| ------------- | ------- | ---------------------------------------------------------------- |
| tick          | i32     | Tick index to start searching from.                              |
| tick_spacing  | u16     | Distance between valid ticks.                                    |
| pool_key      | PoolKey | Key identifying the pool in which the tick should be looked for. |

#### Output parameters

| Type          | Description                                                                         |
| ------------- | ----------------------------------------------------------------------------------- |
| Option<i32\>  | Index of the previous initialized tick, if it exists within the SEARCH_LIMIT (256). |


```rust
pub fn get_closer_limit(
    &self,
    sqrt_price_limit: SqrtPrice,
    x_to_y: bool,
    current_tick: i32,
    tick_spacing: u16,
    pool_key: PoolKey,
) -> Result<(SqrtPrice, Option<(i32, bool)>), InvariantError>
```

Finds closest initialized tick in direction specified,
returns error if the initial and limiting ticks are identical.

#### Input parameters

| Name                  | Type      | Description                                                      |
| --------------------- | -------   | ---------------------------------------------------------------- |
| tick                  | i32       | Tick index to start searching from.                              |
| tick_spacing          | u16       | Distance between valid ticks.                                    |
| pool_key              | PoolKey   | Key identifying the pool in which the tick should be looked for. |
| x_to_y                | bool      | Direction of the search.                                         |
| sqrt_price_limit      | SqrtPrice | Price limit of the search.                                       |

#### Output parameters

| Type                                          | Description                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Result\<(SqrtPrice, Option\<(i32, bool)\>)\>  | Result of the search.                                                                                  |
| Result.0 (SqrtPrice)                          | Price corresponding to the tick that was found.                                                        |
| Result.1 (Option<(i32, bool)\>)               | Option containing the tick index, and a flag that signals if the tick with that index was initialized. |

### Get

```rust
pub fn get(&self, tick: i32, tick_spacing: u16, pool_key: PoolKey) -> bool
```
Returns the state of the tick.

#### Input parameters

| Name         | Type      | Description                                                      |
| -------------| -------   | ---------------------------------------------------------------- |
| tick         | i32       | Tick index to check.                                             |
| tick_spacing | u16       | Distance between valid ticks.                                    |
| pool_key     | PoolKey   | Key identifying the pool in which the tick should be looked for. |

#### Output parameters

| Type  | Description                                 |
| ----- | ------------------------------------------- |
| bool  | Flag indicating whether the tick is active. |

```rust
pub fn flip(&mut self, value: bool, tick: i32, tick_spacing: u16, pool_key: PoolKey) 
```
Changes the state of the tick.

#### Input parameters

| Name         | Type    | Description                                                      |
| -------------| ------- | ---------------------------------------------------------------- |
| value        | bool    | Value that the tick will be set to.                              |
| tick         | i32     | Tick index to update.                                            |
| tick_spacing | u16     | Distance between valid ticks.                                    |
| pool_key     | PoolKey | Key identifying the pool in which the tick should be looked for. |

#### Output parameters

| Type  | Description                                 |
| ----- | ------------------------------------------- |
| bool  | Flag indicating whether the tick is active. |