---
title: Collections

slug: /alephium/collections
---

This segment explores key storage structures that manage various entities within the Invariant Protocol. These collections play a crucial role in organizing and managing data in a structured manner, enhancing the overall functionality and performance of our contract. Within our collection interface, we enforce a tightly defined set of operations available for all data collections. Each collection implements the same basic functionality, allowing for consistent data management regardless of the underlying data structures (mappings or subcontracts).

## Positions

```rust
Abstract Contract Positions(clamm: CLAMM) extends PositionHelper(clamm) {...}

Contract Invariant(...) extends Positions(clamm), ...{
    ...
    mapping[ByteVec, Position] positions
    mapping[Address, U256] positionsCounter
    ...
}
```

The `Positions` Abstract Contract is designed to manage positions associated with different accounts. It uses a mapping data structure where each position is uniquely identified by the user's address and the index position within the user's position list. The provided functions allow you to add, update, remove, transfer, and retrieve positions and the number of positions associated with specific addresses. The CLAMM taken as input parameter is the address of our Concentrated Liquidity Automatic Market Maker Contract where calculations are done. This is designed as such due to the Contract bytecode size limitations.

| Type                                | Key                                                              | Value                                        |
| ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| mapping[ByteVec, Position] |  ByteVec containing the user's address and the index of a position.                  | Position struct holding the position's data.           |
| mapping[Address, U256] | User's address. | Number of the user's positions.   |


### Add Position

```rust
@using(preapprovedAssets = true)
fn wrappedAddPosition(caller: Address, payer: Address, position: Position) -> ();
```

Adds a new position to the caller's account.

#### Input parameters

| Name       | Type      | Description                                            |
| ---------- | --------- | ------------------------------------------------------ |
| caller | Address | The address of the user who will receive the position. |
| payer | Address | The address of the user who will pay for creating the contract (memory allocation). |
| position   | Position  | The Position struct with data.                         |


### Remove Position

```rust
fn wrappedRemovePosition(caller: Address, index: U256) -> ();
```

Removes a position at a specific index for the specified account.

#### Input parameters

| Name       | Type      | Description                                             |
| ---------- | --------- | ------------------------------------------------------- |
| caller | Address | The address of the user whose position will be removed. |
| index      | U256       | The index of an existing position of the user.          |

### Transfer Position

```rust
@using(preapprovedAssets = true)
fn wrappedTransferPosition(caller: Address, index: U256, newOwner: Address) -> ();
```

Transfers a position from one account to another. The fee for creating the contract is covered by the transferrer.

#### Input parameters

| Name       | Type      | Description                                                 |
| ---------- | --------- | ----------------------------------------------------------- |
| caller | Address | The address of the user whose position will be transferred. |
| index      | U256       | The index of an existing position of the user.              |
| newOwner   | Address | The address of the user who will receive the position.      |


### Get Position

:::info Option abstraction

The `(Bool, Struct)` tuple fulfils the same role as Rust's `Option` abstraction. Bool's state indicates whether the second parameter "is some?", in the case it is not a default value is passed and should not be used.

:::

```rust
fn wrappedGetPosition(owner: Address, index: U256) -> (Bool, Position);
```

Retrieves a position at a specific index for the specified account.  

#### Input parameters

| Name       | Type      | Description                                               |
| ---------- | --------- | --------------------------------------------------------- |
| owner | Address | The address of the user whose position will be returned. |
| index | U256 | The index of an existing position of the user.  |

#### Output parameters

| Type              | Description                                       |
| ----------------- | ------------------------------------------------- |
| Bool | If true the position was found and retrieved successfully, false otherwise.|
| Position| The user's position or an empty Position. |

### Get Number Of Positions

```rust
fn positionCount(caller: Address) -> U256;
```

Retrieves the number of positions associated with the specified account.

#### Input parameters

| Name       | Type      | Description                                                         |
| ---------- | --------- | ------------------------------------------------------------------- |
| caller | Address | The address of the user whose number of positions will be returned. |

#### Output parameters

| Type | Description                         |
| ---- | ----------------------------------- |
| U256  | The number of the user's positions. |

## Ticks

```rust
Abstract Contract Ticks() extends TickHelper() {...}

Contract Invariant(...) extends Ticks(), ...{
    ...
    mapping[ByteVec, Tick] ticks
    ...
}
```

The `Ticks` Abstract Contract is designed to manage ticks associated between different pools. It uses a mapping data structure, where each tick is identified by a tuple of `PoolKey` and `U256` (tick index), and a `Tick` object is stored as the associated value. The provided functions allow you to retrieve, add, update, and remove ticks associated with specific `PoolKey` values.

| Type                          | Key                                                         | Value                                |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| mapping[ByteVec, Tick] |  ByteVec containing the pool key and the tick index of a tick. | Tick struct holding the tick's data. |

### Add tick

```rust
@using(preapprovedAssets = true)
fn wrappedCreateTick(
    originalCaller: Address,
    poolKey: PoolKey,
    index: I256,
    ...
) -> ();
```

Adds a new tick associated with a specific pool key and index.

| Name  | Type    | Description                 |
| ----- | ------- | --------------------------- |
| originalCaller   | Address | The address of the user who created the position. They pay the deposit fee.    |
| poolKey   | PoolKey | Pool key of the pool.       |
| index | I256     | Index of a tick.            |
| ...  | Tick fields   | Refer to the [Tick struct](storage.md#tick). |

### Update tick

```rust
fn rewriteTick(poolKey: PoolKey, tick: Tick) -> ();
```

Updates an existing tick associated with a specific pool key and index.

#### Input parameters

| Name  | Type    | Description                 |
| ----- | ------- | --------------------------- |
| poolKey   | PoolKey | Pool key of the pool.       |
| tick  | Tick    | Tick struct with tick data. |

### Remove tick

```rust
fn removeTick(caller: Address, poolKey: PoolKey, index: I256) -> ();
```

Removes a tick associated with a specific pool key and index.

#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| poolKey   | PoolKey | Pool key of the pool. |
| index | I256     | Index of a tick.      |

### Get tick

:::info Option abstraction

The `(Bool, Struct)` tuple fulfils the same role as Rust's `Option` abstraction. Bool's state indicates whether the second parameter "is some?", in the case it is not a default value is passed and should not be used.

:::

```rust
fn wrappedGetTick(poolKey: PoolKey, index: I256) -> (Bool, Tick);
```

Retrieves a tick associated with a specific pool key and index.

#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| poolKey   | PoolKey | Pool key of the pool. |
| index | I256     | Index of a tick.      |

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| Bool | If true the tick was found and retrieved successfully, false otherwise. |
| Tick | Tick struct with tick data or an empty Tick. |

## Pools

```rust
Abstract Contract Pools(clamm: CLAMM) extends PoolKeyHelper(), PoolHelper(clamm) {...}

Contract Invariant(...) extends Pools(CLAMM), ...{
    ...
    mapping[ByteVec, Pool] pools
    ...
}
```

The `Pools` struct is designed to manage pools associated with different `PoolKey` values. It uses a mapping data structure, where each pool is identified by a unique `PoolKey`, and a `Pool` object is stored as the associated value. The provided functions allow you to add and retrieve pools associated with specific `PoolKey` values.

| Type                   | Key                               | Value                                 |
| ---------------------- | --------------------------------- | ------------------------------------- |
| mapping[PoolKey, Pool] | The pool key of a specified pool. | Pool struct holding the pool's data. |

### Add pool

```rust
@using(preapprovedAssets = true)
fn addPool(
    originalCaller: Address,
    poolKey: PoolKey,
    ...
) -> ();
```

Adds a new pool associated with the specified pool key. Throws an exception if a pool with the same pool key already exists.

#### Input parameters

| Name     | Type    | Description                 |
| -------- | ------- | --------------------------- |
| originalCaller     | Address    | The address of the user who created the pool. They pay the pool creation fee.|
| poolKey | PoolKey | Pool key of the pool.       |
| ...  | Pool fields   | Refer to the [Pool struct](storage.md#pool). |

### Get pool

:::info Option abstraction

The `(Bool, Struct)` tuple fulfils the same role as Rust's `Option` abstraction. Bool's state indicates whether the second parameter "is some?", in the case it is not a default value is passed and should not be used.

:::

```rust
fn wrappedGetPool(poolKey: PoolKey) -> (Bool, Pool);
```

Retrieves a pool associated with the specified pool key.

#### Input parameters

| Name     | Type    | Description           |
| -------- | ------- | --------------------- |
| poolKey | PoolKey | Pool key of the pool. |

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| Bool | If true the pool was found and retrieved successfully, false otherwise. |
| Pool | Pool struct with pool data. |

## Fee Tiers

```rust
struct FeeTiers {
    mut feeTiers: [FeeTier; 32]
}

Contract Invariant(mut feeTiers: FeeTiers, feeTierCount: U256, ...){
    const MaxFeeTiers = 32
}
```
The `FeeTiers` struct is designed to manage fee tiers. It utilizes an array of `FeeTier` objects. The provided functions allow you to add, retrieve, update, and remove fee tiers within the collection. You can perform operations on these fee tiers based on their index. The current highest index is stored in the `feeTierCount` variable. Our protocol stores at most 32 active fee tiers.

| Type                   | Value                                 |
| ---------------------- | ------------------------------------- |
| [FeeTier; 32] | FeeTier struct holding the fee tier's data. |

### Add fee tier

```rust
@using(updateFields = true, preapprovedAssets = true)
fn wrappedAddFeeTier(originalCaller: Address, feeTier: FeeTier) -> ();
```

Adds a new fee tier associated with the specified FeeTier. Throws an exception if fee tier already exist.

#### Input parameters

| Name | Type    | Description               |
| ---- | ------- | ------------------------- |
| originalCaller  | Address | Address of the user who wants to add a FeeTier. |
| feeTier  | FeeTier | Fee tier you want to add. |

### Remove fee tier

```rust
@using(updateFields = true)
fn wrappedRemoveFeeTier(originalCaller: Address, feeTier: FeeTier) -> ();
```

Removes a fee tier associated with the specified FeeTier. Throws an exception if fee tier cannot be found.

#### Input parameters

| Name | Type    | Description                  |
| ---- | ------- | ---------------------------- |
| originalCaller  | Address | Address of the user who wants to remove a FeeTier. |
| feeTier  | FeeTier | Fee tier you want to remove. |

### Contains fee tier

```rust
pub fn containsFeeTier(feeTier: FeeTier) -> Bool;
```

Verifies if specified fee tier exists.

#### Input parameters

| Name | Type    | Description                           |
| ---- | ------- | ------------------------------------- |
| feeTier  | FeeTier | Fee tier you want to check if exists. |

#### Output parameters

| Type | Description                                      |
| ---- | ------------------------------------------------ |
| bool | Bool value indicating if fee tier exists or not. |

### Get all fee tiers

```rust
pub fn getAllFeeTiers() -> ByteVec;
```

Retrieves all fee tiers.

#### Output parameters

| Type          | Description                    |
| ------------- | ------------------------------ |
| ByteVec | A ByteVec containing all fee tiers' data. |

## Pool Keys

```rust
Abstract Contract PoolKeys() {...}

Contract Invariant(mut poolKeyCount: U256) extends PoolKeys(), ...{
    ...
    mapping[U256, PoolKey] poolKeys
    ...
}
```

The `PoolKeys` struct is designed to manage pool keys. It utilizes a Mapping data structure, where each element corresponds to a different pool key represented by a `PoolKey` object. The provided functions allow you to add and retrieve pool keys within the collection. Each pool key is uniquely identified within the mapping, and you can perform operations on these pool keys based on their positions in the map.

| Type                   | Key                               | Value                                 |
| ---------------------- | --------------------------------- | ------------------------------------- |
| mapping[U256, PoolKey] | Index of a specified poolKey in the map. | The pool key of a specified pool. |

### Add pool key

```rust
@using(preapprovedAssets = true, updateFields = true)
fn addPoolKey(originalCaller: Address, poolKey: PoolKey) -> ();
```

Adds a new pool key. Throws an exception if pool key already exists.

#### Input parameters

| Name     | Type    | Description               |
| -------- | ------- | ------------------------- |
| originalCaller  | Address | Address of the user who wants to add a PoolKey. |
| poolKey | PoolKey | Pool key you want to add. |


### Contains pool key

```rust
fn containsPoolKey(poolKey: PoolKey) -> Bool;
```

Verifies if specified pool key exist.

#### Input parameters

| Name     | Type    | Description                           |
| -------- | ------- | ------------------------------------- |
| poolKey | PoolKey | The pool key you want to check if exists. |

#### Output parameters

| Type | Description                                      |
| ---- | ------------------------------------------------ |
| bool | Bool value indicating if pool key exists or not. |

### Get all pool keys

```rust
fn getAllPoolKeys() -> ByteVec;
```

Retrieves all pool keys.

#### Output parameters

| Type          | Description                    |
| ------------- | ------------------------------ |
| ByteVec | A ByteVec containing all pool keys' data. |

## Tickmap

```rust
Abstract Contract Tickmap() extends Decimal(), BatchHelper() {...}

Contract Invariant(...) extends Tickmap(), ...{
    ...
    mapping[ByteVec, TickmapBatch] bitmap
    ...
}
```

The `Tickmap` Abstract Contract is designed to aid efficient traversal over ticks in a Pool. It utilizes a mapping data structure where each pool is identified by a `PoolKey` and `TickmapBatch` index. Due to the data storage limits of a single Contract, a Pool's tickmap is divided into several `TickmapBatch`es and further divided into chunks. One batch consists of 94 chunks, each storing information about the initialization state of 256 ticks. The maximum size of a `Tickmap` is affected by the `tickSpacing` parameter of the `FeeTier`. The higher the tick spacing the less Contracts the tickmap employs.

| Type                   | Key                               | Value                                 |
| ---------------------- | --------------------------------- | ------------------------------------- |
| mapping[ByteVec, TickmapBatch] | The pool key of a specified pool and `TickmapBatch` index. | TickmapBatch struct holding the chunks' data. |

### Get Tick's position

```rust
pub fn tickToPosition(tick: I256, tickSpacing: U256) -> (U256, U256);
```

Calculates where tick's bit will be located.

#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| tick   | I256 | Index of a tick.|
| tickSpacing | U256     | The spacing between initializable ticks.|

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| U256 | Index of the chunk. |
| U256 | Index of the bit in a chunk. |


### Get Chunk

```rust
fn getChunk(chunk: U256, poolKey: PoolKey) -> U256;
```

Retrieve chunk's data.

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| chunk   | U256 | Index of a chunk.|
| poolKey | poolKey     | The pool key of a specified pool.|

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| U256 | The chunk's bits. |

### Flip bit utility

```rust
fn flipBitAtPosition(value: U256, position: U256) -> U256;
```

Flips bit in value at position.

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| value   | U256 | The value in which we flip a bit.|
| position | U256     | The position of a bit to set.|

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| U256 | `value` with the specified bit flipped. |

### Contains initialized tick

```rust
pub fn getBit(tick: I256, poolKey: PoolKey) -> Bool;
```

Retrieves the state of the exact bit representing the initialization state of a tick (1 - initialized, 0 - uninitialized).


#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| tick   | I256 | Index of a tick.|
| poolKey | poolKey     | The pool key of a specified pool.|

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| Bool | State of the tick, `true` if initialized. |

## Reserves

```rust
Abstract Contract Reserves() {...}

Contract Invariant(...) extends Reserves(), ...{
    ...
    mapping[ByteVec, ByteVec] reserves
    ...
}
```

The `Reserves` Abstract Contract is designed to overcome the challenge of being able to store a limited number of assets (tokens) in a single contract. It utilizes a mapping data structure where each token's `Reserve`'s location is identified by the id of a given asset. The need to introduce a collection like this is due to the limited number of assets a single UTXO can store, currently 8. Each Contract has a single UTXO. We went with this design because if both tokens for a trading pair are already in a reserve users pay only for storage of trading pair specific information.

| Type                   | Key                               | Value                                 |
| ---------------------- | --------------------------------- | ------------------------------------- |
| mapping[ByteVec, ByteVec] | The ContractId of a given token. | The Contract ID of the reserve containing the given token. |

### Add reserve

```rust
@using(updateFields = true, preapprovedAssets = true)
fn initReserve(caller: Address, reservePath: ByteVec, assetsToStore: U256) -> ByteVec;
```

Adds a new `Reserve` and instantly registers `assetsToStore` assets.

#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| caller   | Address | Address of the user who wants to create a reserve. They pay the allocation fee.|
| reservePath | ByteVec     | Unique identifier to be used for the new Subcontract. Usually contractId of one of the tokens.|
| assetsToStore | U256     | The number of assets that will be stored inside the reserve.|

#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| ByteVec | ContractId of the Reserve. |

### Get both reserves

:::warning Token sorting

This function employs the token[X|Y] naming convention, indicating that arranging these tokens in ascending order by `contractId` is necessary.

:::

```rust
@using(updateFields = true, preapprovedAssets = true)
fn handleReserves(caller: Address, tokenX: ByteVec, tokenY: ByteVec) -> (ByteVec, ByteVec);
```

Retrieves the ids of `Reserve`s for both tokens. If a token isn't stored in a Reserve yet allocates space for it.

#### Input parameters

| Name  | Type    | Description           |
| ----- | ------- | --------------------- |
| caller   | Address | Address of the user who wants to know where the Token is or will be stored. They are required to pay the eventual fee.|
| tokenX | ByteVec     | Id of the first token.|
| tokenY | ByteVec     | Id of the second token.|


#### Output parameters

| Type | Description                 |
| ---- | --------------------------- |
| ByteVec | ContractId of tokenX's reserve. |
| ByteVec | ContractId of tokenY's reserve. |
