---
title: SDK

slug: /alephium/sdk
---

SDK can be used to interact with our DEX programmatically. It provides an easy way to integrate your app with Invariant.

## Installation

### Download

Published package can be found [here](https://www.npmjs.com/package/@invariant-labs/alph-sdk).

### Build

You can find build steps [here](installation.md).

## Overview

The Invariant SDK mainly builds upon two distinct contracts:

1. DEX Contract (Invariant): This is the contract handling DEX functionality within the Invariant ecosystem.

2. Token Contract (TokenFaucet): This contract is responsible for managing tokens within the Invariant protocol. Allows to deploy or load existing tokens.

### Transactions and Queries

When working with contracts, developers can initiate interactions by calling methods from the corresponding contract class.

1. **Transactions**: These involve invoking methods that result in changes to the blockchain state. Transactions typically alter the data stored on the blockchain and may include operations like transferring assets or updating records. Once a transaction will be executed it returns a result object containing information about its details. The first parameter designates the account, and subsequent parameters act as entrypoint parameters.

2. **Queries**: Queries are read-only interactions with the contract. They allow developers to retrieve information from the blockchain without modifying its state. Queries are useful for obtaining current contract state, or verifying certain conditions. Importantly, queries do not return details of the on-chain execution; instead, they provide results in the form of structs from [storage](storage.md) or estimated results of transaction.

### Constants and Helper functions

The SDK includes fundamental constants and utility functions for application development. These encompass protocol parameters such as maximum tick, maximum price, and calculations required to know the price impact.

### Contract Metadata

Within the Artifacts folder, developers can find deploy-ready contracts, structures and constants in a form mirroring their deployed state and metadata necessary to interact with them.

### Source

The Source directory consolidates all pieces into an easy-to-use interface. This organized structure simplifies the development process and provides developers with a centralized location for accessing essential resources.

### Tests

End-to-end (E2E) tests are an essential component of our testing strategy. We have adopted the jest framework for our end-to-end testing needs. It also helps us with assertions. Our end-to-end tests encompass a comprehensive examination of the entire protocol. This includes testing all entrypoints of every contract within our protocol, ensuring that each contract behaves as expected under various conditions. Additionally, we thoroughly test our SDK math utilities to guarantee their accuracy and reliability.

## Types

### Decimal

These types are utilized to represent decimal values. Each type in this collection comes with associated decimal scales and utilities, allowing for precise and reliable handling of decimal calculations. Read more about [decimals](types.md).

```typescript
export type TokenAmount = bigint

export type Liquidity = bigint

export type FeeGrowth = bigint

export type SqrtPrice = bigint

export type FixedPoint = bigint

export type Percentage = bigint
```

### Network

Network serves as a convenient way to select the network on which various actions are performed. The enumeration includes options for 'local', 'mainnet', and 'testnet'. Users can switch between networks without the need of any code adjustments.

```typescript
enum Network {
  Local = 'Local',
  Testnet = 'Testnet',
  Mainnet = 'Mainnet'
}
```

### Storage

These interfaces are essential for managing various aspects of the Invariant's storage. It is important to note that these interfaces are exported from Ralph to TypeScript and stripped of unnecessary details, providing integration between the two languages. Read more about storage [here](storage.md).

```typescript
interface InvariantConfig {
  admin: string
  protocolFee: Percentage
}

interface FeeTier {
  fee: Percentage
  tickSpacing: bigint
}

interface PoolKey {
  tokenX: string
  tokenY: string
  feeTier: FeeTier
}

interface Pool {
  poolKey: PoolKey
  liquidity: Liquidity
  sqrtPrice: SqrtPrice
  currentTickIndex: bigint
  feeGrowthGlobalX: FeeGrowth
  feeGrowthGlobalY: FeeGrowth
  feeProtocolTokenX: TokenAmount
  feeProtocolTokenY: TokenAmount
  startTimestamp: bigint
  lastTimestamp: bigint
  feeReceiver: string
  reserveX: string
  reserveY: string
}

interface Position {
  poolKey: PoolKey
  liquidity: Liquidity
  lowerTickIndex: bigint
  upperTickIndex: bigint
  feeGrowthInsideX: FeeGrowth
  feeGrowthInsideY: FeeGrowth
  lastBlockNumber: bigint
  tokensOwedX: TokenAmount
  tokensOwedY: TokenAmount
}

interface Tick {
  index: bigint
  sign: boolean
  liquidityChange: Liquidity
  liquidityGross: Liquidity
  sqrtPrice: SqrtPrice
  feeGrowthOutsideX: FeeGrowth
  feeGrowthOutsideY: FeeGrowth
  secondsOutside: bigint
}
```

## Usage Guide

Follow a step-by-step example demonstrating how to use the Invariant SDK, with each step accompanied by code snippets. The complete up-to-date code for these examples is available [here](https://github.com/invariant-labs/protocol-alephium/blob/master/test/sdk/e2e/example.test.ts).

### Select Network

Begin by specifying the network you intend to connect to using the Network enum. Identify your target network, whether it's the local development environment, the mainnet, or a testnet. The code is designed to work uniformly across all networks. Changing the network designation does not require any modifications to the code.

```typescript
enum Network {
  Local,
  Testnet,
  Mainnet
}
```

### Transaction Signer

Utilize the versatile `PrivateKeyWallet` class to easily create and manage accounts. Initialize an account using your preferred method, more information can be found in the [Official Documentation for Alephium](https://docs.alephium.org/sdk/signer-provider).

```typescript
// initialize account, you can use your own wallet by following Alephium's documentation
const account = await getSigner(1000n * ONE_ALPH)
```

### FungibleToken

In the following TypeScript code, we demonstrate approach deploying and initializing token contracts using the `FungibleToken.deploy` method. Apart from the deployment and initialization, the code also demonstrates how to fetch token metadata. This can include details such as the token name, symbol, token decimal. Notably, a single instance of the FungibleToken class proves sufficient for handling interactions with multiple tokens.

```typescript
// deploy token, it will return token ids
const TOKEN0_ID = await FungibleToken.deploy(account, 500n, 'CoinA', 'ACOIN', 12n)
const TOKEN1_ID = await FungibleToken.deploy(account, 500n, 'CoinB', 'BCOIN', 12n)

// load token by passing its address (you can use existing one), it allows you to interact with it
const token = await FungibleToken.load(Network.Local)

// interact with token 0
const account0Balance = await token.getBalanceOf(account.address, TOKEN0_ID)
console.log(account0Balance)

// if you want to interact with different token,
// simply pass different contract address as an argument
const account1Balance = await token.getBalanceOf(account.address, TOKEN1_ID)
console.log(account1Balance)

// fetch token metadata for previously deployed token0
const token0Name = await token.getTokenName(TOKEN0_ID)
const token0Symbol = await token.getTokenSymbol(TOKEN0_ID)
const token0Decimals = await token.getTokenDecimals(TOKEN0_ID)
console.log(token0Name, token0Symbol, token0Decimals)

// load different token
// you can load all metadata at once
const token1Meta = await token.getTokenMetadata(TOKEN1_ID)
console.log(token1Meta.name, token1Meta.symbol, token1Meta.decimals)

// you can also load metadata for multiple tokens at once
const tokensMeta = await token.getTokenMetaDataMulti([TOKEN0_ID, TOKEN1_ID])
console.log(tokensMeta.get(TOKEN0_ID)?.name, tokensMeta.get(TOKEN1_ID)?.name)
```

:::tip Output

500n<br/>
500n<br/>
CoinA ACOIN 12n<br/>
CoinB BCOIN 12n<br/>
CoinA CoinB<br/>
:::

### Load DEX

Load the Invariant contract by specifying the network (e.g., `Network.Local` for local development), and indicating the Invariant contract address (`INVARIANT_ADDRESS`).

```typescript
// load invariant contract
const invariant = await Invariant.load(INVARIANT_ADDRESS, Network.Local)
```

### Create pool

:::info Big numbers
You can create custom decimals using the `toDecimal` syntax, where the first argument represents the numerical value (A), and the second argument indicates the power of 10 (B) in the formula `A * 10^(-B)`. For example, `toDecimal(3n, 2n)` will result in a decimal equal to 0.03. For further details on supported types, please check the documentation [here](types.md). An exception is the `toTokenAmount` function which explicitly asks about the decimal places the token uses.
:::

:::note Why "n" is at the end of every number
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision.
:::

:::warning Token sorting
Tokens are sorted alphabetically by their ids when pool key is created, so make sure that you swap tokens in correct direction. Read more about pool keys [here](storage#poolkey).
:::

To create a new pool, a fee tier and pool key need to be prepared. The fee tier represents the desired fee for the pool, and the price needs to be converted to sqrt price because the entry points of the protocol accept it in this format. The pool key is constructed using the addresses of two tokens and the specified fee tier. Finally, the `createPool` function is called with the user's account, the pool key, and the initial square root price, resulting in the creation of a new pool. The transaction id of the pool creation is then logged to the console.

```typescript
// set fee tier, make sure that fee tier with specified parameters exists
const feeTier = await newFeeTier(toPercentage(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

// if the fee tier does not exists, you have to add it
const isAdded = await invariant.feeTierExist(feeTier)
if (!isAdded) {
  // ATTENTION: this command is only available to the administrator of the invariant contract!
  await invariant.addFeeTier(account, feeTier)
}

// set initial price of the pool, we set it to 1.00
const price = toPrice(1n, 0n)
const initSqrtPrice = priceToSqrtPrice(price)

// set pool key, make sure that pool for these tokens does not exist already
const poolKey = await newPoolKey(TOKEN0_ID, TOKEN1_ID, feeTier)

const createPoolTransactionId = await invariant.createPool(
  account,
  poolKey.tokenX,
  poolKey.tokenY,
  feeTier,
  initSqrtPrice
)

// print transaction id
console.log(createPoolTransactionId)
```

:::tip Output
1a2aaee3fb9e839d63ef4dbf213745743b0e197d8016b4b27aca762d1c880f81
:::

### Create position

:::info How to calculate input amount
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000. The `toTokenAmount` takes care of the calculation for us.
:::

Creating position involves preparing parameters such as the amount of tokens, tick indexes for the desired price range, liquidity, slippage and approving token transfers. There is need to calculate desired liquidity based on specified token amounts. For this case there are provided functions `getLiquidityByX` or `getLiquidityByY`. The slippage parameter represents the acceptable price difference that can occur on the pool during the execution of the transaction.

```typescript
// token y has 12 decimals and we want to add 8 actual tokens to our position
const tokenYAmount = toTokenAmount(8n, 12n)

// set lower and upper tick indexes, we want to open a position in range [-10, 10]
const [lowerTickIndex, upperTickIndex] = [-10n, 10n]

// calculate the amount of token x we need to open position
const { amount: tokenXAmount, l: positionLiquidity } = await getLiquidityByY(
  tokenYAmount,
  lowerTickIndex,
  upperTickIndex,
  initSqrtPrice,
  true
)

// print amount of token x and y we need to open our position
console.log('Token X amount: ', tokenXAmount, ' Token Y amount: ', tokenYAmount)

// token approval is part of position creation
const createPositionTransactionId = await invariant.createPosition(
  account,
  poolKey,
  lowerTickIndex,
  upperTickIndex,
  positionLiquidity,
  tokenXAmount,
  tokenYAmount,
  initSqrtPrice,
  initSqrtPrice
)

// print transaction id
console.log(createPositionTransactionId)

// check the newly opened position
console.log(await invariant.getPosition(account.address, 0n))
```

:::tip Output
Token X amount: 7999999999880n Token Y amount: 8000000000000n <br/>
69226b27395a6820e99c761566439106d04f02dec3833301b25c5531262368d7<br/>
{<br/>
&emsp; poolKey: {<br/>
&emsp; &emsp; tokenX: 'a9ec8420ab99aa433645da0a0462ebe07351f0e6cdd56e1f3149d68dc6783300',<br/>
&emsp; &emsp; tokenY: 'e697a8bc5ea2433eaa8c0ce05f2730f5a17d654e93dbb459f114c88359d3d800',<br/>
&emsp; &emsp; feeTier: { fee: [Object], tickSpacing: 1n }<br/>
&emsp; },<br/>
&emsp; liquidity: 1600480031975990558848n,<br/>
&emsp; lowerTickIndex: -10n,<br/>
&emsp; upperTickIndex: 10n,<br/>
&emsp; feeGrowthInsideX: 0n,<br/>
&emsp; feeGrowthInsideY: 0n,<br/>
&emsp; lastBlockNumber: 1723210526545n,<br/>
&emsp; tokensOwedX: 0n,<br/>
&emsp; tokensOwedY: 0n,<br/>
&emsp; owner: '13FgGApAthBNZGwrUiPApixwxaNdfSxvidNfbPPLdAbRm',<br/>
&emsp; exists: true<br/>
}<br/>
:::

### Swap tokens

Performing a swap requires: specifying the amount of tokens to be swapped or desired amount to receive from the swap (input token amount will be calculated durning the swap), approving the transfer of the token, estimating the result of the swap, direction, determining the allowed slippage, calculating the square root price limit based on slippage, and finally, executing the swap. It's essential to note that the swap tolerance is expressed in square root price (sqrtPrice) after the swap, rather than the amount of tokens.

:::note Price impact and slippage
Price impact represents the change in price observed after the completion of a swap. It provides insight into how the executed swap influences the token price within the liquidity pool. A higher price impact indicates a more significant alteration in the token price post-swap.

Slippage refers to the difference between the estimated square root of price after a swap is initiated and the actual square root of price observed after the swap is executed. It quantifies the deviation between the expected and realized square roots of prices. Slippage does not imply an acceptable threshold solely in terms of token amounts.

While price impact focuses on the post-swap change in token price within the liquidity pool, slippage highlights the variance between the anticipated and actual prices during and after the swap process.
:::

```typescript
// we want to swap 6 token0
// token0 has 12 decimal places
const amount = toTokenAmount(6n, 12n)

// get estimated result of swap - there are 2 ways to do it
// 1. use the quote method
// due to it being computed using blockchain, thus having a latency and being subjected to gas limit, we recommend the second method
const quoteResult = await invariant.quote(
  poolKey,
  true,
  amount,
  true,
  await getMinSqrtPrice(feeTier.tickSpacing)
)

// 2. use local simulation of a swap [PREFERRED]
// get the pool to have the current information about its state
const pool = await invariant.getPool(poolKey)

// filtering only serves to reduce the amount of ticks we have to simulate, it is not necessary
// filter tickmap to only have ticks of interest for our swap
const tickmap = await filterTickmap(
  await invariant.getFullTickmap(poolKey),
  poolKey.feeTier.tickSpacing,
  pool.currentTickIndex,
  true
)

// filter ticks
const ticks = filterTicks(
  await invariant.getAllLiquidityTicks(poolKey, tickmap),
  pool.currentTickIndex,
  true
)

// simulate the swap locally
const simulateResult = simulateInvariantSwap(
  tickmap,
  pool,
  ticks,
  true,
  amount,
  true,
  await getMinSqrtPrice(feeTier.tickSpacing)
)

// you can now use the result of the simulation to make a decision whether to swap or not
// let's print it
console.log('Simulated swap result: ', simulateResult)

// make sure `stateOutdated` is false, otherwise you should repeat the whole procedure and try again
// amountOut is the amount of token1 you will get
// if you decide to swap, you can do it like this:

// the price might change in the meantime, so we should apply slippage
// slippage is a price change you are willing to accept
// for example, if current price is 1 and your slippage is 1%, the price limit should be set to 1.01
const allowedSlippage = toPercentage(1n, 3n) // 0.001 = 0.1%

const sqrtPriceLimit = calculateSqrtPriceAfterSlippage(
  simulateResult.targetSqrtPrice,
  allowedSlippage,
  false
)

const swapTransactionId = await invariant.swap(account, poolKey, true, amount, true, sqrtPriceLimit)
// print swap transaction id
console.log(swapTransactionId)
```

:::tip Output
Simulated swap result: {<br/>
&emsp; amountIn: 6000000000000n,<br/>
&emsp; amountOut: 5937796254308n,<br/>
&emsp; startSqrtPrice: 1000000000000000000000000n,<br/>
&emsp; targetSqrtPrice: 999628999041807638582903n,<br/>
&emsp; fee: 60000000000n,<br/>
&emsp; crossedTicks: [],<br/>
&emsp; insufficientLiquidity: false,<br/>
&emsp; stateOutdated: false,<br/>
&emsp; swapStepLimitReached: false<br/>
}<br/>
6ff454e5c6c23e2ed06cf2554b32a9c6ab2e6d196da347ffbf1ad93fa659d8dd<br/>
:::

### List of Queries and Interfaces

Here are some possible queries and their corresponding TypeScript interfaces:

- Get Tick

```typescript
interface Tick {
  index: bigint
  sign: boolean
  liquidityChange: Liquidity
  liquidityGross: Liquidity
  sqrtPrice: SqrtPrice
  feeGrowthOutsideX: FeeGrowth
  feeGrowthOutsideY: FeeGrowth
  secondsOutside: bigint
}

const tickState: Tick = await invariant.getTick(poolKey, tickIndex)
```

- Get Pool

```typescript
interface Pool {
  poolKey: PoolKey
  liquidity: Liquidity
  sqrtPrice: SqrtPrice
  currentTickIndex: bigint
  feeGrowthGlobalX: FeeGrowth
  feeGrowthGlobalY: FeeGrowth
  feeProtocolTokenX: TokenAmount
  feeProtocolTokenY: TokenAmount
  startTimestamp: bigint
  lastTimestamp: bigint
  feeReceiver: string
  reserveX: string
  reserveY: string
}

const poolState: Pool = await invariant.getPool(poolKey)
```

- Get All Pools for a pair of tokens

```typescript
const pools: [FeeTier, Pool][] = await invariant.getPools(token0, token1)
```

:::note Position indexing
Remember that positions are indexed from 0. So if you create a position, its index will be 0 and your next position's index will be 1.
:::

- Get Position

```typescript
interface Position {
  poolKey: PoolKey
  liquidity: Liquidity
  lowerTickIndex: bigint
  upperTickIndex: bigint
  feeGrowthInsideX: FeeGrowth
  feeGrowthInsideY: FeeGrowth
  lastBlockNumber: bigint
  tokensOwedX: TokenAmount
  tokensOwedY: TokenAmount
  owner: string
}

const positionState: Position = await invariant.getPosition(owner.address, positionIndex)
```

- Get Positions

```typescript
interface Page {
  index: number
  entries: [Position, Pool][]
}

const positions: Page[] = await invariant.getAllPositions(owner.address)
```

### Query states and Calculate Fee

To query the state and calculate **unclaimed** fees **belonging to the position**, several functions are utilized. Positions, ticks, and pools are accessed to gather information about the state, and the calculateFee function is used to determine the amount of unclaimed tokens.

```typescript
// query state
const pool: Pool = await invariant.getPool(poolKey)
const position: Position = await invariant.getPosition(account.address, 0n)
const lowerTick: Tick = await invariant.getTick(poolKey, position.lowerTickIndex)
const upperTick: Tick = await invariant.getTick(poolKey, position.upperTickIndex)

// check amount of tokens you are able to claim
const fees = await calculateFee(pool, position, lowerTick, upperTick)

// print amount of unclaimed x and y tokens
console.log(fees)
```

:::tip Output
[ 59999999999n, 0n ]
:::

### Claim fees

Fees from a specific position are claimed without closing the position. This process involves specifying the position ID (indexed from 0), calling the claimFee function, and then checking the balance of a specific token after claiming the fees.

```typescript
// get balance of a specific token before claiming position fees and print it
const accountBalanceBeforeClaim = await token.getBalanceOf(account.address, poolKey.tokenX)
console.log(accountBalanceBeforeClaim)

// specify position id
const positionId = 0n
// claim fee
const claimFeeTransactionId = await invariant.claimFee(account, positionId)
// print transaction hash
console.log(claimFeeTransactionId)

// get balance of a specific token before claiming position fees and print it
const accountBalanceAfterClaim = await token.getBalanceOf(account.address, poolKey.tokenX)
console.log(accountBalanceAfterClaim)
```

:::tip Output
999999999999999986000000000120n <br/>
7ffa881f4f2dc4b33a3084b2723b1074903a8b63819e7c2908cd02124b888443 <br/>
999999999999999986060000000119n
:::

### Transfer position

The entrypoint facilitates the seamless transfer of positions between users. This functionality streamlines the process of reassigning ownership of a specific position to another account. The entrypoint takes two parameters: index of position to transfer, address of account to receive the position.

```typescript
// remove the owner field, for comparison because it is going to change
const { owner, ...positionToTransfer } = await invariant.getPosition(account.address, 0n)

// transfer position from account (signer) to receiver
await invariant.transferPosition(account, 0n, receiver.address)
const receiverPosition = await invariant.getPosition(receiver.address, 0n)
// the position will be the same, except for the owner field
expect(receiverPosition).toMatchObject(positionToTransfer)
console.log(receiverPosition)
```

:::tip Output
{<br/>
&emsp; poolKey: {<br/>
&emsp; &emsp; tokenX: 'a9ec8420ab99aa433645da0a0462ebe07351f0e6cdd56e1f3149d68dc6783300',<br/>
&emsp; &emsp;tokenY: 'e697a8bc5ea2433eaa8c0ce05f2730f5a17d654e93dbb459f114c88359d3d800',<br/>
&emsp; &emsp;feeTier: { fee: {v: 10000000000n}, tickSpacing: 1n }<br/>
&emsp; },<br/>
&emsp; liquidity: 1600480031975990558848n,<br/>
&emsp; lowerTickIndex: -10n,<br/>
&emsp; upperTickIndex: 10n,<br/>
&emsp; feeGrowthInsideX: 37488752625000000000007n,<br/>
&emsp; feeGrowthInsideY: 0n,<br/>
&emsp; lastBlockNumber: 1723210526545n,<br/>
&emsp; tokensOwedX: 0n,<br/>
&emsp; tokensOwedY: 0n<br/>
&emsp; owner: '1CVVnQecqPwKQJSPMQ8KTeP9GPLwBZE9rD37Xa13tgd1v',<br/>
&emsp; exists: true<br/>
}
:::

### Remove position

If Position is removed from the protocol, fees associated with that position are automatically claimed in the background. Here's a detailed description of the process:

```typescript
// fetch user balances before removal
const accountTokenXBalanceBeforeRemove = await token.getBalanceOf(account.address, poolKey.tokenX)
const accountTokenYBalanceBeforeRemove = await token.getBalanceOf(account.address, poolKey.tokenY)
console.log(accountTokenXBalanceBeforeRemove, accountTokenYBalanceBeforeRemove)

// remove position
const removePositionTransactionId = await invariant.removePosition(account, positionId)
console.log(removePositionTransactionId)

// get balance of a specific token after removing position
const accountTokenXBalanceAfterRemove = await token.getBalanceOf(account.address, poolKey.tokenX)
const accountTokenYBalanceAfterRemove = await token.getBalanceOf(account.address, poolKey.tokenY)

// print balances
console.log(accountTokenXBalanceAfterRemove, accountTokenYBalanceAfterRemove)
```

:::tip Output
999999999999999986060000000119n 999999999999999986060000000119n <br/>
56b03ab9b744bf33e9c4b04c3b650833133812dbbf94eecfc47038dfe7d19809 <br/>
999999999999999999999999999998n 999999999999999999999999999998n <br/>
:::

### Using ALPH

```typescript
// ALPH just like any other token has a Contract Id (Token Id), so it can be used in the same way

// load token contract
const token = await FungibleToken.load(Network.Local)

// get balance of account
const accountBalance = await token.getBalanceOf(account.address, ALPH_TOKEN_ID)
console.log(accountBalance)
```

:::tip Output
999457661200000000000n<br/>
:::
