---
title: Priority fees

slug: /priority_fees
---

**Unlock the full potential** of your Solana trading experience with Invariant's settings section. Here, you can **customize your priority fees**.

![settings](/img/docs/app/fee_btn.png)

### Transaction priority

This feature allows you to adjust the transaction fee when making trades on the Invariant platform. By setting your transaction priority, you can control how much additional fee will be applied to your transaction, influencing higher chances of confirming the transaction on the Solana network.

#### Why is it needed?

<blockquote>
Priority fees on the Solana blockchain are necessary to incentivize validators to include your transaction in the next block. These fees act as a priority mechanism, allowing users to increase their chances of passing their transactions by paying a higher fee, <b>ensuring transaction processing even during periods of network congestion</b>.
</blockquote>

![transaction priority](/img/docs/app/transaction_priority.png)

#### Transaction Priority Levels:

1. Normal Priority (Max 0.000005 SOL - 1x Market Fee) - This is the default priority level, providing standard transaction processing. Transactions during network congestion will have lower chances of passing.

2. Market Priority (Max 0.001 SOL - 85% Percentile Fees from Last 20 Blocks) - This priority fee will ensure that your transaction passes in most cases.

3. High Priority (Max 0.05 SOL - 5x Market Fee) - High priority fee when network congestion is very high.

4. Turbo Priority (Max 0.1 SOL - 10x Market Fee) - Turbo priority fee when network congestion is extremely hight.

5. Custom Priority (Max 2 SOL) - For users who require precise control over transaction priority, the custom priority option allows you to set a priority fee up to a maximum of 2 SOL.
