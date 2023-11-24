---
title: Entrypoints

slug: /aleph_zero/entrypoints
---

### Constructor
```rust
#[ink(constructor)]
pub fn new(protocol_fee: Percentage) -> Self
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|protocol_fee|Percentage|The percentage for the protocol fee.|
This constructor method initializes the contract with the specified protocol fee. The administrator role is assigned to the caller.

## Protocol fee

### Get protocol fee
```rust
#[ink(message)]
pub fn get_protocol_fee(&self) -> Percentage
```
#### Output parameters
|Type|Description|
|-|-|
|Percentage|The current protocol fee.|
This method retrieves the current protocol fee percentage.

### Change protocol fee
```rust
#[ink(message)]
pub fn change_protocol_fee(&mut self, protocol_fee: Percentage) -> Result<(), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|protocol_fee|Percentage|The new protocol fee percentage.|
This function allows for the adjustment of the current protocol fee percentage. Note that this operation is restricted to administrators.

### Withdraw protocol fee
```rust
#[ink(message)]
pub fn withdraw_protocol_fee(&mut self, pool_key: PoolKey) -> Result<(), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|The pool key that corresponds to the withdrawal of fees from the associated pool.|
This operation enables the withdrawal of protocol fees associated with a specific pool, based on the provided pool key. The withdrawn funds are sent to the administrator's wallet. Please note that this action can only be performed by administrators.

## Fee tier

### Add fee tier
```rust
#[ink(message)]
pub fn add_fee_tier(&mut self, fee_tier: FeeTier) -> Result<(), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|fee_tier|FeeTier|The fee tier to be added.|
This function enables the addition of a new fee tier, which users can subsequently utilize when creating pools. Please note that this action is restricted to administrators.

### Get fee tier
```rust
#[ink(message)]
pub fn get_fee_tier(&self, key: FeeTierKey) -> Option<()>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|key|FeeTierKey|The key associated with the fee tier to be checked for existence.|
#### Output parameters
|Type|Description|
|-|-|
|Option<()>|An option that may contain none or an empty unit if the fee tier exists.|
This function is used to verify the existence of a specified fee tier.

### Remove fee tier
```rust
#[ink(message)]
pub fn remove_fee_tier(&mut self, key: FeeTierKey)
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|key|FeeTierKey|The key associated with the fee tier to be removed.|
This function removes a fee tier based on the provided fee tier key. After removal, the fee tier will no longer be available for use in pool creation. It's important to note that existing pools with that fee tier will remain unaffected. This action is exclusively available to administrators.

## Pools

### Create pool
```rust
#[ink(message)]
pub fn create_pool(
    &mut self,
    token_0: AccountId,
    token_1: AccountId,
    fee_tier: FeeTier,
    init_tick: i32,
) -> Result<(), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|token_0|AccountId|Address of the first PSP22 token in the pair.|
|token_1|AccountId|Address of the second PSP22 token in the pair.|
|fee_tier|FeeTier|The fee tier to be applied.|
|init_tick|i32|The initial tick value for the pool.|
This function creates a pool based on a pair of tokens and the specified fee tier. The order of the tokens is irrelevant, and only one pool can exist with a specific combination of two tokens and a fee tier.

### Get pool
```rust
#[ink(message)]
pub fn get_pool(
    &self,
    token_0: AccountId,
    token_1: AccountId,
    fee_tier: FeeTier,
) -> Result<Pool, ContractErrors> 
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|token_0|AccountId|Address of the first token in the pair.|
|token_1|AccountId|Address of the second token in the pair.|
|fee_tier|FeeTier|The fee tier of the pool you want to retrieve.|
#### Output parameters
|Type|Description|
|-|-|
|Pool|A struct containing pool data.|
This function retrieves a pool based on two tokens and the specified fee tier. It returns an error if the pool does not exist.

### Change fee receiver
```rust
#[ink(message)]
pub fn change_fee_receiver(
    &mut self,
    pool_key: PoolKey,
    fee_receiver: AccountId,
) -> Result<(), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|The pool key of the pool where the change is to be made.|
|fee_receiver|AccountId|The new fee receiver's address of the pool.|
This function allows for the modification of the fee receiver of a pool. Please note that this action is exclusively available to administrators.

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
) -> Result<Position, ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|The pool key for which you want to create a position.|
|lower_tick|i32|The lower tick of your position.|
|upper_tick|i32|The upper tick of your position.|
|liquidity_delta|Liquidity|The liquidity you want to provide.|
|slippage_limit_lower|SqrtPrice|The lower square root of price fluctuation you are willing to accept.|
|slippage_limit_upper|SqrtPrice|The upper square root of price fluctuation you are willing to accept.|
#### Output parameters
|Type|Description|
|-|-|
|Position|The position that was created.|
This function creates a position based on the provided parameters. The amount of tokens specified in liquidity delta will be deducted from the user's token balances. Position creation will fail if the user does not have enough tokens or has not approved enough tokens.

### Transfer position
```rust
#[ink(message)]
pub fn transfer_position(
    &mut self,
    index: u32,
    receiver: AccountId,
) -> Result<(), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|index|u32|Index of the position in the user's position list.|
|receiver|i32|Address of the user who will receive the position.|
This function changes ownership of an existing position based on the position index in the user's position list. You can only change ownership of positions that you own; otherwise, it will return an error.

### Remove position
```rust
#[ink(message)]
pub fn remove_position(
    &mut self,
    index: u32,
) -> Result<(TokenAmount, TokenAmount), ContractErrors> 
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|index|u32|Index of the position in the user's position list.|
#### Output parameters
|Type|Description|
|-|-|
|TokenAmount|Amount of token X sent to the user's wallet address.|
|TokenAmount|Amount of token Y sent to the user's wallet address.|
This function removes a position from the user's position list and transfers the tokens used to create the position to the user's address.

### Claim fee
```rust
#[ink(message)]
pub fn claim_fee(
    &mut self,
    index: u32,
) -> Result<(TokenAmount, TokenAmount), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|index|u32|Index of the position in the user's position list.|
#### Output parameters
|Type|Description|
|-|-|
|TokenAmount|Amount of token X sent to the user's wallet address.|
|TokenAmount|Amount of token Y sent to the user's wallet address.|
This function allows the user to claim fees from an existing position. Tokens will be sent to the user's address.

### Get position
```rust
#[ink(message)]
pub fn get_position(&mut self, index: u32) -> Option<Position> 
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|index|u32|Index of the position in the user's position list.|
#### Output parameters
|Type|Description|
|-|-|
|Option<Position\>|An option that may contain none or a position struct with data if it exists.|
This function returns an option that contains none if the position index is out of range or a position if it actually exists.

### Get all positions
```rust
#[ink(message)]
pub fn get_all_positions(&mut self) -> Vec<Position>
```
#### Output parameters
|Type|Description|
|-|-|
|Vec<Position\>|A list containing the user's positions.|
This function returns a list of positions owned by the caller. The list will be empty if you do not have any positions.

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
) -> Result<(), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key of the pool on which you wish to perform the swap.|
|x_to_y|bool|Specifies the direction of the swap.|
|amount|TokenAmount|Amount of tokens you want to receive or give.|
|by_amount_in|bool|Indicates whether the entered amount represents the tokens you wish to receive or give.|
|sqrt_price_limit|SqrtPrice|If the swap achieves this square root of the price, it will be canceled.|
This function executes a swap based on the provided parameters. It transfers tokens from the user's address to the contract's address and vice versa. The swap will fail if the user does not have enough tokens, has not approved enough tokens, or if there is insufficient liquidity.

### Swap Route
```rust
#[ink(message)]
pub fn swap_route(
    &mut self,
    amount_in: TokenAmount,
    expected_amount_out: TokenAmount,
    slippage: Percentage,
    swaps: Vec<SwapRouteParams>,
) -> Result<(), ContractErrors>
```
#### Input parameters
| Name                   | Type                   | Description                                                  |
|------------------------|------------------------|--------------------------------------------------------------|
| amount_in              | TokenAmount            | Amount of tokens you want to swap                             |
| expected_amount_out    | TokenAmount            | Expected amount to receive as output                           |
| slippage               | Percentage             | Percentage difference that can affect the price change        |
| swaps                  | Vec&ltSwapRouteParams&gt   | Vector of pool keys and booleans identifying swap pool and direction |

This function executes multiple swaps based on the provided parameters. It transfers tokens from the user's address to the contract's address and vice versa. The swap will fail if the user does not have enough tokens, has not approved enough tokens, or if there is insufficient liquidity.


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
) -> Result<(TokenAmount, TokenAmount, SqrtPrice, Vec<Tick>), ContractErrors>
```
#### Input parameters
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key of the pool on which you wish to perform the swap.|
|x_to_y|bool|Specifies the direction of the swap.|
|amount|TokenAmount|Amount of tokens you want to receive or give.|
|by_amount_in|bool|Indicates whether the entered amount represents the tokens you wish to receive or give.|
|sqrt_price_limit|SqrtPrice|If the swap achieves this square root of the price, it will be canceled.|
#### Output parameters
|Type|Description|
|-|-|
|TokenAmount|Amount of tokens received in the simulation.|
|TokenAmount|Amount of tokens given in the simulation.|
|SqrtPrice|Square root of price after the simulated swap.|
|Vec<Tick\>|List of ticks that changed after the simulation.|
This function performs a simulation of a swap based on the provided parameters and returns the simulation results. It does not involve any actual token transfers.