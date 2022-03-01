---
title: Fees

slug: /what_is/fees
---

### Swap Fees

Fee, is a mathematical representation of the fee paid by swappers in hundredths of a percent, and it is initialized with a predetermined value in each pool. Two numbers <code>fee_growth_global_x</code> and <code>fee_growth_global_y</code> are the global fees (in $x$ and $y$) that LPs have accrued. When a swap occurs, the values of all of the above variables change. However, only $L$ changes when liquidity is provided or removed.

When the tick is crossed, the contract must keep track of the amount of gross liquidity that should be added or withdrawn, as well as the fees received above and below the tick, in order to be effective. When the tick indexes are updated, the variables in the tick-indexed state are updated. Consider that, after updating the contract's global state, the pool changes the fees collected and liquidity at the precise price point, which is upper tick and lower tick in the contract's global state (lower tick).

It also keeps track of the current protocol fee. It is set to a constant value of $0.1$ and generates a portion of the swapper fees that are currently going to protocol rather than liquidity providers.
