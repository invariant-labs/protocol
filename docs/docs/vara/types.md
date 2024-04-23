---
title: Types

slug: /vara/types
---

This segment introduces key data types essential for understanding and working with the Invariant Protocol. Additionally, it's important to note that these types are defined based on decimals, holding numerical values, and serving as fundamental types in the storage layer.

## Defining Decimal

We have implemented a custom decimal system, which is detailed in our repository [here](https://github.com/invariant-labs/decimal). The structure of the decimal is outlined below in Rust syntax:

```rust
#[decimal(#scale, #big_type)]
pub struct DecimalName(pub #underlying_type)
```

| Name             | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| #scale           | An integer that determines the number of decimal places.                   |
| #big_type        | The type to which it will be extended in big operations (default is U256). |
| DecimalName      | The name of the struct.                                                    |
| #underlying_type | The underlying numeric type.                                               |

### Examples

Creating a custom decimal type with name "Decimal", 3 decimal places, u128 as underyling type and default big type (U256):

```rust
#[decimal(3)]
pub struct Decimal(pub u128)
```

Creating a decimal value:

```rust
let my_decimal = Decimal::new(12042);
```

In this example, the result of creation should be interpreted as 12.042, calculated as `12042 * 10^-3`, considering the specified scale of 3.

## Definitions

These decimal types are integral to the protocol, offering a granular level of precision for various calculations. They play key roles in pricing, fee accumulation, liquidity representation, percentage metrics, time measurements, and token quantity tracking, contributing to the robust functionality of the Invariant Protocol.

| Name                | Decimals | Primitive type | Big type | Description                                        |
| ------------------- | -------- | -------------- | -------- | -------------------------------------------------- |
| TokenAmount         | 0        | u128           | U256     | Quantity of specific token                         |
| SqrtPrice           | 24       | u128           | U256     | Square root of price value                         |
| FixedPoint          | 12       | u128           | U256     | Number with fixed number of decimal places         |
| Liquidity           | 6        | u128           | U256     | Amount of virtual liquidity                        |
| Percentage          | 12       | u64            | U256     | A numerical percentage value                       |
| FeeGrowth           | 28       | u128           | U256     | Accumulated amount of fees per unit of liquidity   |
| SecondsPerLiquidity | 24       | u128           | U256     | Measures the time in seconds per unit of liquidity |

### TokenAmount

The TokenAmount type stores **integer** token amounts.

```rust
#[decimal(0)]
pub struct TokenAmount(pub u128);
```

### SqrtPrice

The SqrtPrice type stores the **square root** of the y-to-x token ratio.

```rust
#[decimal(24)]
pub struct SqrtPrice(pub u128);
```

### FixedPoint

FixedPoint is a type used for precise arithmetic calculations, with half the accuracy of SqrtPrice.

```rust
#[decimal(12)]
pub struct FixedPoint(pub u128);
```

### Liquidity

The liquidity type represents a value that indicates the ability to exchange. Liquidity is determined by the product of the amount of tokens X, the amount of tokens Y, or the sum of X and Y, and the level of concentration. It is associated with a specific price range. As a result, it can be either active or inactive, depending on whether the current price is within or outside the liquidity range.

```rust
#[decimal(6)]
pub struct Liquidity(pub u128);
```

### Percentage

The type represents a percentage and is used to simplify interest calculations for various types.

```rust
#[decimal(12)]
pub struct Percentage(pub u64);
```

### FeeGrowth

FeeGrowth is used to calculate the fee amount within a specified price range. FeeGrowth represents TokenAmount in X or Y per unit of liquidity.

```rust
#[decimal(28)]
pub struct FeeGrowth(pub u128);
```

### SecondsPerLiquidity

SecondsPerLiquidity represents the time difference measured in seconds per liquidity unit. This metric is employed to calculate the accumulated time during which the price was situated between any given ticks. While not essential for the core functionality of CLAMM, it serves a crucial role in constructing farms or incentives for token distribution across diverse models. For instance, it enables the prioritization of the most concentrated liquidity, fostering the development of farms and incentives that align with specific liquidity concentration preferences.

```rust
#[decimal(24)]
pub struct SecondsPerLiquidity(pub u128);
```
