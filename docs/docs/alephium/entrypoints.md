---
title: Entrypoints

slug: /alephium/entrypoints
---

This section outlines the core entrypoints for the Invariant smart contract, providing developers with essential methods to interact with the protocol. These entrypoints cover various aspects of the contract, including protocol fee management, fee tier administration, pool creation and management, position handling, and swap functionality.

## Constructor

```rust
Contract Invariant(
    mut config: InvariantConfig,
    clamm: CLAMM,
    reserveTemplateId: ByteVec,
    mut lastReserveId: ByteVec,
    mut feeTierCount: U256,
    mut poolKeyCount: U256
) extends PoolKeyHelper(), Decimal(), PoolKeys(), Pools(clamm),
     Ticks(), Tickmap(), Positions(clamm), FeeTierHelper(), Reserves();
```

This constructor method initializes the contract with the specified protocol fee and administrator.

#### Input parameters

| Name         | Type       | Description                          |
| ------------ | ---------- | ------------------------------------ |
| config | InvariantConfig | Config struct defining the admin and protocol fee. |
| clamm | CLAMM | ContractId of the CLAMM module. |
| reserveTemplateId | ByteVec | ContractId of a Reserve Contract. |
| lastReserveId | ByteVec | ContractId of the same Reserve Contract. |
| feeTierCount | U256 | Should be initialized to 0. |
| poolKeyCount | U256 | Should be initialized to 0. |


## Protocol fee

### Get protocol fee

```rust
pub fn getProtocolFee() -> U256;
```

This method retrieves the current protocol fee percentage.

#### Output parameters

| Type       | Description               |
| ---------- | ------------------------- |
| U256 | The current protocol fee. |

### Withdraw protocol fee

:::note Fee receiver only

This action is only available to the fee receiver.

:::

```rust
pub fn withdrawProtocolFee(poolKey: PoolKey) -> ();
```

This operation enables the withdrawal of protocol fees associated with a specific pool, based on the provided pool key. The withdrawn funds are sent to the fee receiver wallet.

#### Input parameters

| Name     | Type    | Description                                                                       |
| -------- | ------- | --------------------------------------------------------------------------------- |
| poolKey | PoolKey | The pool key that corresponds to the withdrawal of fees from the associated pool. |

#### Errors

| Code             | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `PoolNotFound` | Reverts the call when a pool associated with the poolKey doesn't exist. |
| `NotFeeReceiver` | Reverts the call when the caller is unauthorized receiver. |

### Change protocol fee

:::note Administrator only

This action is only available to the administrator.

:::

```rust
@using(updateFields = true)
pub fn changeProtocolFee(newProtocolFee: U256) -> ();
```

This function allows for the adjustment of the current protocol fee percentage.

#### Input parameters

| Name         | Type       | Description                      |
| ------------ | ---------- | -------------------------------- |
| newProtocolFee | U256 | The new protocol fee percentage. |

#### Errors

| Code       | Description                                               |
| ---------- | --------------------------------------------------------- |
| `PoolNotFound` | Reverts the call when a pool associated with the poolKey doesn't exist. |
| `NotAdmin` | Reverts the call when the caller is an unauthorized user. |

### Change fee receiver

:::note Administrator only

This action is only available to the administrator.

:::

```rust
pub fn changeFeeReceiver(poolKey: PoolKey, newFeeReceiver: Address) -> ();
```

This function allows for the modification of the fee receiver of a pool.

#### Input parameters

| Name         | Type      | Description                                              |
| ------------ | --------- | -------------------------------------------------------- |
| poolKey     | PoolKey   | The pool key of the pool where the change is to be made. |
| newFeeReceiver | Address | The new fee receiver's address of the pool.              |

#### Errors

| Code       | Description                                            |
| ---------- | ------------------------------------------------------ |
| `NotAdmin` | Reverts the call when the caller is unauthorized user. |

## Fee tier

### Add fee tier

:::note Administrator only

This action is only available to the administrator.

:::

```rust
@using(preapprovedAssets = true, updateFields = true)
pub fn addFeeTier(feeTier: FeeTier) -> ();
```

This function enables the addition of a new fee tier, which users can subsequently utilize when creating pools. Up to 32 fee tiers can exist.

#### Input parameters

| Name     | Type    | Description               |
| -------- | ------- | ------------------------- |
| feeTier | FeeTier | The fee tier to be added. |

#### Errors

| Code                  | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `NotAdmin`            | Fails if an unauthorized user attempts to create a fee tier. |
| `InvalidTickSpacing`  | Fails if the tick spacing is invalid.                        |
| `FeeTierAlreadyExist` | Fails if the fee tier already exists.                        |
| `InvalidFee`          | Fails if fee is invalid.                                     |
| `FeeTierLimitReached` | Fails if the maximal number of fee tiers (32) already exists.|


### Fee Tier exists

```rust
pub fn feeTierExist(feeTier: FeeTier) -> Bool;
```

This function is used to verify the existence of a specified fee tier.

#### Input parameters

| Name | Type    | Description                                                       |
| ---- | ------- | ----------------------------------------------------------------- |
| feeTier  | FeeTier | The key associated with the fee tier to be checked for existence. |

#### Output parameters

| Type | Description                                  |
| ---- | -------------------------------------------- |
| Bool | Boolean indicating if the fee tier exists. |

### Get fee tiers

```rust
pub fn getFeeTiers() -> ByteVec;
```

Retrieves available fee tiers.

#### Output parameters

| Type          | Description                                             |
| ------------- | ------------------------------------------------------- |
| ByteVec | ByteVec containing all fee tiers. |

### Remove fee tier

:::note Administrator only

This action is only available to the administrator.

:::

```rust
pub fn removeFeeTier(feeTier: FeeTier) -> ();
```

This function removes a fee tier based on the provided fee tier key. After removal, the fee tier will no longer be available for use in pool creation. It is important to note that existing pools with that fee tier will remain unaffected.

#### Input parameters

| Name | Type    | Description                                         |
| ---- | ------- | --------------------------------------------------- |
| feeTier  | FeeTier | The key associated with the fee tier to be removed. |

#### Errors

| Code              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `NotAdmin`        | Fails if an unauthorized user attempts to create a fee tier. |
| `FeeTierNotFound` | Fails if fee tier does not exist.                            |

## Pools

### Create pool

:::tip Permission-less

_Anyone_ can add a pool and **no permissions are needed**.

:::

:::warning token standard

The tokens are expected to use Alephium's [Fungible Token Standard](https://docs.alephium.org/dapps/standards/fungible-tokens#fungible-token-standard). 

While not required, consider also adding them to the official [Token List](https://docs.alephium.org/dapps/standards/fungible-tokens/#token-list).

:::

:::info token sorting

This function employs the token[0|1] naming convention, indicating that arranging these tokens in ascending order by `contractId` is not necessary.

:::

```rust
@using(preapprovedAssets = true, checkExternalCaller = false)
pub fn createPool(token0: ByteVec, token1: ByteVec, feeTier: FeeTier, initSqrtPrice: U256, initTick: I256) -> ();
```

This function creates a pool based on a pair of tokens and the specified fee tier. Only one pool can exist with an unique combination of two tokens and a fee tier.

#### Input parameters

| Name            | Type      | Description                                                            |
| --------------- | --------- | ---------------------------------------------------------------------- |
| token0 | ByteVec   | Contract ID of the first token in the pair.|
| token1         | ByteVec | Contract ID of the second token in the pair.                         |
| feeTier        | FeeTier   | The fee tier to be applied.                                            |
| initSqrtPrice | U256 | The square root of the price for the initial pool related to initTick. |
| initTick       | I256       | The initial tick value for the pool.                                   |

#### Errors

| Code                   | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `FeeTierNotFound`      | Fails if the specified fee tier cannot be found.                 |
| `TokensAreSame`        | Fails if the user attempts to create a pool for the same tokens. |
| `PoolKeyAlreadyExist`     | Fails if Pool with same tokens and fee tier already exist.       |
| `InvalidTickSpacing`      | Fails if the init tick is not divisible by the tick spacing.     |
| `InvalidTickIndex` | Fails if the init tick is outside of the Min <= Init <= Max tick index range. |
| `TickAndSqrtPriceMismatch` | Fails if the init sqrt price is not related to the init tick.    |

### Get pool

:::info Option abstraction

The `(Bool, Struct)` tuple fulfils the same role as Rust's `Option` abstraction. Bool's state indicates whether the second parameter "is some?", in the case it is not a default value is passed and should not be used.

:::

```rust
pub fn getPool(poolKey: PoolKey) -> (Bool, Pool);
```

This function retrieves a pool based on PoolKey. It returns false as the first tuple variable if the pool does not exist.

#### Input parameters

| Name     | Type      | Description                                    |
| -------- | --------- | ---------------------------------------------- |
| poolKey | PoolKey   | The pool key of the pool you want to retrieve. |

#### Output parameters

| Type | Description                    |
| ---- | ------------------------------ |
| Bool | If true the pool was found and retrieved successfully, false otherwise.|
| Pool | A struct containing pool data. |

### Get pools for a token pair

:::info token sorting

This function employs the token[0|1] naming convention, indicating that arranging these tokens in ascending order by `contractId` is not necessary.

:::

```rust
pub fn getAllPoolsForPair(token0: ByteVec, token1: ByteVec) -> ByteVec;
```

This function retrieves all pools for the given token pair.

#### Input parameters

| Name     | Type      | Description                                    |
| -------- | --------- | ---------------------------------------------- |
| token0 | ByteVec   | Contract ID of the first token in the pair.|
| token1 | ByteVec   | Contract ID of the second token in the pair.|


#### Output parameters

| Type          | Description                                            |
| ------------- | ------------------------------------------------------ |
| ByteVec | ByteVec containing all pools for a given key pair that indicate all pools listed. |

## Position

### Create position

```rust
@using(preapprovedAssets = true, checkExternalCaller = false)
pub fn createPosition(
    poolKey: PoolKey,
    lowerTickIndex: I256,
    upperTickIndex: I256,
    liquidityDelta: U256,
    slippageLimitLower: U256,
    slippageLimitUpper: U256
) -> ();
```

This function creates a position based on the provided parameters. The amount of tokens specified in liquidity delta will be deducted from the user's token balances. Position creation will fail if the user does not have enough tokens or has not approved enough tokens.

#### Input parameters

| Name                 | Type      | Description                                                           |
| -------------------- | --------- | --------------------------------------------------------------------- |
| poolKey             | PoolKey   | The pool key for which you want to create a position.                 |
| lowerTick           | I256       | The lower tick index of your position.                                      |
| upperTick           | I256       | The upper tick index of your position.                                      |
| liquidityDelta      | U256 | The liquidity you want to provide.                                    |
| slippageLimitLower | U256 | The lower limit determined by the square root of the price, which cannot be exceeded by the current `sqrtPrice` in the pool. |
| slippageLimitUpper | U256 | The upper limit determined by the square root of the price, which cannot be exceeded by the current `sqrtPrice` in the pool. |


#### Errors

| Code                            | Description                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `ZeroLiquidity`                 | Fails if the user attempts to open a position with zero liquidity.                         |
| `InvalidTickIndex` | Fails if the user attempts to create a position with invalid tick indexes. |
| `InvalidTickSpacing` | Fails if the user attempts to create a position with invalid tick spacing. |
| `PriceLimitReached`             | Fails if the price has reached the slippage limit.                                         |
| `PoolNotFound`                  | Fails if pool does not exist.                                                              |

### Transfer position

```rust
@using(preapprovedAssets = true, checkExternalCaller = false)
pub fn transferPosition(index: U256, newOwner: Address) -> ();
```

This function changes ownership of an existing position based on the position index in the user's position list. You can only change ownership of positions that you own; otherwise, it will return an error.

#### Input parameters

| Name     | Type      | Description                                        |
| -------- | --------- | -------------------------------------------------- |
| index    | U256       | Index of the position in the user's position list. |
| newOwner | Address | Address of the user who will receive the position. |

#### Errors

| Code                            | Description                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `PositionNotFound`                 | Fails if position does not exist.                        |

### Remove position

```rust
@using(checkExternalCaller = false)
pub fn removePosition(index: U256) -> ();
```

This function removes a position from the user's position list and transfers the tokens in the position and all generated unclaimed fees to the user's address.

#### Input parameters

| Name  | Type | Description                                        |
| ----- | ---- | -------------------------------------------------- |
| index | U256  | Index of the position in the user's position list. |

#### Errors

| Code               | Description                        |
| ------------------ | ---------------------------------- |
| `PositionNotFound` | Fails if Position cannot be found. |

### Claim fee

```rust
@using(checkExternalCaller = false)
pub fn claimFee(index: U256) -> ();
```

This function allows the user to claim fees from an existing position. Tokens will be sent to the user's address.

#### Input parameters

| Name  | Type | Description                                        |
| ----- | ---- | -------------------------------------------------- |
| index | U256  | Index of the position in the user's position list. |

#### Errors

| Code               | Description                        |
| ------------------ | ---------------------------------- |
| `PositionNotFound` | Fails if Position cannot be found. |

### Get position

:::info Option abstraction

The `(Bool, Struct)` tuple fulfils the same role as Rust's `Option` abstraction. Bool's state indicates whether the second parameter "is some?", in the case it is not a default value is passed and should not be used.

:::

```rust
pub fn getPosition(owner: Address, index: U256) -> (Bool, Position);
```

This function returns false as the first tuple variable and an empty `Position` as the second if the position does not exist.

#### Input parameters

| Name     | Type      | Description                                              |
| -------- | --------- | -------------------------------------------------------- |
| owner | Address | An Address identifying the user who owns the position. |
| index    | U256       | Index of the position in the user's position list.       |

#### Output parameters

| Type                               | Description                                           |
| ---------------------------------- | ----------------------------------------------------- |
| Bool | If true the position was found and retrieved successfully, false otherwise.|
| Position | A struct containing position data. |

<!-- ### Get all positions

```rust
#[ink(message)]
pub fn get_all_positions(&mut self, owner_id: AccountId) -> Vec<Position>;
```

This function returns a list of positions owned by the caller. The list will be empty if you do not have any positions.

#### Input parameters

| Name     | Type      | Description                                              |
| -------- | --------- | -------------------------------------------------------- |
| owner_id | AccountId | An AccountId identifying the user who own the positions. |

#### Output parameters

| Type           | Description                             |
| -------------- | --------------------------------------- |
| Vec<Position\> | A list containing the user's positions. | -->

## Swap

### Swap

```rust
@using(preapprovedAssets = true, checkExternalCaller = false)
pub fn swap(
    poolKey: PoolKey,
    xToY: Bool,
    amount: U256,
    byAmountIn: Bool,
    sqrtPriceLimit: U256
) -> CalculateSwapResult
```

This function executes a swap based on the provided parameters. It transfers tokens from the user's address to the contract's address and vice versa. The swap will fail if the user does not have enough tokens, the swap limit is exceeded, has not approved enough tokens, or if there is insufficient liquidity.

#### Input parameters

| Name             | Type        | Description                                                                             |
| ---------------- | ----------- | --------------------------------------------------------------------------------------- |
| poolKey         | PoolKey     | Pool key of the pool on which you wish to perform the swap.                             |
| xToY           | Bool        | Specifies the direction of the swap. If `true` swap from the Token with lower `ContractId` to the one with higher, else the other way around.|
| amount           | U256 | Amount of tokens you want to receive or give.                                           |
| byAmountIn     | Bool        | Indicates whether the entered amount represents the tokens you wish to receive or give. |
| sqrtPriceLimit | U256   | If the swap achieves this square root of the price, it will be canceled.                |

#### Output parameters

| Type                | Description                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CalculateSwapResult | A struct containing the amount in and amount out with starting and target square root of price, taken fee, pool. |

#### Errors

| Code                | Description                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ZeroAmount`      | Fails if the user attempts to perform a swap with zero amounts.                                                     |
| `WrongPriceLimit` | Fails if the square root of price or price limit is set incorrectly. Usually happens due to setting the wrong direction of the swap. |
| `PriceLimitReached` | Fails if the price has reached the specified price limit (or price associated with specified square root of price). |
| `TickLimitReached` | Fails if the tick index has reached the global tick limit. |
| `NoGainSwap`        | Fails if the user would receive zero tokens.                                                                        |
| `PoolNotFound`      | Fails if pool does not exist.                                                                                       |

### Quote

```rust
    @using(checkExternalCaller = false)
    pub fn quote(
        poolKey: PoolKey,
        xToY: Bool,
        amount: U256,
        byAmountIn: Bool,
        sqrtPriceLimit: U256
    ) -> QuoteResult;
```

This function performs a simulation of a swap based on the provided parameters and returns the simulation results. It does not involve any actual token transfers.

#### Input parameters

| Name             | Type        | Description                                                                             |
| ---------------- | ----------- | --------------------------------------------------------------------------------------- |
| poolKey         | PoolKey     | Pool key of the pool on which you wish to perform the swap.                             |
| xToY           | Bool        | Specifies the direction of the swap. If `true` swap from the Token with lower `ContractId` to the one with higher, else the other way around.|
| amount           | U256 | Amount of tokens you want to receive or give.                                           |
| byAmountIn     | Bool        | Indicates whether the entered amount represents the tokens you wish to receive or give. |
| sqrtPriceLimit | U256   | If the swap achieves this square root of the price, it will be canceled.                |

#### Output parameters

| Type        | Description                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QuoteResult | A struct containing amount of tokens received, amount of tokens given and square root of price after the simulated swap. |

#### Errors

| Code                | Description                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ZeroAmount`      | Fails if the user attempts to perform a swap with zero amounts.                                                     |
| `WrongPriceLimit` | Fails if the square root of price or price limit is set incorrectly. Usually happens due to setting the wrong direction of the swap. |
| `PriceLimitReached` | Fails if the price has reached the specified price limit (or price associated with specified square root of price). |
| `TickLimitReached` | Fails if the tick index has reached the global tick limit. |
| `NoGainSwap`        | Fails if the user would receive zero tokens.                                                                        |
| `PoolNotFound`      | Fails if pool does not exist.                                                                                       |

## Tick

### Get tick

:::info Option abstraction

The `(Bool, Struct)` tuple fulfils the same role as Rust's `Option` abstraction. Bool's state indicates whether the second parameter "is some?", in the case it is not a default value is passed and should not be used.

:::

```rust
pub fn getTick(poolKey: PoolKey, index: I256) -> (Bool, Tick);
```

Retrieves information about a tick at a specified index. If the tick cannot be found a `(false, Tick)` tuple is returned with empty `Tick` in the second parameter.

#### Input parameters

| Name  | Type    | Description                                      |
| ----- | ------- | ------------------------------------------------ |
| poolKey   | PoolKey | A unique key that identifies the specified pool. |
| index | I256     | The tick index.                   |

#### Output parameters

| Type | Description                    |
| ---- | ------------------------------ |
| Tick | A struct containing tick data. |
| Bool | If `true` the tick was found and retrieved successfully, false otherwise.|


### Is tick initialized

```rust
pub fn isTickInitialized(poolKey: PoolKey, index: I256) -> Bool;
```

Retrieves the initialization state of a tick.

#### Input parameters

| Name  | Type    | Description                                      |
| ----- | ------- | ------------------------------------------------ |
| poolKey   | PoolKey | A unique key that identifies the specified pool. |
| index | I256     | The tick index.|

#### Output parameters

| Type | Description                                                |
| ---- | ---------------------------------------------------------- |
| Bool | If `true` - initialized, if `false` - uninitialized. |

<!-- ### Get position ticks

```rust
#[ink(message)]
fn get_position_ticks(&self, owner: AccountId, offset: u32) -> Vec<PositionTick>;
```

Retrieves list of lower and upper ticks of user positions.

#### Input parameters

| Name   | Type      | Description                                                |
| ------ | --------- | ---------------------------------------------------------- |
| owner  | AccountId | An `AccountId` identifying the user who owns the position. |
| offset | u32       | The offset from the current position index.                |

#### Output parameters

| Type               | Description                                |
| ------------------ | ------------------------------------------ |
| Vec<PositionTick/> | Vector containing ticks of user positions. | -->

<!-- ### Get user positions amount

```rust
#[ink(message)]
fn get_user_position_amount(&self, owner: AccountId) -> u32;
```

Retrieves the amount of positions held by the user.

#### Input parameters

| Name  | Type      | Description                                                |
| ----- | --------- | ---------------------------------------------------------- |
| owner | AccountId | An `AccountId` identifying the user who owns the position. |

#### Output parameters

| Type | Description               |
| ---- | ------------------------- |
| u32  | Number of user positions. | -->

<!-- ### Get liquidity ticks

```rust
#[ink(message)]
fn get_liquidity_ticks(&self, pool_key: PoolKey, offset: u16) -> Vec<LiquidityTick>;
```

Retrieves ticks of a specified pool.

#### Input parameters

| Name     | Type    | Description                                      |
| -------- | ------- | ------------------------------------------------ |
| pool_key | PoolKey | A unique key that identifies the specified pool. |
| offset   | u16     | The offset from which ticks will be retrieved.   |

#### Output parameters

| Type                | Description                                |
| ------------------- | ------------------------------------------ |
| Vec<LiquidityTick/> | Vector containing ticks of specified pool. | -->

<!-- ### Get liquidity ticks amount

```rust
#[ink(message)]
fn get_liquidity_ticks_amount(&self, pool_key: PoolKey) -> u32;
```

Retrieves the amount of liquidity ticks of a specified pool.

#### Input parameters

| Name     | Type    | Description                                      |
| -------- | ------- | ------------------------------------------------ |
| pool_key | PoolKey | A unique key that identifies the specified pool. |

#### Output parameters

| Type | Description                          |
| ---- | ------------------------------------ |
| u32  | Number of ticks on a specified pool. | -->

## Tickmap

### Get tickmap

```rust
pub fn getTickmapSlice(poolKey: PoolKey, lowerBatch: U256, upperBatch: U256, xToY: Bool) -> ByteVec
```

Retrieves a slice of tickmap batches for a specified pool. The value of `lowerBatch` should be less than `upperBatch`.

#### Input parameters

| Name        | Type    | Description                                      |
| ----------- | ------- | ------------------------------------------------ |
| pool_key    | PoolKey | A unique key that identifies the specified pool. |
| lowerBatch | U256     | Index of the lower tickmap batch.                |
| upperBatch | U256     | Index of the upper tickmap batch.                |
| xToY | Bool | If `xToY` is `true` return batches from `lowerBatch` to `upperBatch`, else the other way around.

#### Output parameters

| Type            | Description                                       |
| --------------- | ------------------------------------------------- |
| ByteVec| ByteVec containing tickmap chunk index and value. |
