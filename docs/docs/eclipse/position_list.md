---
title: Position

slug: /eclipse/position_list
---

To make adding, removing and finding all users position more clear, we create `PositionList` structure which helps to dynamically menage users positions.

```rust
pub struct PositionList {
    pub head: u32,
    pub bump: u8,
}
```

Parameter `head` is just a number of users active position. When a new position is added to the list, the argument head increases, and when a position is removed, the argument decreases.

```rust
pub struct Position {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub id: u128, // unique inside pool
    pub liquidity: Liquidity,
    pub lower_tick_index: i32,
    pub upper_tick_index: i32,
    pub fee_growth_inside_x: FeeGrowth,
    pub fee_growth_inside_y: FeeGrowth,
    pub seconds_per_liquidity_inside: FixedPoint,
    pub last_slot: u64,
    pub tokens_owed_x: FixedPoint,
    pub tokens_owed_y: FixedPoint,
    pub bump: u8,
}
```

In SDK there are some useful functions, which allows to add, remove and fetch positions in a constant time due to the structure of PositionList.

To init new position firstly se `InitPosition` interface as follow:

```ts
const initPositionVars: InitPosition = {
  pair: Pair,
  owner: PublicKey,
  userTokenX: PublicKey,
  userTokenY: PublicKey,
  lowerTick: number,
  upperTick: number,
  liquidityDelta: Decimal,
  knownPrice: Decimal,
  slippage: Decimal
}
```

and call

```ts
await market.initPosition(initPositionVars, positionOwner)
```

Similar manner is for removing position.
To fetch position by index use

```ts
await market.getPosition(owner: PublicKey, index: number)
```

or fetch all

```ts
await market.getPositionList(owner: PublicKey)
```

also is possible to fetch all user positions as 'PositionStructure[]'

```ts
await market.getAllUserPositions(owner: PublicKey)
```

which contains

```ts
interface PositionStructure {
  tokenX: PublicKey
  tokenY: PublicKey
  feeTier: FeeTier
  amountTokenX: BN
  amountTokenY: BN
  lowerPrice: Decimal
  upperPrice: Decimal
  unclaimedFeesX: BN
  unclaimedFeesY: BN
}
```

| Variable         | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- |
| `tokenX`         | Position's token x mint address                                                    |
| `tokenY`         | Position's token y mint address                                                    |
| `amountTokenX`   | Amount of token x based on current state                                           |
| `amountTokenY`   | Amount of token y based on current state                                           |
| `lowerPrice`     | Lower position's price with 8 decimals calculated on the basis of lower tick index |
| `upperPrice`     | Upper position's price with 8 decimals calculated on the basis of upper tick index |
| `unclaimedFeesX` | Unclaimed fees in token x based on current state                                   |
| `unclaimedFeesY` | Unclaimed fees in token y based on current state                                   |
