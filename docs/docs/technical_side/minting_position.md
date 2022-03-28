---
title: Minting a Position

slug: /technical_side/minting_position
---

After pool creation you can create position (see [`create_position.rs`](<(https://github.com/invariant-labs/protocol/blob/master/sdk/src/market.ts)>).

You will learn how to create a new liquidity position, add liquidity, and then remove liquidity in this guide.

Declare first-position props at the start.

```ts
const props: InitPoolAndPosition = {
  pair: Pair,
  owner: PublicKey,
  userTokenX: PublicKey,
  userTokenY: PublicKey,
  lowerTick: number,
  upperTick: number,
  liquidityDelta: Decimal,
  initTick: number,
  knownPrice: Decimal,
  slippage: Decimal
}
```

Pair is a two-token structure with a corresponding fee tier.

```ts
pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
```

Following that declaration, call to initialize Pool and Position.

```ts
await market.initPoolAndPosition(props, owner)
```

`owner` refers to the public key linked with the keypair. To add more liquidity, you must also open a second position on the same keypair.

To remove a position, declare props as follows:

```ts
const removePositionVars: RemovePosition = {
  pair: Pair,
  owner: PublicKey,
  publicKey,
  index, //index of position for specific pool
  userTokenX: userTokenXAccount,
  userTokenY: userTokenYAccount
}
```

then make use of function

```ts
await market.removePosition(removePositionVars, positionOwner)
```
