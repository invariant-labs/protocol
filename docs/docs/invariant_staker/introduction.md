---
title: Introduction

slug: /invariant_staker/introduction
---

The liquidity mining **Staker** is made up of a single canonical position staking contract. The technical reference for this contract may be found here, as well as the source code.

### Data structures

```rust
pub struct Incentive {
    pub founder: Pubkey,
    pub token_account: Pubkey,
    pub total_reward_unclaimed: Decimal,
    pub total_seconds_claimed: Decimal,
    pub start_time: u64,
    pub end_time: u64,
    pub end_claim_time: u64,
    pub num_of_stakes: u64,
    pub pool: Pubkey,
    pub nonce: u8,
}

pub struct UserStake {
    pub incentive: Pubkey,
    pub position: Pubkey,
    pub seconds_per_liquidity_initial: Decimal,
    pub liquidity: Decimal,
    pub bump: u8,
}
```
