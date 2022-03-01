---
title: Concentrated Liquidity

slug: /what_is/concentrated_liquidity
---

It’s our main feature.  
It enables maximum capital efficiency.  
In common liquidity pools, liquidity is distributed along the whole price curve.  
Here, in Invariant, you can choose an exact price range. As a result, the whole amount invested will earn for you.  
As a result, your capital can be even 4000x more efficient.  
Sounds great, right?

### Introduction

In Invariant we can allocate liquidity within a custom price range. It means that user sets a price range $[p_l, p_u]$, where $p_l, p_u$ means lower and the upper price of a specific range.

Also our protocol allows to set price range on entire price space, ie. the $(0, \infty)$ integral. It means that user gives liquidity on every initialized tick (the concept about we will talk more in later part).

With Invariant LPs mac concentrate their capital to smaller price intervals than $(0,\infty)$. A good example is pool of stablecoins. The liquidity outside the typical price range of a stablecoin pair is rarely touched. For example, an LP may choose to allocate capital solely to the $(0.99, 1.01)$ range. As a result, traders are offered deeper liquidity around the mid-price, and LPs earn more trading fees with their capital. We call liquidity concentrated to a finite interval a position. LPs may have many different positions per pool, creating individualized price curves that reflect the preferences of each LP.

### Active Liquidity

As the price of an asset rises or falls, it may exit the price bounds that LPs have set in a position. When the price exits a position's interval, the position's liquidity is no longer active and no longer earns fees.

As price moves in one direction, LPs gain more of the one asset as swappers demand the other, until their entire liquidity consists of only one asset. If the price ever reenters the interval, the liquidity becomes active again, and in-range LPs begin earning fees once more.

Importantly, LPs are free to create as many positions as they see fit, each with its own price interval. Concentrated liquidity serves as a mechanism to let the market decide what a sensible distribution of liquidity is, as rational LPs are incentivized to concentrate their liquidity while ensuring that their liquidity remains active.

### Ticks

To achieve concentrated liquidity, the once continuous spectrum of price space has been partitioned with ticks.

Ticks are the boundaries between discrete areas in price space. Ticks are spaced such that an increase or decrease of 1 tick represents a $0.1\%$ increase or decrease in price at any point in price space.

Ticks function as boundaries for liquidity positions. When a position is created, the provider must choose the lower and upper tick that will represent their position's borders.

As the spot price changes during swapping, the pool contract will continuously exchange the outbound asset for the inbound, progressively using all the liquidity available within the current tick interval until the next tick is reached. At this point, the contract switches to a new tick and activates any dormant liquidity within a position that has a boundary at the newly active tick.

While each pool has the same number of underlying ticks, in practice only a portion of them are able to serve as active ticks. Due to the nature of the v3 smart contracts, tick spacing is directly correlated to the swap fee. Lower fee tiers allow closer potentially active ticks, and higher fees allow a relatively wider spacing of potential active ticks.

While inactive ticks have no impact on transaction cost during swaps, crossing an active tick does increase the cost of the transaction in which it is crossed, as the tick crossing will activate the liquidity within any new positions using the given tick as a border.

In areas where capital efficiency is paramount, such as stable coin pairs, narrower tick spacing increases the granularity of liquidity provisioning and will likely lower price impact when swapping - the result being significantly improved prices for stable coin swaps.

For more information on fee levels and their correlation to tick spacing, see the [whitepaper](https://t.co/Ms1dYZPrZx).
