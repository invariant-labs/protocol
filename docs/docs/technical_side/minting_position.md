---
title: Minting a Position

slug: /sdk/minting_position
---

After pool creation you can create position (see [`create_position.rs`](https://github.com/invariant-labs/protocol/blob/master/programs/invariant/src/instructions/create_state.rs)).

In this guide, you will learn how to mint a new liquidity position, add liquidity, and then remove liquidity.

```ts
const props: InitPoolAndPosition = {
  pair,
  owner: owner.publicKey,
  userTokenX,
  userTokenY,
  lowerTick,
  upperTick,
  liquidityDelta: { v: liquidity },
  initTick: pair.tickSpacing * 3
}
```
