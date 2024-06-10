---
title: Entrypoints

slug: /vara/entrypoints
---

This section outlines the core entrypoints for the Invariant program, providing developers with essential methods to interact with the protocol. These entrypoints cover various aspects of the contract, including protocol fee management, fee tier administration, pool creation and management, position handling, and swap functionality. Program has 3 main entrypoints(`Init`, `Handle`, `State`). Invariant specific entrypoints are reached by sending a message with a proper enum variant to either `Handle` or `State` entrypoint. It should be noted that the message types for those entrypoints differ and can't be used interchangeably. 

# Init Entrypoint
Corresponding method
```rust
#[async_init]
async fn init() 
```

## Input

```rust
pub struct InitInvariant {
    pub config: InvariantConfig,
}
```
This entrypoint initializes the program with the specified protocol fee and administrator ActorId.

#### Input parameters

| Name         | Type            | Description                          |
| ------------ | --------------- | ------------------------------------ |
| config       | InvariantConfig | Config for the program               |

# State Entrypoint
Corresponding method
```rust
#[no_mangle]
extern "C" fn state()
```
This entrypoint is used for methods that don't alter the state. 

Invariant entrypoints can be accessed with variants of the `InvariantStateQuery` enum. 

```rust
pub enum InvariantStateQuery {
    FeeTierExist(FeeTier),
    GetFeeTiers,
    GetProtocolFee,
    GetPool(ActorId, ActorId, FeeTier),
    GetPools(u8, u16),
    GetPosition(ActorId, u32),
    GetTick(PoolKey, i32),
    IsTickInitialized(PoolKey, i32),
    GetAllPositions(ActorId),
}
```

Entrypoint return messages are variants of `InvariantStateReply` enum.

```rust
pub enum InvariantStateReply {
    ProtocolFee(Percentage),
    QueriedFeeTiers(Vec<FeeTier>),
    FeeTierExist(bool),
    Pool(Pool),
    Pools(Vec<PoolKey>),
    Position(Position),
    Positions(Vec<Position>),
    Tick(Tick),
    IsTickInitialized(bool),
    QueryFailed(InvariantError),
}
```
## Errors
Errors are returned through the `QueryFailed` variant.

# Handle Entrypoint
Corresponding method
```rust
#[async_main]
async fn main()
```

This entrypoint is used for methods that don't alter the state. 

Invariant entrypoints can be accessed with variants of the `InvariantAction` enum. 

## Input
```rust
pub enum InvariantAction {
    ChangeProtocolFee(Percentage),
    AddFeeTier(FeeTier),
    RemoveFeeTier(FeeTier),
    CreatePool {
        token_0: ActorId,
        token_1: ActorId,
        fee_tier: FeeTier,
        init_sqrt_price: SqrtPrice,
        init_tick: i32,
    },
    ChangeFeeReceiver(PoolKey, ActorId),
    CreatePosition {
        pool_key: PoolKey,
        lower_tick: i32,
        upper_tick: i32,
        liquidity_delta: Liquidity,
        slippage_limit_lower: SqrtPrice,
        slippage_limit_upper: SqrtPrice,
    },
    RemovePosition {
        position_id: u32,
    },
    TransferPosition {
        index: u32,
        receiver: ActorId,
    },
    Swap {
        pool_key: PoolKey,
        x_to_y: bool,
        amount: TokenAmount,
        by_amount_in: bool,
        sqrt_price_limit: SqrtPrice,
    },
    Quote {
        pool_key: PoolKey,
        x_to_y: bool,
        amount: TokenAmount,
        by_amount_in: bool,
        sqrt_price_limit: SqrtPrice,
    },
    QuoteRoute {
        amount_in: TokenAmount,
        swaps: Vec<SwapHop>,
    },
    ClaimFee {
        position_id: u32,
    },
    WithdrawProtocolFee(PoolKey),
}
```

## Output

Entrypoint return messages are variants of `InvariantEvent` enum.

```rust
pub enum InvariantEvent {
    ProtocolFeeChanged(Percentage),
    PositionCreatedReturn(Position),
    PositionCreatedEvent {
        block_timestamp: u64,
        address: ActorId,
        pool_key: PoolKey,
        liquidity_delta: Liquidity,
        lower_tick: i32,
        upper_tick: i32,
        current_sqrt_price: SqrtPrice,
    },
    PositionRemovedReturn(TokenAmount, TokenAmount),
    PositionRemovedEvent {
        block_timestamp: u64,
        caller: ActorId,
        pool_key: PoolKey,
        liquidity: Liquidity,
        lower_tick_index: i32,
        upper_tick_index: i32,
        sqrt_price: SqrtPrice,
    },
    CrossTickEvent {
        timestamp: u64,
        address: ActorId,
        pool: PoolKey,
        indexes: Vec<i32>,
    },
    SwapEvent {
        timestamp: u64,
        address: ActorId,
        pool: PoolKey,
        amount_in: TokenAmount,
        amount_out: TokenAmount,
        fee: TokenAmount,
        start_sqrt_price: SqrtPrice,
        target_sqrt_price: SqrtPrice,
        x_to_y: bool,
    },
    SwapReturn(CalculateSwapResult),
    Quote(QuoteResult),
    ClaimFee(TokenAmount, TokenAmount),
    QuoteRoute(TokenAmount),
    ActionFailed(InvariantError),
}
```
## Errors
Errors are returned through `panic!`

# Invariant specific entrypoints

This section describes invariant specific entrypoints.
## Protocol fee

### Get protocol fee

This method retrieves the current protocol fee percentage.

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::GetProtocolFee
```
#### Output
```rust
InvariantStateReply::ProtocolFee(Percentage)
```

#### Output parameters

| Type       | Description               |
| ---------- | ------------------------- |
| Percentage | The current protocol fee. |


### Withdraw protocol fee

This operation enables the withdrawal of protocol fees associated with a specific pool, based on the provided pool key. The withdrawn funds are sent to the fee receiver wallet. Please note that this action can only be performed by fee receiver.

#### Entrypoint
`Handle`

#### Input
```rust
InvariantAction::WithdrawProtocolFee(PoolKey)
```

#### Input parameters

| Type    | Description                                                                       |
| ------- | --------------------------------------------------------------------------------- |
| PoolKey | The pool key that corresponds to the withdrawal of fees from the associated pool. |

#### Errors

| Code                         | Description                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `NotFeeReceiver`             | Reverts the call when the caller is unauthorized receiver.                   |
| `TransferError`              | Fails if the allowance is insufficient or the user balance transfer fails    |
| `NotEnoughGasToExecute`      | Occurs when provided gas was too low to execute                              |

#### External Contracts

- GRC-20

### Change protocol fee

This function allows for the adjustment of the current protocol fee percentage. Note that this operation is restricted to administrators.

#### Entrypoint
`Handle`

#### Input
```rust
InvariantAction::ChangeProtocolFee(Percentage)
```
#### Output
```rust
InvariantEvent::ProtocolFeeChanged(Percentage)
```

#### Input parameters

| Type       | Description                      |
| ---------- | -------------------------------- |
| Percentage | The new protocol fee percentage. |

#### Output parameters

| Type       | Description                      |
| ---------- | -------------------------------- |
| Percentage | Updated protocol fee percentage. |

#### Errors

| Code       | Description                                               |
| ---------- | --------------------------------------------------------- |
| `NotAdmin` | Reverts the call when the caller is an unauthorized user. |

### Change fee receiver

This function allows for the modification of the fee receiver of a pool. Please note that this action is exclusively available to administrators.

#### Entrypoint
`Handle`

#### Input
```rust
InvariantAction::ChangeFeeReceiver(PoolKey, ActorId)
```


#### Input parameters

| Type      | Description                                              |
| --------- | -------------------------------------------------------- |
| PoolKey   | The pool key of the pool where the change is to be made. |
| ActorId   | The new fee receiver's address of the pool.              |

#### Errors

| Code       | Description                                            |
| ---------- | ------------------------------------------------------ |
| `NotAdmin` | Reverts the call when the caller is unauthorized user. |

## Fee tier

### Add fee tier

This function enables the addition of a new fee tier, which users can subsequently utilize when creating pools. Please note that this action is restricted to administrators.

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::AddFeeTier(FeeTier)
```

#### Input parameters

| Type    | Description               |
| ------- | ------------------------- |
| FeeTier | The fee tier to be added. |

#### Errors

| Code                  | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `NotAdmin`            | Fails if an unauthorized user attempts to create a fee tier. |
| `InvalidTickSpacing`  | Fails if the tick spacing is invalid.                        |
| `FeeTierAlreadyExist` | Fails if the fee tier already exists.                        |
| `InvalidFee`          | Fails if fee is invalid.                                     |

### Fee Tier exist

This function is used to verify the existence of a specified fee tier.

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::FeeTierExist(FeeTier)
```
#### Output
```rust
InvariantStateReply::FeeTierExist(bool)
```
#### Input parameters

| Type    | Description                                                       |
| ------- | ----------------------------------------------------------------- |
| FeeTier | The key associated with the fee tier to be checked for existence. |

#### Output parameters

| Type | Description                                  |
| ---- | -------------------------------------------- |
| bool | boolean indicating if the fee tier is added. |

### Get fee tiers

Retrieves available fee tiers.

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::GetFeeTiers
```
#### Output
```rust
InvariantStateReply::QueriedFeeTiers(Vec<FeeTier>)
```

#### Output parameters

| Type          | Description                                             |
| ------------- | ------------------------------------------------------- |
| Vec<FeeTier\> | Vector containing all fee tiers added to specified pool |

### Remove fee tier

This function removes a fee tier based on the provided fee tier key. After removal, the fee tier will no longer be available for use in pool creation. It's important to note that existing pools with that fee tier will remain unaffected. This action is exclusively available to administrators.

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::RemoveFeeTier(FeeTier)
```

#### Input parameters

| Type    | Description                                         |
| ------- | --------------------------------------------------- |
| FeeTier | The key associated with the fee tier to be removed. |

#### Errors

| Code              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `NotAdmin`        | Fails if an unauthorized user attempts to create a fee tier. |
| `FeeTierNotFound` | Fails if fee tier does not exist.                            |

## Pools

### Create pool

This function creates a pool based on a pair of tokens and the specified fee tier. The order of the tokens is irrelevant, and only one pool can exist with a specific combination of two tokens and a fee tier.

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::CreatePool {
    token_0: ActorId,
    token_1: ActorId,
    fee_tier: FeeTier,
    init_sqrt_price: SqrtPrice,
    init_tick: i32,
}
```

#### Input parameters

| Name            | Type      | Description                                                            |
| --------------- | --------- | ---------------------------------------------------------------------- |
| token_0         | ActorId   | Address of the first GRC-20 token in the pair.                         |
| token_1         | ActorId   | Address of the second GRC-20 token in the pair.                        |
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

This function retrieves a pool based on two tokens and the specified fee tier. It returns an error if the pool does not exist.

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::GetPool(ActorId, ActorId, FeeTier)
```
#### Output
```rust
InvariantStateReply::Pool(Pool)
```

#### Input parameters

| Type      | Description                                    |
| --------- | ---------------------------------------------- |
| ActorId   | Address of the first token in the pair.        |
| ActorId   | Address of the second token in the pair.       |
| FeeTier   | The fee tier of the pool you want to retrieve. |

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

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::GetPools
```
#### Output
```rust
InvariantStateReply::Pools(Vec<PoolKey>)
```


This function retrieves a listed pool keys.

#### Output parameters

| Type          | Description                                            |
| ------------- | ------------------------------------------------------ |
| Vec<PoolKey\> | Vector with pool keys that indicates all pools listed. |

## Position

### Create position

This function creates a position based on the provided parameters. The amount of tokens specified in liquidity delta will be deducted from the user's token balances. Position creation will fail if the user does not have enough tokens or has not approved enough tokens.

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::CreatePosition {
    pool_key: PoolKey,
    lower_tick: i32,
    upper_tick: i32,
    liquidity_delta: Liquidity,
    slippage_limit_lower: SqrtPrice,
    slippage_limit_upper: SqrtPrice,
}
```
#### Output
```rust
    PositionCreatedReturn(Position)
```

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
| `NotEnoughGasToExecute`         | Occurs when provided gas was too low to execute                                            |
| `NotEnoughGasToUpdate`          | Occurs when provided gas turned out to insufficient to update after transfer               |

#### External Contracts

- GRC-20

### Transfer position

This function changes ownership of an existing position based on the position index in the user's position list. You can only change ownership of positions that you own; otherwise, it will return an error.

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::TransferPosition {
    index: u32,
    receiver: ActorId,
}
```

#### Input parameters

| Name     | Type      | Description                                        |
| -------- | --------- | -------------------------------------------------- |
| index    | u32       | Index of the position in the user's position list. |
| receiver | ActorId | Address of the user who will receive the position. |

### Remove position

This function removes a position from the user's position list and transfers the tokens used to create the position to the user's address.

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::RemovePosition {
    position_id: u32,
}
```
#### Output
```rust
InvariantEvent::PositionRemovedReturn(TokenAmount, TokenAmount)
```
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

| Code                            | Description                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `PositionNotFound`              | Fails if Position cannot be found.                                                         |
| `TransferError`                 | Fails if an error occurs on the side of any of the withdrawn tokens                        |
| `NotEnoughGasToExecute`         | Occurs when provided gas was too low to execute                                            |

#### External Contracts

- GRC-20

### Claim fee

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::ClaimFee {
    position_id: u32,
}
```
#### Output
```rust
InvariantEvent::ClaimFee(TokenAmount, TokenAmount)
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

| Code                            | Description                                                         |
| ------------------------------- | ------------------------------------------------------------------- |
| `PositionNotFound`              | Fails if Position cannot be found.                                  |
| `TransferError`                 | Fails if an error occurs on the side of any of the withdrawn tokens |
| `NotEnoughGasToExecute`         | Occurs when provided gas was too low to execute                     |


#### External Contracts

- GRC-20

### Get position

This function returns an result that contains error if the position cannot be found or a position if it actually exists.

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::GetPosition(ActorId, u32)
```
#### Output
```rust
InvariantStateReply::Position(Position)
```    

#### Input parameters

| Type      | Description                                              |
| --------- | -------------------------------------------------------- |
| ActorId   | An ActorId identifying the user who owns the position.   |
| u32       | Index of the position in the user's position list.       |

#### Output parameters

| Type       | Description    |
| ---------- |--------------- |
| Position   | Found position |

#### Errors

| Code               | Description                        |
| ------------------ | ---------------------------------- |
| `PositionNotFound` | Fails if Position cannot be found. |

### Get all positions

This function returns a list of positions owned by the caller. The list will be empty if you do not have any positions.

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::GetAllPositions(ActorId, u32)
```
#### Output
```rust
InvariantStateReply::Positions(Vec<Position>)
```    

#### Input parameters

| Type      | Description                                              |
| --------- | -------------------------------------------------------- |
| ActorId   | An ActorId identifying the user who own the positions.   |

#### Output parameters

| Type           | Description                             |
| -------------- | --------------------------------------- |
| Vec<Position\> | A list containing the user's positions. |

## Swap

### Swap

This function executes a swap based on the provided parameters. It transfers tokens from the user's address to the contract's address and vice versa. The swap will fail if the user does not have enough tokens, has not approved enough tokens, or if there is insufficient liquidity.

#### Entrypoint
`Handle`
#### Input
```rust
InvariantAction::Swap {
    pool_key: PoolKey,
    x_to_y: bool,
    amount: TokenAmount,
    by_amount_in: bool,
    sqrt_price_limit: SqrtPrice,
}
```
#### Output
```rust
InvariantEvent::SwapReturn(CalculateSwapResult)
```

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

| Code                            | Description                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AmountIsZero`                  | Fails if the user attempts to perform a swap with zero amounts.                                                     |
| `PriceLimitReached`             | Fails if the price has reached the specified price limit (or price associated with specified square root of price). |
| `NoGainSwap`                    | Fails if the user would receive zero tokens.                                                                        |
| `TransferError`                 | Fails if the allowance is insufficient or the user balance transfer fails.                                          |
| `PoolNotFound`                  | Fails if pool does not exist.                                                                                       |
| `NotEnoughGasToUpdate`          | Occurs when provided gas was too low to perform a state update after calculation                                    |

#### External Contracts

- GRC-20

### Quote

This function performs a simulation of a swap based on the provided parameters and returns the simulation results. It does not involve any actual token transfers.

#### Entrypoints
`Handle`
#### Input
```rust
InvariantAction::Quote {
    pool_key: PoolKey,
    x_to_y: bool,
    amount: TokenAmount,
    by_amount_in: bool,
    sqrt_price_limit: SqrtPrice,
}
```
#### Output
```rust
InvariantEvent::Quote(QuoteResult)
```

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
| `PoolNotFound`      | Fails if pool does not exist.   

### Quote Route

#### Entrypoints
`Handle`
#### Input
```rust
InvariantAction::QuoteRoute {
    amount_in: TokenAmount,
    swaps: Vec<SwapHop>,
}
```
#### Output
```rust
InvariantEvent::QuoteRoute(TokenAmount)
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

Retrieves information about a tick at a specified index.

#### Entrypoint
`State`
#### Input
```rust
InvariantStateQuery::GetTick(PoolKey, i32)
```
#### Output
```rust
InvariantStateReply::Tick(Tick)
```

#### Input parameters

| Type    | Description                                      |
| ------- | ------------------------------------------------ |
| PoolKey | A unique key that identifies the specified pool. |
| i32     | The tick index in the tickmap.                   |

#### Output parameters

| Type | Description                    |
| ---- | ------------------------------ |
| Tick | A struct containing tick data. |

#### Errors

| Code           | Description                    |
| -------------- | ------------------------------ |
| `TickNotFound` | Fails if tick cannot be found. |

### Is tick initialized

Retrieves information about a tick at a specified index.

#### Entrypoint
`State`
#### Input 
```rust
InvariantStateQuery::IsTickInitialized(PoolKey, i32)
```
#### Output 
```rust
InvariantStateReply::IsTickInitialized(bool)
```

#### Input parameters

| Type    | Description                                      |
| ------- | ------------------------------------------------ |
| PoolKey | A unique key that identifies the specified pool. |
| i32     | The tick index in the tickmap.                   |

#### Output parameters

| Type | Description                                                |
| ---- | ---------------------------------------------------------- |
| bool | boolean identifying if the tick is initialized in tickmap. |

