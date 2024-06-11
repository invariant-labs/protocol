---
title: Swap

slug: /eclipse/swap
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

### Swap simulation

As u can see when setting `swapVars` the value `estimatedPriceAfterSwap` should be supplied. To obtain this number, perform swap simulation, specifically:

```ts
  const simProps: SimulateSwapInterface = {
  xToY: boolean
  byAmountIn: boolean
  swapAmount: BN
  priceLimit: Decimal
  slippage: Decimal
  ticks: Map<number, Tick>
  tickmap: Tickmap
  pool: PoolData
  }

  simulateSwap(simProps)
```

The following is an example of usage.

```ts
const poolData = await market.getPool(pair)

const simProps: SimulateSwapInterface = {
  xToY: true,
  byAmountIn: true,
  swapAmount: new anchor.BN(1e10),
  priceLimit: poolData.sqrtPrice,
  slippage: { v: new anchor.BN(DENOMINATOR) },
  ticks,
  tickmap: await market.getTickmap(pair),
  pool: poolData
}

const result = simulateSwap(simProps)
```
