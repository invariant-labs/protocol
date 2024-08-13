---
title: Types

slug: /alephium/types
---

This segment introduces key data types essential for understanding and working with the Invariant Protocol. Additionally, it's important to note that these types are defined based on decimals, holding numerical values, and serving as fundamental types in the storage layer.

## Definition

We are following a strict naming convention for decimals and their associated constants, their basic in Ralph is as follows:

```rust
struct DecimalName{mut v: U256}
const DECIMAL_NAME_SCALE = #scale
const DECIMAL_NAME_DENOMINATOR = 10**#scale
```

| Name             | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| #scale           | An integer that determines the number of decimal places.                   |
| DecimalName      | The name of the struct.                                                    |
| DECIMAL_NAME_SCALE | The constant holding the decimal scale.                                 |
| DECIMAL_NAME_DENOMINATOR     | The constant holding the denominator, which equals 10 to the power of scale  |


### Examples

Creating a custom decimal type with name "Decimal", 3 decimal places, u128 as underyling type and default big type (U256):

```rust
struct Decimal( mut v: U256)
const DECIMAL_SCALE = 3
const DECIMAL_DENOMINATOR = 10**DECIMAL_SCALE
```

Creating a decimal value:

```rust
let my_decimal = Decimal{v: 12042};
```

In this example, the result of creation should be interpreted as 12.042, calculated as `12042 * 10^-3`, considering the specified scale of 3.

## Definitions

These decimal types are integral to the protocol, offering a granular level of precision for various calculations. They play key roles in pricing, fee accumulation, liquidity representation, percentage metrics, time measurements, and token quantity tracking, contributing to the robust functionality of the Invariant Protocol.

| Name                | Decimals |   Description                                       |
| ------------------- | -------- | --------------------------------------------------- |
| TokenAmount         | 0        |  Quantity of specific token                         |
| SqrtPrice           | 24       |  Square root of price value                         |
| FixedPoint          | 12       |  Number with fixed number of decimal places         |
| Liquidity           | 5        |  Amount of virtual liquidity                        |
| Percentage          | 12       |  A numerical percentage value                       |
| FeeGrowth           | 28       |  Accumulated amount of fees per unit of liquidity   |

### TokenAmount

The TokenAmount type stores **integer** token amounts.

```rust
struct TokenAmount{
    mut v: U256
}
const TOKEN_AMOUNT_SCALE = 0
const TOKEN_AMOUNT_DENOMINATOR = 10**TOKEN_AMOUNT_SCALE
```

### SqrtPrice

The SqrtPrice type stores the **square root** of the y-to-x token ratio.

```rust
struct SqrtPrice{
    mut v: U256
}
const SQRT_PRICE_SCALE = 24
const SQRT_PRICE_DENOMINATOR = 10**SQRT_PRICE_SCALE
```

### FixedPoint

FixedPoint is a type used for precise arithmetic calculations, with half the accuracy of SqrtPrice.

```rust
struct FixedPoint{
    mut v: U256
}
const FIXED_POINT_SCALE = 12
const FIXED_POINT_DENOMINATOR = 10**FIXED_POINT_SCALE
```

### Liquidity

The liquidity type represents a value that indicates the ability to exchange. Liquidity is determined by the product of the amount of tokens X, the amount of tokens Y, or the sum of X and Y, and the level of concentration. It is associated with a specific price range. As a result, it can be either active or inactive, depending on whether the current price is within or outside the liquidity range.

```rust
struct Liquidity{
    mut v: U256
}
const LIQUIDITY_SCALE = 5
const LIQUIDITY_DENOMINATOR = 10**LIQUIDITY_SCALE
```

### Percentage

The type represents a percentage and is used to simplify interest calculations for various types.

```rust
struct Percentage{
    mut v: U256
}
const PERCENTAGE_SCALE = 12
const PERCENTAGE_DENOMINATOR = 10**PERCENTAGE_SCALE
```

### FeeGrowth

FeeGrowth is used to calculate the fee amount within a specified price range. FeeGrowth represents TokenAmount in X or Y per unit of liquidity.

```rust
struct FeeGrowth{
    mut v: U256
}
const FEE_GROWTH_SCALE = 28
const FEE_GROWTH_DENOMINATOR = 10**FEE_GROWTH_SCALE
```

