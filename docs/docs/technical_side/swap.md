---
title: Swap

slug: /technical_side/swap
---

Swaps are the most common interaction with the Invariant protocol. The following code shows you how to implement a single swap:

```ts
const swapVars: Swap = {
  pair: Pair,
  xToY: boolean,
  amount: BN,
  estimatedPriceAfterSwap: Decimal,
  slippage: Decimal,
  accountX: PublicKey,
  accountY: PublicKey,
  byAmountIn: boolean,
  owner: PublicKey
}
await market.swap(swapVars, owner)
```
