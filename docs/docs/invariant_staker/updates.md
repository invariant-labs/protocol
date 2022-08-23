---
title: Reward updates

slug: /invariant_staker/updates
---

Rewards amount depends on user’s active liquidity over time what is described by secondsPerLiquidity factor which is saved on user position. Every time when this factor is increasing, rewards are also increasing. User’s secondsPerLiquidity depends on secondsPerLiquidityGlobal which is updated basen on all active liquidity over time therfore if this factor increse user rewards also grow. Update frequency depends on time and all liquidity but also in case of withdraw rewards update is triggered by direct instruction before withdraw.
