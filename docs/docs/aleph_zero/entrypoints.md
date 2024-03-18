---
title: Entrypoints

slug: /aleph_zero/entrypoints
---

This section outlines the core entrypoints for the Invariant smart contract, providing developers with essential methods to interact with the protocol. These entrypoints cover various aspects of the contract, including protocol fee management, fee tier administration, pool creation and management, position handling, and swap functionality.

## Constructor

```rust
#[ink(constructor)]
pub fn new(protocol_fee: Percentage) -> Self;
```

This constructor method initializes the contract with the specified protocol fee. The administrator role is assigned to the caller.

#### Input parameters

| Name         | Type       | Description                          |
| ------------ | ---------- | ------------------------------------ |
| protocol_fee | Percentage | The percentage for the protocol fee. |

## Protocol fee

### Get protocol fee

```rust
#[ink(message)]
pub fn get_protocol_fee(&self) -> Percentage;
```

This method retrieves the current protocol fee percentage.

#### Output parameters

| Type       | Description               |
| ---------- | ------------------------- |
| Percentage | The current protocol fee. |

### Withdraw protocol fee

```rust
#[ink(message)]
pub fn withdraw_protocol_fee(&mut self, pool_key: PoolKey) -> Result<(), InvariantError>;
```

This operation enables the withdrawal of protocol fees associated with a specific pool, based on the provided pool key. The withdrawn funds are sent to the fee receiver wallet. Please note that this action can only be performed by fee receiver.

#### Input parameters

| Name     | Type    | Description                                                                       |
| -------- | ------- | --------------------------------------------------------------------------------- |
| pool_key | PoolKey | The pool key that corresponds to the withdrawal of fees from the associated pool. |

#### Errors

| Code             | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `NotFeeReceiver` | Reverts the call when the caller is unauthorized receiver. |

#### External Contracts

- PSP22

### Change protocol fee

```rust
#[ink(message)]
pub fn change_protocol_fee(&mut self, protocol_fee: Percentage) -> Result<(), InvariantError>;
```

This function allows for the adjustment of the current protocol fee percentage. Note that this operation is restricted to administrators.

#### Input parameters

| Name         | Type       | Description                      |
| ------------ | ---------- | -------------------------------- |
| protocol_fee | Percentage | The new protocol fee percentage. |

#### Errors

| Code       | Description                                               |
| ---------- | --------------------------------------------------------- |
| `NotAdmin` | Reverts the call when the caller is an unauthorized user. |

### Change fee receiver

```rust
#[ink(message)]
pub fn change_fee_receiver(
    &mut self,
    pool_key: PoolKey,
    fee_receiver: AccountId,
) -> Result<(), InvariantError>;
```

This function allows for the modification of the fee receiver of a pool. Please note that this action is exclusively available to administrators.

#### Input parameters

| Name         | Type      | Description                                              |
| ------------ | --------- | -------------------------------------------------------- |
| pool_key     | PoolKey   | The pool key of the pool where the change is to be made. |
| fee_receiver | AccountId | The new fee receiver's address of the pool.              |

#### Errors

| Code       | Description                                            |
| ---------- | ------------------------------------------------------ |
| `NotAdmin` | Reverts the call when the caller is unauthorized user. |

## Fee tier

### Add fee tier

```rust
#[ink(message)]
pub fn add_fee_tier(&mut self, fee_tier: FeeTier) -> Result<(), InvariantError>;
```

This function enables the addition of a new fee tier, which users can subsequently utilize when creating pools. Please note that this action is restricted to administrators.

#### Input parameters

| Name     | Type    | Description               |
| -------- | ------- | ------------------------- |
| fee_tier | FeeTier | The fee tier to be added. |

#### Errors

| Code                  | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `NotAdmin`            | Fails if an unauthorized user attempts to create a fee tier. |
| `InvalidTickSpacing`  | Fails if the tick spacing is invalid.                        |
| `FeeTierAlreadyExist` | Fails if the fee tier already exists.                        |
| `InvalidFee`          | Fails if fee is invalid.                                     |

### Fee Tier exist

```rust
#[ink(message)]
pub fn fee_tier_exist(&self, key: FeeTier) -> bool;
```

This function is used to verify the existence of a specified fee tier.

#### Input parameters

| Name | Type    | Description                                                       |
| ---- | ------- | ----------------------------------------------------------------- |
| key  | FeeTier | The key associated with the fee tier to be checked for existence. |

#### Output parameters

| Type | Description                                  |
| ---- | -------------------------------------------- |
| bool | boolean indicating if the fee tier is added. |

### Get fee tiers

```rust
#[ink(message)]
pub fn get_fee_tiers(&self, key: FeeTier) -> Vec<FeeTier>;
```

Retrieves available fee tiers.

#### Input parameters

| Name | Type    | Description                                                       |
| ---- | ------- | ----------------------------------------------------------------- |
| key  | FeeTier | The key associated with the fee tier to be checked for existence. |

#### Output parameters

| Type          | Description                                             |
| ------------- | ------------------------------------------------------- |
| Vec<FeeTier\> | Vector containing all fee tiers added to specified pool |

### Remove fee tier

```rust
#[ink(message)]
pub fn remove_fee_tier(&mut self, key: FeeTier) -> Result<(), InvariantError>;
```

This function removes a fee tier based on the provided fee tier key. After removal, the fee tier will no longer be available for use in pool creation. It's important to note that existing pools with that fee tier will remain unaffected. This action is exclusively available to administrators.

#### Input parameters

| Name | Type    | Description                                         |
| ---- | ------- | --------------------------------------------------- |
| key  | FeeTier | The key associated with the fee tier to be removed. |

#### Errors

| Code              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `NotAdmin`        | Fails if an unauthorized user attempts to create a fee tier. |
| `FeeTierNotFound` | Fails if fee tier does not exist.                            |

## Pools

### Create pool

```rust
#[ink(message)]
pub fn create_pool(
    &mut self,
    token_0: AccountId,
    token_1: AccountId,
    fee_tier: FeeTier,
    init_sqrt_price: SqrtPrice
    init_tick: i32,
) -> Result<(), InvariantError>;
```

This function creates a pool based on a pair of tokens and the specified fee tier. The order of the tokens is irrelevant, and only one pool can exist with a specific combination of two tokens and a fee tier.

#### Input parameters

| Name            | Type      | Description                                                            |
| --------------- | --------- | ---------------------------------------------------------------------- |
| token_0         | AccountId | Address of the first PSP22 token in the pair.                          |
| token_1         | AccountId | Address of the second PSP22 token in the pair.                         |
| fee_tier        | FeeTier   | The fee tier to be applied.                                            |
| init_sqrt_price | SqrtPrice | The square root of the price for the initial pool related to init_tick |
| init_tick       | i32       | The initial tick value for the pool.                                   |

#### Errors

| Code                   | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `FeeTierNotFound`      | Fails if the specified fee tier cannot be found.                 |
| `TokensAreSame`        | Fails if the user attempts to create a pool for the same tokens. |
| `PoolAlreadyExist`     | Fails if Pool with same tokens and fee tier already exist.       |
| `InvalidInitTick`      | Fails if the init tick is not divisible by the tick spacing.     |
| `InvalidInitSqrtPrice` | Fails if the init sqrt price is not related to the init tick.    |

### Get pool

```rust
#[ink(message)]
pub fn get_pool(
    &self,
    token_0: AccountId,
    token_1: AccountId,
    fee_tier: FeeTier,
) -> Result<Pool, InvariantError>;
```

This function retrieves a pool based on two tokens and the specified fee tier. It returns an error if the pool does not exist.

#### Input parameters

| Name     | Type      | Description                                    |
| -------- | --------- | ---------------------------------------------- |
| token_0  | AccountId | Address of the first token in the pair.        |
| token_1  | AccountId | Address of the second token in the pair.       |
| fee_tier | FeeTier   | The fee tier of the pool you want to retrieve. |

#### Output parameters

| Type | Description                    |
| ---- | ------------------------------ |
| Pool | A struct containing pool data. |

#### Errors

| Code            | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| `PoolNotFound`  | Fails if there is no pool associated with created key.           |
| `TokensAreSame` | Fails if the user attempts to create a pool for the same tokens. |

### Get pools

```rust
#[ink(message)]
pub fn get_pools(
    &self,
) -> Vec<PoolKey>;
```

This function retrieves a listed pool keys.

#### Output parameters

| Type          | Description                                            |
| ------------- | ------------------------------------------------------ |
| Vec<PoolKey\> | Vector with pool keys that indicates all pools listed. |

## Position

### Create position

```rust
#[ink(message)]
pub fn create_position(
    &mut self,
    pool_key: PoolKey,
    lower_tick: i32,
    upper_tick: i32,
    liquidity_delta: Liquidity,
    slippage_limit_lower: SqrtPrice,
    slippage_limit_upper: SqrtPrice,
) -> Result<Position, InvariantError>;
```

This function creates a position based on the provided parameters. The amount of tokens specified in liquidity delta will be deducted from the user's token balances. Position creation will fail if the user does not have enough tokens or has not approved enough tokens.

#### Input parameters

| Name                 | Type      | Description                                                           |
| -------------------- | --------- | --------------------------------------------------------------------- |
| pool_key             | PoolKey   | The pool key for which you want to create a position.                 |
| lower_tick           | i32       | The lower tick of your position.                                      |
| upper_tick           | i32       | The upper tick of your position.                                      |
| liquidity_delta      | Liquidity | The liquidity you want to provide.                                    |
| slippage_limit_lower | SqrtPrice | The lower square root of price fluctuation you are willing to accept. |
| slippage_limit_upper | SqrtPrice | The upper square root of price fluctuation you are willing to accept. |

#### Output parameters

| Type     | Description                    |
| -------- | ------------------------------ |
| Position | The position that was created. |

#### Errors

| Code                            | Description                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `ZeroLiquidity`                 | Fails if the user attempts to open a position with zero liquidity.                         |
| `InvalidTickIndexOrTickSpacing` | Fails if the user attempts to create a position with invalid tick indexes or tick spacing. |
| `PriceLimitReached`             | Fails if the price has reached the slippage limit.                                         |
| `TransferError`                 | Fails if the allowance is insufficient or the user balance transfer fails.                 |
| `PoolNotFound`                  | Fails if pool does not exist.                                                              |

#### External Contracts

- PSP22

### Transfer position

```rust
#[ink(message)]
pub fn transfer_position(
    &mut self,
    index: u32,
    receiver: AccountId,
) -> Result<(), InvariantError>;
```

This function changes ownership of an existing position based on the position index in the user's position list. You can only change ownership of positions that you own; otherwise, it will return an error.

#### Input parameters

| Name     | Type      | Description                                        |
| -------- | --------- | -------------------------------------------------- |
| index    | u32       | Index of the position in the user's position list. |
| receiver | AccountId | Address of the user who will receive the position. |

### Remove position

```rust
#[ink(message)]
pub fn remove_position(
    &mut self,
    index: u32,
) -> Result<(TokenAmount, TokenAmount), InvariantError>;
```

This function removes a position from the user's position list and transfers the tokens used to create the position to the user's address.

#### Input parameters

| Name  | Type | Description                                        |
| ----- | ---- | -------------------------------------------------- |
| index | u32  | Index of the position in the user's position list. |

#### Output parameters

| Type        | Description                                          |
| ----------- | ---------------------------------------------------- |
| TokenAmount | Amount of token X sent to the user's wallet address. |
| TokenAmount | Amount of token Y sent to the user's wallet address. |

#### Errors

| Code               | Description                        |
| ------------------ | ---------------------------------- |
| `PositionNotFound` | Fails if Position cannot be found. |

#### External Contracts

- PSP22

### Claim fee

```rust
#[ink(message)]
pub fn claim_fee(
    &mut self,
    index: u32,
) -> Result<(TokenAmount, TokenAmount), InvariantError>;
```

This function allows the user to claim fees from an existing position. Tokens will be sent to the user's address.

#### Input parameters

| Name  | Type | Description                                        |
| ----- | ---- | -------------------------------------------------- |
| index | u32  | Index of the position in the user's position list. |

#### Output parameters

| Type        | Description                                          |
| ----------- | ---------------------------------------------------- |
| TokenAmount | Amount of token X sent to the user's wallet address. |
| TokenAmount | Amount of token Y sent to the user's wallet address. |

#### Errors

| Code               | Description                        |
| ------------------ | ---------------------------------- |
| `PositionNotFound` | Fails if Position cannot be found. |

#### External Contracts

- PSP22

### Get position

```rust
#[ink(message)]
pub fn get_position(&mut self, owner_id: AccountId, index: u32) -> Result<Position, InvariantError>;
```

This function returns an result that contains error if the position cannot be found or a position if it actually exists.

#### Input parameters

| Name     | Type      | Description                                              |
| -------- | --------- | -------------------------------------------------------- |
| owner_id | AccountId | An AccountId identifying the user who owns the position. |
| index    | u32       | Index of the position in the user's position list.       |

#### Output parameters

| Type                               | Description                                           |
| ---------------------------------- | ----------------------------------------------------- |
| Result<Position, Invariant Error\> | An Error or a position struct with data if it exists. |

#### Errors

| Code               | Description                        |
| ------------------ | ---------------------------------- |
| `PositionNotFound` | Fails if Position cannot be found. |

### Get all positions

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
| Vec<Position\> | A list containing the user's positions. |

## Swap

### Swap

```rust
#[ink(message)]
pub fn swap(
    &mut self,
    pool_key: PoolKey,
    x_to_y: bool,
    amount: TokenAmount,
    by_amount_in: bool,
    sqrt_price_limit: SqrtPrice,
) -> Result<CalculateSwapResult, InvariantError>;
```

This function executes a swap based on the provided parameters. It transfers tokens from the user's address to the contract's address and vice versa. The swap will fail if the user does not have enough tokens, has not approved enough tokens, or if there is insufficient liquidity.

#### Input parameters

| Name             | Type        | Description                                                                             |
| ---------------- | ----------- | --------------------------------------------------------------------------------------- |
| pool_key         | PoolKey     | Pool key of the pool on which you wish to perform the swap.                             |
| x_to_y           | bool        | Specifies the direction of the swap.                                                    |
| amount           | TokenAmount | Amount of tokens you want to receive or give.                                           |
| by_amount_in     | bool        | Indicates whether the entered amount represents the tokens you wish to receive or give. |
| sqrt_price_limit | SqrtPrice   | If the swap achieves this square root of the price, it will be canceled.                |

#### Output parameters

| Type                | Description                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CalculateSwapResult | A struct containing the amount in and amount out with starting and target square root of price, taken fee, pool and vector of crossed ticks. |

#### Errors

| Code                | Description                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AmountIsZero`      | Fails if the user attempts to perform a swap with zero amounts.                                                     |
| `PriceLimitReached` | Fails if the price has reached the specified price limit (or price associated with specified square root of price). |
| `NoGainSwap`        | Fails if the user would receive zero tokens.                                                                        |
| `TransferError`     | Fails if the allowance is insufficient or the user balance transfer fails.                                          |
| `PoolNotFound`      | Fails if pool does not exist.                                                                                       |

#### External Contracts

- PSP22

### Swap route

```rust
#[ink(message)]
pub fn swap_route(
    &mut self,
    amount_in: TokenAmount,
    expected_amount_out: TokenAmount,
    slippage: Percentage,
    swaps: Vec<SwapHop>,
) -> Result<(), InvariantError>;
```

This function facilitates atomic swaps between the user's address and the contract's address, executing multiple swaps based on the provided parameters. Tokens are transferred bidirectionally, from the user to the contract and vice versa, all within a single transaction. The swap is designed to be atomic, ensuring that it either completes entirely or reverts entirely. The success of the swap depends on factors such as the user having sufficient tokens, having approved the necessary token amounts, and the presence of adequate liquidity. Any failure in meeting these conditions will result in the swap transaction being reverted.

#### Input parameters

| Name                | Type          | Description                                                                                                                              |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| amount_in           | TokenAmount   | Amount of tokens you want to swap                                                                                                        |
| expected_amount_out | TokenAmount   | Expected amount to receive as output calculated off-chain                                                                                |
| slippage            | Percentage    | Percentage difference influencing price change, emphasizing precision in the number of tokens received compared to the expected quantity |
| swaps               | Vec<SwapHop\> | Vector of pool keys and booleans identifying swap pool and direction                                                                     |

#### Errors

| Code                | Description                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AmountIsZero`      | Fails if the user attempts to perform a swap with zero amounts.                                                     |
| `PriceLimitReached` | Fails if the price has reached the specified price limit (or price associated with specified square root of price). |
| `NoGainSwap`        | Fails if the user would receive zero tokens.                                                                        |
| `TransferError`     | Fails if the allowance is insufficient or the user balance transfer fails.                                          |
| `PoolNotFound`      | Fails if pool does not exist.                                                                                       |

#### External Contracts

- PSP22

### Quote

```rust
#[ink(message)]
pub fn quote(
    &self,
    pool_key: PoolKey,
    x_to_y: bool,
    amount: TokenAmount,
    by_amount_in: bool,
    sqrt_price_limit: SqrtPrice,
) -> Result<QuoteResult, InvariantError>;
```

This function performs a simulation of a swap based on the provided parameters and returns the simulation results. It does not involve any actual token transfers.

#### Input parameters

| Name             | Type        | Description                                                                             |
| ---------------- | ----------- | --------------------------------------------------------------------------------------- |
| pool_key         | PoolKey     | Pool key of the pool on which you wish to perform the swap.                             |
| x_to_y           | bool        | Specifies the direction of the swap.                                                    |
| amount           | TokenAmount | Amount of tokens you want to receive or give.                                           |
| by_amount_in     | bool        | Indicates whether the entered amount represents the tokens you wish to receive or give. |
| sqrt_price_limit | SqrtPrice   | If the swap achieves this square root of the price, it will be canceled.                |

#### Output parameters

| Type        | Description                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QuoteResult | A struct containing amount of tokens received, amount of tokens given, square root of price after the simulated swap and list of ticks that has been crossed durning the simulation |

#### Errors

| Code                | Description                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AmountIsZero`      | Fails if the user attempts to perform a swap with zero amounts.                                                     |
| `PriceLimitReached` | Fails if the price has reached the specified price limit (or price associated with specified square root of price). |
| `NoGainSwap`        | Fails if the user would receive zero tokens.                                                                        |
| `PoolNotFound`      | Fails if pool does not exist.                                                                                       |

### Quote route

```rust
#[ink(message)]
pub fn quote_route(
    &self,
    amount_in: TokenAmount,
    swaps: Vec<SwapHop>,
) -> Result<TokenAmount, InvariantError>;
```

This function performs a simulation of multiple swaps based on the provided parameters and returns the simulation results. It does not involve any actual token transfers.

#### Input parameters

| Name      | Type          | Description                                                                |
| --------- | ------------- | -------------------------------------------------------------------------- |
| amount_in | TokenAmount   | Amount of tokens you want to swap.                                         |
| swaps     | Vec<SwapHop\> | A vector containing all parameters needed to identify separate swap steps. |

#### Output parameters

| Type        | Description                                  |
| ----------- | -------------------------------------------- |
| TokenAmount | Amount of tokens received in the simulation. |

#### Errors

| Code                | Description                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AmountIsZero`      | Fails if the user attempts to perform a swap with zero amounts.                                                     |
| `PriceLimitReached` | Fails if the price has reached the specified price limit (or price associated with specified square root of price). |
| `NoGainSwap`        | Fails if the user would receive zero tokens.                                                                        |
| `PoolNotFound`      | Fails if pool does not exist.                                                                                       |

## Tick

### Get tick

```rust
#[ink(message)]
pub fn get_tick(
    &self,
    key: PoolKey,
    index: i32
) -> Result<Tick, InvariantError>;
```

Retrieves information about a tick at a specified index.

#### Input parameters

| Name  | Type    | Description                                      |
| ----- | ------- | ------------------------------------------------ |
| key   | PoolKey | A unique key that identifies the specified pool. |
| index | i32     | The tick index in the tickmap.                   |

#### Output parameters

| Type | Description                    |
| ---- | ------------------------------ |
| Tick | A struct containing tick data. |

#### Errors

| Code           | Description                    |
| -------------- | ------------------------------ |
| `TickNotFound` | Fails if tick cannot be found. |

### Is tick initialized

```rust
#[ink(message)]
pub fn is_tick_initialized(
    &self,
    key: PoolKey,
    index: i32
) -> bool;
```

Retrieves information about a tick at a specified index.

#### Input parameters

| Name  | Type    | Description                                      |
| ----- | ------- | ------------------------------------------------ |
| key   | PoolKey | A unique key that identifies the specified pool. |
| index | i32     | The tick index in the tickmap.                   |

#### Output parameters

| Type | Description                                                |
| ---- | ---------------------------------------------------------- |
| bool | boolean identifying if the tick is initialized in tickmap. |

### Get position ticks

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
| Vec<PositionTick/> | Vector containing ticks of user positions. |

### Get user positions amount

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
| u32  | Number of user positions. |

### Get liquidity ticks

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
| Vec<LiquidityTick/> | Vector containing ticks of specified pool. |

### Get liquidity ticks amount

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
| u32  | Number of ticks on a specified pool. |

## Tickmap

### Get tickmap

```rust
#[ink(message)]
fn get_tickmap(&self, pool_key: PoolKey, center_tick: i32) -> Vec<(u16,u64)>;
```

Retrieves tickmap chunks for a specified pool.

#### Input parameters

| Name        | Type    | Description                                      |
| ----------- | ------- | ------------------------------------------------ |
| pool_key    | PoolKey | A unique key that identifies the specified pool. |
| center_tick | i32     | Center tick index.                               |

#### Output parameters

| Type            | Description                                       |
| --------------- | ------------------------------------------------- |
| Vec<(u16,u64)/> | Vector containing tickmap chunks index and value. |
