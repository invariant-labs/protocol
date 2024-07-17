---
title: Storage

slug: /alephium/storage
---

This section provides an in-depth exploration of key data structures integral to the Invariant protocol's storage mechanism. These structs are specifically crafted to facilitate the sharing of the state of the exchange within the CLAMM model. These data structures play a pivotal role in maintaining and organizing information related to the exchange, ensuring efficient and organized handling of data.

## Invariant Config

```rust
struct InvariantConfig {  
    admin: Address,  
    mut protocolFee: U256  
 }
```

| Name         | Type       | Description                                                                                                                                                                                 |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| admin        | Address  | Account address of protocol admin. Admin is able to change fee, claim protocol fee or set the fee receiver, but cannot interfere with user positions or deposits and cannot close the pool. |
| protocolFee | U256 | Percentage of the fee collected upon every swap in the pool that goes to the protocol, the rest goes to LP.                                                                                     |

## FeeTier

```rust
struct FeeTier {
    mut fee: U256,
    mut tickSpacing: U256
}
```

| Name         | Type       | Description                                                  |
| ------------ | ---------- | ------------------------------------------------------------ |
| fee          | U256 | Percentage of the fee collected upon every swap in the pool. |
| tickSpacing | U256        | The spacing between usable ticks.                            |

## PoolKey

```rust
struct PoolKey {
    mut tokenX: ByteVec,
    mut tokenY: ByteVec,
    mut feeTier: FeeTier
}
```

| Name     | Type      | Description                   |
| -------- | --------- | ----------------------------- |
| tokenX  | ByteVec | The contract id of x token.           |
| tokenY  | ByteVec | The contract id of y token.           |
| feeTier | FeeTier   | FeeTier associated with the pool. |

## Pool

```rust
struct Pool {
    mut poolKey: PoolKey,
    mut liquidity: U256,
    mut sqrtPrice: U256,
    mut currentTickIndex: I256,
    mut feeGrowthGlobalX: U256,
    mut feeGrowthGlobalY: U256,
    mut feeProtocolTokenX: U256,
    mut feeProtocolTokenY: U256,
    mut startTimestamp: U256,
    mut lastTimestamp: U256,
    mut feeReceiver: Address,
    mut reserveX: ByteVec,
    mut reserveY: ByteVec
}
```
| Name                 | Type        | Description                                                                                                                                     |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| poolKey            | PoolKey   | PoolKey associated with the pool. |
| liquidity            | U256   | Amount of virtual liquidity on pool. The difference between virtual and actual liquidity reflect the increased capital efficiency in Invariant. |
| sqrtPrice           | U256   | Square root of current price.                                                                                                                   |
| currentTickIndex   | I256         | The nearest tick below the current price, aligned with tick spacing.                                                                                                       |
| feeGrowthGlobalX  | U256   | Amount of fees accumulated in x token in per one integer unit of Liquidity since pool initialization.                                           |
| feeGrowthGlobalY  | U256   | Amount of fees accumulated in y token in per one integer unit of Liquidity since pool initialization.                                           |
| feeProtocolTokenX | U256 | Amount of protocol tokens accumulated in x token that are available to claim.                                                                   |
| feeProtocolTokenY | U256 | Amount of protocol tokens accumulated in y token that are available to claim.                                                                   |
| startTimestamp      | U256         | Time of pool initialization.                                                                                                                    |
| lastTimestamp       | U256         | Last update of pool.                                                                                                                            |
| feeReceiver         | Address   | Address of entity enabling to claim protocol fee. By default it is admin but can be change for specific pool.|
| reserveX         | ByteVec   | ContractId of the Reserve hosting the first token type.|
| reserveY         | ByteVec   | ContractId of the Reserve hosting the second token type.|


## Position

```rust
struct Position {
    mut poolKey: PoolKey,
    mut liquidity: U256,
    mut lowerTickIndex: I256,
    mut upperTickIndex: I256,
    mut feeGrowthInsideX: U256,
    mut feeGrowthInsideY: U256,
    mut lastBlockNumber: U256,
    mut tokensOwedX: U256,
    mut tokensOwedY: U256,
    mut owner: Address
}
```

| Name                | Type        | Description                                                                                                                             |
| ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| poolKey            | U256     | Pool key identifying on which Pool the position has been opened.                                                                     |
| liquidity           | U256   | Amount of immutable virtual liquidity that the position represents.                                                                     |
| lowerTickIndex    | I256         | Lower tick index of the Position.                                                                                                       |
| upperTickIndex    | I256         | Upper tick index of the Position.                                                                                                       |
| feeGrowthInsideX | U256   | Amount of fees accumulated in x token per one integer unit of Liquidity in-range. It is used to determine the shares of collected fees. The feeGrowthInsideX value does not directly indicate the amount of fees accumulated; instead, it serves as a snapshot of the counter used to calculate the fees enabled to claim from position. |
| feeGrowthInsideY | U256   | Amount of fees accumulated in y token per one integer unit of Liquidity in-range. It is used to determine the shares of collected fees. The feeGrowthInsideY value does not directly indicate the amount of fees accumulated; instead, it serves as a snapshot of the counter used to calculate the fees enabled to claim from position. |
| lastBlockNumber   | U256         | Last update of position expressed in block number.                                                                                      |
| tokensOwedX       | U256 | The quantity of x tokens collected in fees that is available for claiming. It typically equals zero because converting `FeeGrowth` into a `TokenAmount` nomination also triggers immediate claiming of the tokens. |
| tokensOwedY       | U256 | The quantity of y tokens collected in fees that is available for claiming. It typically equals zero because converting `FeeGrowth` into a `TokenAmount` nomination also triggers immediate claiming of the tokens.|
| owner       | Address | The owner of the position. |


## Tick

```rust
struct Tick {
    mut sign: Bool,
    mut index: I256,
    mut liquidityChange: U256,
    mut liquidityGross: U256,
    mut sqrtPrice: U256,
    mut feeGrowthOutsideX: U256,
    mut feeGrowthOutsideY: U256,
    mut secondsOutside: U256
}
```

| Name                 | Type      | Description                                                                                                                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sign | bool      | Determine if the liquidity will be added or subtracted on cross. |
| index                | I256       | Index of tick. |
| liquidityChange     | U256 | The amount of virtual liquidity that will be added/removed from the current liquidity in the pool at the time of crossing this tick. |
| liquidityGross      | U256 | Amount of virtual liquidity to be added on the tick, excluding liquidity taken on that tick. It is used to impose the maximum liquidity that can be place on a single tick. |
| sqrtPrice           | U256 | Square root of tick price with less precision than the usual current price.|
| feeGrowthOutsideX | U256 | Amount of Fees accumulated in x token outside-range. This value does not indicate the amount of fee collected outside of the tick; it should be interpreted relative to other `FeeGrowth` values. |
| feeGrowthOutsideY | U256 | Amount of Fees accumulated in y token outside-range. This value does not indicate the amount of fee collected outside of the tick; it should be interpreted relative to other `FeeGrowth` values. |
| secondsOutside | U256  | Seconds outside-range. |

## TickmapBatch

```rust
struct TickmapBatch {
    mut chunks: [U256; 94]
}
```

 Name                 | Type      | Description                                                                                                                                                                 |
| -------------------- | --------- | --------------------------------------------- |
| chunks | [U256;94] | Chunks stored in a single TickmapBatch. |

## Reserve

```rust
Contract Reserve(invariant: Address, mut assetsStored: U256) {...}
```

 Name                 | Type      | Description                                                                                                                                                                 |
| -------------------- | --------- | -------------------------------------------------- |
| invariant | Address | Address of the Invariant contract. |
| assetsStored | U256 | Count of tokens currently stored in the `Reserve`. |