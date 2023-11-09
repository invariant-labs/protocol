---
title: Types

slug: /aleph_zero/types
---


|Name|Description|
|-|-|
|SqrtPrice|Square root of price value|
|FeeGrowth|Accumulated amount of fees|
|FixedPoint|Number with fixed number of decimal places|
|Liquidity|Amount of virtual liquidity|
|Percentage|Represents values as fractions of 100|
|SecondsPerLiquidity|Measures the time inside/outside liquidity|
|TokenAmount|Quantity of specific token|

## Definitions

### SqrtPrice

```rust
pub struct SqrtPrice {
    pub v: u128,
}
```

### FeeGrowth
```rust
pub struct FeeGrowth {
    pub v: u128,
}
```
### FixedPoint
```rust
pub struct FixedPoint {
    pub v: u128,
}
```
### Liquidity
```rust
pub struct Liquidity {
    pub v: u128,
}
```
### Percentage
```rust
pub struct Percentage {
    pub v: u64,
}
```
### SecondsPerLiquidity
```rust
pub struct SecondsPerLiquidity {
    pub v: u128,
}
```
### TokenAmount
```rust
pub struct TokenAmount(pub u128);
```