---
title: Transaction priority

slug: /transaction_priority
---

**Unlock the full potential** of your Solana trading experience with Invariant's settings section. Here, you can **customize your fees** for transactions and tailor transaction confirmation times to match your trading goals.

![settings](/img/docs/app/settings.png)

### Transaction priority

This feature allows you to adjust the transaction fee or priority level when making trades on the Invariant platform. By setting your transaction priority, you can control the speed and likelihood of your transactions being confirmed on the Solana network. 

**Adjust transaction fees and priority levels** to control the speed and likelihood of your transactions being confirmed on the Solana network. By setting your transaction priority, you can ensure your swaps are processed promptly and efficiently, even during periods of high network congestion.

#### Why is it needed?

<blockquote>
  Transaction fees, including priority fees on the Solana blockchain, are necessary to incentivize validators to include your transaction in the next block. These fees act like a priority mechanism. Without them, validators might prioritize transactions based on their computational demand, potentially causing delays for low-fee transactions. Priority fees allow users to expedite their transactions by paying a higher fee, ensuring timely processing even during periods of network congestion.
</blockquote>

![transaction priority](/img/docs/app/transaction_priority.png)

#### Transaction Priority Levels:

1. Normal Priority (Max 0.000005 SOL - 1x Market Fee): This is the default priority level, providing standard transaction processing. Transactions at this level typically have lower fees and may experience longer confirmation times during periods of network congestion.

2. Market Priority (Max 0.001 SOL - 85% Percentile Fees from Last 20 Blocks): Market priority adjusts the fee based on recent network activity, aiming for faster confirmation than normal priority while still maintaining competitive fees.

3. High Priority (Max 0.05 SOL - 5x Market Fee): High priority offers expedited transaction processing by bidding a higher fee. This level is suitable for users who require faster confirmation times, especially during periods of high network congestion.

4. Turbo Priority (Max 0.1 SOL - 10x Market Fee): Turbo priority maximizes transaction speed by bidding a significantly higher fee than the market rate. It is ideal for urgent transactions that require immediate confirmation.

5. Custom Priority (Max 2 SOL): For users who require precise control over transaction priority, the custom priority option allows you to set your desired fee up to a maximum of 2 SOL. This enables flexibility in adjusting the fee according to your specific needs.
