---
title: Ticks

slug: /ticks
---

Without ticks, there is no possible way to make concentrated liquidity work.

Tick is the boundaries between discrete areas in price space. It represents a $0.01\%$ difference in the price.

To better illustrate what a tick is, we will show it with an example.
Imagine, than you are creating liquidity position, and you have to choose price range.

![One side liquidity](/img/docs/app/price_range.png)

Every time a price is calculated by multiplying it by the previous price by $1.0001$, then the price change is always the same as $0.01 \%$.

There is also the concept _of tick spacing_ for each pool e.g., a tick spacing of 5 requires ticks to be initialized every 5th tick i.e., ..., -10, -5, 0, 5, 5, ...
