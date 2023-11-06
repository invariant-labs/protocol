---
title: Minting a Position

slug: /solana/minting_position
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

To get and choose suitable `feeTier`, see `FEE_TIER` constant, i.e.

```ts
const FEE_TIERS: FeeTier[] = [
  { fee: fromFee(new BN(1)) },
  { fee: fromFee(new BN(10)) },
  { fee: fromFee(new BN(50)) },
  { fee: fromFee(new BN(100)) },
  { fee: fromFee(new BN(300)) },
  { fee: fromFee(new BN(1000)) }
]
```

This fee tiers correspond to percentages: 0.01%, 0.05%, 0.1%, 0.3%, 1%.

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
  index: number, //index of position for specific pool
  userTokenX: userTokenXAccount,
  userTokenY: userTokenYAccount
}
```

To fetch list of all your positions and and get index of specific position use function.

```ts
getPositionList(owner: PublicKey)
```

After that make use of function

```ts
await market.removePosition(removePositionVars, positionOwner)
```
