---
title: Glossary

slug: /what_is/glossary
---

### Automated Market Maker

An automated market maker is a smart contract that holds liquidity reserves. Users can trade against these reserves at prices determined by a fixed formula. Anyone may contribute liquidity to these smart contracts, earning pro-rata trading fees in return.

### Concentrated Liquidity

Liquidity that is allocated within a determined price range.

### Constant Product Formula#

The automated market making algorithm given by product formula ${x\cdot y=k}$.

### Flash Swap

A trade that uses the tokens purchased before paying for them.

### Liquidity Provider / "LP"

A liquidity provider is someone who deposits tokens into a given liquidity pool. Liquidity providers take on price risk and are compensated with trading fees.

### Liquidity

Digital assets that are stored in a Uniswap pool contract, and are able to be traded against by traders.

### Mid Price

The price between the available buy and sell prices. In Uniswap V1 and V2, this is the ratio of the two ERC20 token reserves. In V3, this is the ratio of the two ERC20 token reserves available within the current active tick.

### Observation

An instance of historical price and liquidity data of a given pair.

### Pair

A smart contract deployed from a Uniswap V1 or V2 factory contract that enables trading between two ERC20 tokens. Pair contracts are now called Pools in V3.

### Periphery

External smart contracts that are useful, but not required for Uniswap to exist. New periphery contracts can always be deployed without migrating liquidity.

### Pool

A contract deployed by the V3 factory that pairs two ERC-20 assets. Different pools may have different fees despite containing the same token pair. Pools were previously called Pairs before the introduction of multiple fee options.

### Position

An instance of liquidity defined by upper and lower tick. And the amount of liquidity contained therein.

### Price Impact

The difference between the mid-price and the execution price of a trade.

### Protocol Fees

Fees that are rewarded to the protocol itself, rather than to liquidity providers.

### Range

Any interval between two ticks of any distance.

### Range Order

An approximation of a limit order, in which a single asset is provided as liquidity across a specified range, and is continuously swapped to the destination address as the spot price crosses the range.

### Reserves

The liquidity available within a pair. This was more commonly referenced before concentrated liquidity was introduced.

### Slippage

The amount the price moves in a trading pair between when a transaction is submitted and when it is executed.

### Spot Price

The current price of a token relative to another within a given pair.

### Swap Fees

The fees collected upon swapping which are rewarded to liquidity providers.

### Tick Interval

The price space between two nearest ticks.

### Tick

The boundaries between discrete areas in price space.
