---
title: Entrypoints

slug: /aleph_zero/entrypoints
---

### Constructor
```rust
#[ink(constructor)]
pub fn new(protocol_fee: Percentage) -> Self
```
Creates contract with specified protocol fee. Admin will be set to caller.

## Protocol fee

### Get protocol fee
```rust
#[ink(message)]
pub fn get_protocol_fee(&self) -> Percentage
```
Returns current protocol fee percentage.

### Change protocol fee
```rust
#[ink(message)]
pub fn change_protocol_fee(&mut self, protocol_fee: Percentage) -> Result<(), ContractErrors>
```
|Name|Type|Description|
|-|-|-|
|protocol_fee|Percentage|New protocol fee percentage.|
Changes current protocol fee percentage. That message is only available for an admin.

### Withdraw protocol fee
```rust
#[ink(message)]
pub fn withdraw_protocol_fee(&mut self, pool_key: PoolKey) -> Result<(), ContractErrors>
```
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key of pool you want to withdraw protocol fee from.|
Withdraws protocol fee of pool based on pool key. Both tokens will be sent to an admin wallet. That message is only available for an admin.

## Fee tier

### Add fee tier
```rust
#[ink(message)]
pub fn add_fee_tier(&mut self, fee_tier: FeeTier) -> Result<(), ContractErrors>
```
|Name|Type|Description|
|-|-|-|
|fee_tier|FeeTier|Fee tier you want to add.|
Adds new fee tier. Users will be able to use them in pool creation. That message is only available for an admin.

### Get fee tier
```rust
#[ink(message)]
pub fn get_fee_tier(&self, key: FeeTierKey) -> Option<()>
```
|Name|Type|Description|
|-|-|-|
|key|FeeTierKey|Fee tier key of fee tier you want to check if exists.|
Returns option containing none if pool does not exist or empty unit if pool does exist.

### Remove fee tier
```rust
#[ink(message)]
pub fn remove_fee_tier(&mut self, key: FeeTierKey)
```
|Name|Type|Description|
|-|-|-|
|key|FeeTierKey|Fee tier key of fee tier you want to remove.|
Removes fee tier based on fee tier key. Fee tier will no longer be available in pool creation. Existing pools with that fee tier will remain the same. That message is only available for an admin.

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
|Name|Type|Description|
|-|-|-|
|token_0|AccountId|Address of first token of a pair.|
|token_1|AccountId|Address of second token of a pair.|
|fee_tier|FeeTier|Fee tier you want to use.|
|init_tick|i32|Tick that will be used as a initial tick.|
Creates pool based on token pair and existing fee tier. Only one pool can exist with two specific tokens and fee tier.

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
|Name|Type|Description|
|-|-|-|
|token_0|AccountId|Address of first token of a pair.|
|token_1|AccountId|Address of second token of a pair.|
|fee_tier|FeeTier|Fee tier of a pool you want to get.|
Returns pool based on two tokens and fee tier. Will return an error if pool does not exist.

### Change fee receiver
```rust
#[ink(message)]
pub fn change_fee_receiver(
    &mut self,
    pool_key: PoolKey,
    fee_receiver: AccountId,
) -> Result<(), ContractErrors>
```
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key of pool you want to change.|
|fee_receiver|AccountId|Address of new fee receiver of a pool.|
Changes fee receiver of a pool. That message is only available to an admin.

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
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key of pool that you want to create position on.|
|lower_tick|i32|Lower tick of your position.|
|upper_tick|i32|Upper tick of your position.|
|liquidity_delta|Liquidity|Liquidity you want to provide (amount of tokens based on current price).|
|slippage_limit_lower|SqrtPrice|Lower square root of price fluctuation you are willing to accept.|
|slippage_limit_upper|SqrtPrice|Upper square root of price fluctuation you are willing to accept.|
Creates position based on provided parameters. Amount of tokens specified in liquidity delta will be taken from user token balances. Position creation will fail if user won't have enough tokens or won't approve enough tokens.

### Transfer position
```rust
#[ink(message)]
pub fn transfer_position(
    &mut self,
    index: u32,
    receiver: AccountId,
) -> Result<(), ContractErrors>
```
|Name|Type|Description|
|-|-|-|
|index|u32|Index of position on user position list.|
|receiver|i32|Address of user that will receive that position.|
Changes ownership of an existing position based on position index on user position list. You can only change ownership of positions that you own, otherwise it will return an error.

### Remove position
```rust
#[ink(message)]
pub fn remove_position(
    &mut self,
    index: u32,
) -> Result<(TokenAmount, TokenAmount), ContractErrors> 
```
|Name|Type|Description|
|-|-|-|
|index|u32|Index of position on user position list.|
Removes position from user position list and transfers tokens used to create position to user address.

### Claim fee
```rust
#[ink(message)]
pub fn claim_fee(
    &mut self,
    index: u32,
) -> Result<(TokenAmount, TokenAmount), ContractErrors>
```
|Name|Type|Description|
|-|-|-|
|index|u32|Index of position on user position list.|
Claims fee of an existing position. Tokens will be sent to user address.

### Get position
```rust
#[ink(message)]
pub fn get_position(&mut self, index: u32) -> Option<Position> 
```
|Name|Type|Description|
|-|-|-|
|index|u32|Index of position on user position list.|
Returns option that contains none if position index is out of range or position if position actually exists.

### Get all positions
```rust
#[ink(message)]
pub fn get_all_positions(&mut self) -> Vec<Position>
```
Return list of positions of a caller. List will be empty if you don't have any positions.

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
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key of pool that you want to swap on.|
|x_to_y|bool|Specifies direction of a swap.|
|amount|TokenAmount|Amount of tokens you want to get or give.|
|by_amount_in|bool|Specifies if entered amount is how many tokens you want to get or give.|
|sqrt_price_limit|SqrtPrice|If swap achieves that square root of price it will be cancelled.|
Performs a swap based on provided parameters. Takes tokens from user address to contract address and sends tokens from user address to contract address. Swap will fail if user won't have enough tokens or won't approve enough tokens.

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
|Name|Type|Description|
|-|-|-|
|pool_key|PoolKey|Pool key of pool that you want to swap on.|
|x_to_y|bool|Specifies direction of a swap.|
|amount|TokenAmount|Amount of tokens you want to get or give.|
|by_amount_in|bool|Specifies if entered amount is how many tokens you want to get or give.|
|sqrt_price_limit|SqrtPrice|If swap achieves that square root of price it will be cancelled.|
Performs a swap simulation based on provided parameters and returns amount in and amount out, price and list of ticks that changed after swap. Does not takes or sends any tokens.