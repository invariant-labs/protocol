---
title: Types

slug: /casper/types
---

This segment introduces key data types essential for understanding and working with the Invariant protocol. Additionally, it's important to note that these types are defined based on decimals, holding numerical values, and serving as fundamental types in the storage layer.

## Defining Decimal:

We have implemented a custom decimal system, which is detailed in our repository [here](https://github.com/invariant-labs/decimal). The structure of the decimal is outlined below in Rust syntax:

```rust
#[decimal(#scale, #big_type)]
pub struct DecimalName {
  pub v: #underlying_type
}
```

| Name             | Description                                              |
| ---------------- | -------------------------------------------------------- |
| #scale           | An integer that determines the number of decimal places. |
| #big_type        | The type to which it will be extended in big operations. |
| DecimalName      | The name of the struct.                                  |
| #underlying_type | The underlying numeric type.                             |

### Examples

Creating a custom decimal type with name "Decimal", 3 decimal places, U128 as underyling type and U256 as big type:

```rust
#[decimal(3, U256)]
pub struct Decimal {
  pub v: U128
}
```

Creating a decimal value:

```rust
let my_decimal = Decimal::new(U128::from(12042));
```

In this example, the result of creation should be interpreted as 12.042, calculated as `12042 * 10^-3`, considering the specified scale of 3.

## Defining Custom Types

For some calculations we have implemented our custom types, which are constructed using [uint](https://crates.io/crates/uint) and [borsh](https://crates.io/crates/borsh). The structure is outlined below in Rust syntax:

```rust
construct_uint! {
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct TypeName(scale);
}
```

| Name     | Description                                            |
| -------- | ------------------------------------------------------ |
| #scale   | An integer that determines the number of 64-bit words. |
| TypeName | The name of the struct.                                |

### Examples

Creating a custom type that will hold 192 bits (3 x 64-bit words).

```rust
construct_uint! {
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct U192T(3);
}
```

## Definitions

These decimal types are integral to the protocol, offering a granular level of precision for various calculations. They play key roles in pricing, fee accumulation, liquidity representation, percentage metrics, time measurements, and token quantity tracking, contributing to the robust functionality of the Aleph Zero protocol.

| Name                | Decimals | Odra type | Big type | Description                                        |
| ------------------- | -------- | --------- | -------- | -------------------------------------------------- |
| TokenAmount         | 0        | U256      | U512     | Quantity of specific token                         |
| SqrtPrice           | 24       | U128      | U384     | Square root of price value                         |
| FixedPoint          | 12       | U128      | U192     | Number with fixed number of decimal places         |
| Liquidity           | 5        | U256      | U512     | Amount of virtual liquidity                        |
| Percentage          | 12       | U128      | U256     | A numerical percentage value                       |
| FeeGrowth           | 28       | U128      | U256     | Accumulated amount of fees per unit of liquidity   |
| SecondsPerLiquidity | 25       | U128      | U256     | Measures the time in seconds per unit of liquidity |

### TokenAmount

The TokenAmount type stores **integer** token amounts.

```rust
#[decimal(0, U512)]
pub struct TokenAmount {
    pub v: U256,
}
```

### SqrtPrice

The SqrtPrice type stores the **square root** of the y-to-x token ratio.

```rust
#[decimal(24, U384T)]
pub struct SqrtPrice {
    pub v: U128,
}
```

### FixedPoint

FixedPoint is a type used for precise arithmetic calculations, with half the accuracy of SqrtPrice.

```rust
#[decimal(12, U192T)]
pub struct FixedPoint {
    pub v: U128,
}
```

### Liquidity

The liquidity type represents a value that indicates the ability to exchange. Liquidity is determined by the product of the amount of tokens X, the amount of tokens Y, or the sum of X and Y, and the level of concentration. It is associated with a specific price range. As a result, it can be either active or inactive, depending on whether the current price is within or outside the liquidity range.

```rust
#[decimal(5, U512)]
pub struct Liquidity {
    pub v: U256,
}
```

### Percentage

The type represents a percentage and is used to simplify interest calculations for various types.

```rust
#[decimal(12, U256)]
pub struct Percentage {
    pub v: U128,
}
```

### FeeGrowth

FeeGrowth is used to calculate the fee amount within a specified price range. FeeGrowth represents TokenAmount in X or Y per unit of liquidity.

```rust
#[decimal(28, U256)]
pub struct FeeGrowth {
    pub v: U128,
}
```

### SecondsPerLiquidity

SecondsPerLiquidity represents the time difference denominated in seconds per liquidity unit.

```rust
#[decimal(25, U256)]
pub struct SecondsPerLiquidity {
    pub v: U128,
}
```
