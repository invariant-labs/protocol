---
title: Withdraw

slug: /eclipse/withdraw
---

Withdrawing your position is analogous to their creation. Use following this code.

```ts
const removePositionVars: RemovePosition = {
  pair: Pair,
  owner: Pubkey,
  index: number,
  userTokenX: PublicKey,
  userTokenY: PublicKey
}
await market.removePosition(removePositionVars, positionOwner)
```
