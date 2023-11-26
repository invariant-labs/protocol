---
title: Types

slug: /aleph_zero/types
---

This segment introduces key data types integral to understanding and working with the Aleph Zero protocol. These types play a pivotal role in expressing and managing various aspects of the protocol's functionality.

## Defining Decimal:
We have implemented a custom decimal system, which is detailed in our repository [here](https://github.com/invariant-labs/decimal). The structure of the decimal is outlined below in Rust syntax:
```rust
#[decimal(#scale, #big_type)]
pub struct DecimalName {
  pub v: #underlying_type
}
```
- **#scale**: An `integer` that determines the number of decimal places.
- **#big_type**: The type to which it will be extended in intermediate operations (default is U256).
- **DecimalName**: The name of the struct.
- **#underlying_type**: The underlying numeric type.

### Examples

Creating a custom decimal type with 3 decimal places:

```rust
#[decimal(3)]
pub struct Decimal {
  pub v: u128
}
```

Creating a decimal value:

```rust
let my_decimal = Decimal::new(12042);
```
In this example, the result of creation should be interpreted as 12.042, calculated as `12042 * 10^-3`, considering the specified scale of 3.

|Name|Decimals|Primitive type|Big type|Description|
|-|-|-|-|-|
|SqrtPrice|24|u128|U256|Square root of price value|
|FeeGrowth|28|u128|U256|Accumulated amount of fees|
|FixedPoint|12|u128|U256|Number with fixed number of decimal places|
|Liquidity|6|u128|U256|Amount of virtual liquidity|
|Percentage|12|u64|U256|Represents values as fractions of 100|
|SecondsPerLiquidity|24|u128|U256|Measures the time inside/outside liquidity|
|TokenAmount|0|u128|U256|Quantity of specific token|

## Definitions

### SqrtPrice

```rust
#[decimal(24)]
pub struct SqrtPrice {
    pub v: u128,
}
```

### FeeGrowth
```rust
#[decimal(28)]
pub struct FeeGrowth {
    pub v: u128,
}
```
### FixedPoint
```rust
#[decimal(12)]
pub struct FixedPoint {
    pub v: u128,
}
```
### Liquidity
```rust
#[decimal(6)]
pub struct Liquidity {
    pub v: u128,
}
```
### Percentage
```rust
#[decimal(12)]
pub struct Percentage {
    pub v: u64,
}
```
### SecondsPerLiquidity
```rust
#[decimal(24)]
pub struct SecondsPerLiquidity {
    pub v: u128,
}
```
### TokenAmount
```rust
#[decimal(0)]
pub struct TokenAmount(pub u128);
```