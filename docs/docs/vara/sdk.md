---
title: SDK

slug: /vara/sdk
---

SDK can be used to interact with our DEX programmatically. It provides an easy way to integrate your app with Invariant and GRC-20 tokens.

## Installation

### Download

Published package can be found [here](https://www.npmjs.com/package/@invariant-labs/vara-sdk).

### Build

You can find build steps [here](installation.md).

## Overview

The Invariant SDK comprises two distinct contracts:

1. DEX Contract (Invariant): This is the contract handling DEX functionality within the Invariant ecosystem.

2. Token Contract (GRC-20): This contract is responsible for managing and implementing the GRC-20 token standard within the Invariant protocol. Allows to deploy or load existing contracts.

### Transactions and Queries

When working with contracts, developers can initiate interactions by calling methods from the corresponding contract class. The first parameter designates the account, and subsequent parameters act as entrypoint parameters.

1. **Transactions**: These involve invoking methods that result in changes to the blockchain state. Transactions typically alter the data stored on the blockchain and may include operations like transferring assets, updating records, or executing specific actions. Once the transaction will be confirmed it returns a message. If the entrypoint has emitted any events, they can be caught with appropriate event listener using `Invariant.on` function. Additionally some entrypoints return results of their computations. 

2. **Queries**: Queries are read-only interactions with the contract. They allow developers to retrieve information from the blockchain without modifying its state. Queries are useful for obtaining current contract state, or verifying certain conditions. They provide results in the form of structs from [storage](storage.md) or estimated results of transaction.

### Listening to Events

The Invariant class offers additional methods empowering developers to attach event listeners. This feature enables the execution of custom code based on contract activity, enhancing flexibility and customization in response to specific events.

### Values and Helper functions

The SDK includes fundamental values and utility functions for application development. These encompass parameters such as maximum tick, maximum price, and calculations for price impact.

### Contracts Metadata

Within the Contracts folder, developers can find deploy-ready wasm files and idl files essential for sails-js code generation.

### Wasm

The Wasm functionality is encapsulated within our custom npm package that is a part of the workspace, which includes Rust structs and data exported to WebAssembly using wasm_bindgen. This integration facilitates the utilization of identical functions and data within the main Invariant contract.

### Source

The Source directory consolidates all pieces into an easy-to-use interface. This organized structure simplifies the development process and provides developers with a centralized location for accessing essential resources.

### Tests

End-to-end (E2E) tests are an essential component of our testing strategy. We have adopted the ts-mocha framework for our end-to-end testing needs. For assertion and expectation handling, we rely on the Chai assertion library. Our end-to-end tests encompass a comprehensive examination of the entire protocol. This includes testing all entrypoints of every contract within our protocol, ensuring that each contract behaves as expected under various conditions. Additionally, we thoroughly test our SDK math utilities to guarantee their accuracy and reliability.

### Project Structure

```
📦sdk
 ┣ 📂contracts
 ┃ ┣ 📂invariant
 ┃ ┣ 📂gear_erc20
 ┣ 📂src
 ┗ 📂tests
```

## Types

### Decimal

These types are utilized to represent decimal values, and it is worth noting that these decimal types are already exported from Rust through WebAssembly (Wasm) using wasm-bindgen. Each type in this collection comes with associated decimal scales and functionalities, allowing for precise and reliable handling of decimal calculations. Read more about [decimals](types.md).

```typescript
export type TokenAmount = bigint

export type Liquidity = bigint

export type FeeGrowth = bigint

export type SqrtPrice = bigint

export type Price = bigint

export type FixedPoint = bigint

export type Percentage = bigint
```

### Network

Network serves as a convenient way to select the network on which various actions are performed. The enumeration includes options for 'local', 'mainnet', and 'testnet'. Users can switch between networks without the need of any code adjustments.

```typescript
enum Network {
  Local,
  Testnet,
  Mainnet
}
```

### Events

Code snippet introduces several event interfaces related to the Invariant, providing structured information about various actions. These events can be subscribed to using the Invariant, enabling users to receive updates when specific actions occur within the contract.

```typescript
interface PositionCreatedEvent {
  timestamp: bigint
  address: string
  poolKey: PoolKey
  liquidityDelta: Liquidity
  lowerTick: bigint
  upperTick: bigint
  sqrtPrice: SqrtPrice
}

interface CrossTickEvent {
  timestamp: bigint
  address: string
  poolKey: PoolKey
  indexes: bigint[]
}

interface PositionRemovedEvent {
  timestamp: bigint
  address: string
  poolKey: PoolKey
  liquidityDelta: Liquidity
  lowerTick: bigint
  upperTick: bigint
  sqrtPrice: SqrtPrice
}

interface SwapEvent {
  timestamp: bigint
  address: string
  poolKey: PoolKey
  amountIn: TokenAmount
  amountOut: TokenAmount
  fee: TokenAmount
  startSqrtPrice: SqrtPrice
  targetSqrtPrice: SqrtPrice
  xToY: boolean
}
```

### Storage

These interfaces are essential for managing various aspects of the Invariant's storage. It is important to note that these interfaces are exported from Rust to TypeScript using wasm-bindgen, providing integration between the two languages. Read more about storage [here](storage.md).

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
  tokenX: `0x${string}`
  tokenY: `0x${string}`
  feeTier: FeeTier
}

interface Pool {
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

Follow a step-by-step example demonstrating how to use the Invariant SDK, with each step accompanied by code snippets. The complete code for these examples is available [here](https://github.com/invariant-labs/protocol-vara/blob/master/sdk/tests/example.test.ts), ensuring a hands-on and comprehensive understanding of the SDK's functionality.

### Select Network

Begin by specifying the network you intend to connect to using the Network enum. Identify your target network, whether it's the local development environment, the mainnet, or a testnet. The code is designed to work uniformly across all networks. Changing the network designation does not require any modifications to the code.

```typescript
enum Network {
  Local,
  Testnet,
  Mainnet
}
```

### Initlialize API

:::note Running Web Assembly
SDK utilizes Web Assembly. In order to run WASM files in Node.js you have to add `--experimental-wasm-modules` flag.
:::

Initiate the Polkadot API effortlessly with the provided `initGearApi` function. Use the `Network` enum to specify your desired network.

```typescript
// initialize api, use enum to specify the network
const api = await initGearApi({ providerAddress: Network.Local })
```

### Transaction Signer

Utilize the versatile `GearKeyring` class to easily create and manage accounts. Initialize an account using your preferred method, whether it's using a provided mnemonic phrase or integrating your existing wallet.

```typescript
// initialize account, you can use your own wallet by pasting mnemonic phase
const admin = await GearKeyring.fromSuri('//Bob')
```

### GRC-20 token

In the following TypeScript code, we demonstrate approach deploying and initializing a GRC-20 token contracts using the `FungibleToken.deploy` method. Apart from the deployment and initialization, the code also demonstrates how to fetch token metadata. This can include details such as the token name, symbol, token decimal.

```typescript
// deploy token, it will return token address
const token0Address = await FungibleToken.deploy(api, admin, 'CoinA', 'ACOIN', 12n)
const token1Address = await FungibleToken.deploy(api, admin, 'CoinB', 'BCOIN', 12n)

// loading token class, allows you to interact with token contracts
const GRC20 = await FungibleToken.load(api)
// set admin account if you want to mint or burn tokens
// by default admin is set to the deployer of the contract
GRC20.setAdmin(admin)

// interact with token 0
const admin0Balance = await GRC20.balanceOf(admin.addressRaw, token0Address)
console.log(admin0Balance)

// if you want to interact with different token,
// simply pass different contract address as an argument
const admin1Balance = await GRC20.balanceOf(admin.addressRaw, token1Address)
console.log(admin1Balance)

// fetch token metadata for previously deployed token0
const token0Name = await GRC20.name(token0Address)
const token0Symbol = await GRC20.symbol(token0Address)
const token0Decimals = await GRC20.decimals(token0Address)
console.log(token0Name, token0Symbol, token0Decimals)

// load diffrent token and load its metadata
const token1Name = await GRC20.name(token1Address)
const token1Symbol = await GRC20.symbol(token1Address)
const token1Decimals = await GRC20.decimals(token1Address)
console.log(token1Name, token1Symbol, token1Decimals)
```

:::tip Output
0n <br/>
0n<br/>
CoinA ACOIN 12n<br/>
CoinB BCOIN 12n<br/>
:::

### Load DEX and tokens

:::note Deploying and loading GRC-20 contracts
The deploy function serves as a one-stop solution for deploying GRC-20 contracts. When invoked, returns a unique contract address. This address serves as a reference for the deployed contract.
By providing the contract address returned during deployment, the load function dynamically adds all necessary methods to the specified contract. This dynamic loading capability ensures that the contract is equipped with the essential functionalities defined by the GRC-20 standard.
:::

Load the Invariant contract by providing the Polkadot API (`api`), and indicating the Invariant contract address (`INVARIANT_ADDRESS`). Similarly, initialize the GRC-20 token contract using the same approach.

```typescript
// load invariant contract
const invariant = await Invariant.load(api, INVARIANT_ADDRESS)

// load token contract
const GRC20 = await FungibleToken.load(api)
```

### Create pool

:::info Big numbers
You can create custom decimals using the `toDecimal` syntax, where the first argument represents the numerical value (A), and the second argument indicates the power of 10 (B) in the formula `A * 10^(-B)`. For example, `toDecimal(3n, 2n)` will result in a decimal equal to 0.03. For further details on supported types, please check the documentation [here](types.md).
:::

:::note Why "n" is at the end of every number
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision.
:::

:::warning Token sorting
Tokens are sorted alphabetically when pool key is created, so make sure that you swap tokens in correct direction. Read more about pool keys [here](storage#poolkey).
:::

To create a new pool, a fee tier and pool key need to be prepared. The fee tier represents the desired fee for the pool, and the price needs to be converted to sqrt price because the entry points of the protocol accept it in this format. The pool key is constructed using the addresses of two tokens and the specified fee tier. Finally, the `createPool` function is called with the user's account, the pool key, and the initial square root price, resulting in the creation of a new pool

```typescript
// set fee tier, make sure that fee tier with specified parameters exists
const feeTier = newFeeTier(toPercentage(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

// set initial price of the pool, we set it to 1.00
// all endpoints only accept sqrt price so we need to convert it before passing it
const price = toPrice(1n, 0n)
const initSqrtPrice = priceToSqrtPrice(price)

// set pool key, make sure that pool with specified parameters does not exists
const poolKey = newPoolKey(token0Address, token1Address, feeTier)

await invariant.createPool(account, poolKey, initSqrtPrice)
```

### Deposit

These entrypoints allow for depositing tokens that will be used for the future operations within the DEX, it's necessary for making the contract atomic. After the operation has been performed tokens may be withdrawn or used in future operations. Return value of these entrypoints contains the amount of tokens deposited in the same order that they were provided.
```typescript 
// deposit both tokens at once
const depositResult = await invariant.depositTokenPair(admin, [tokenXAddress, tokenXAmount], [tokenYAddress, tokenYAmount])
console.log(depositResult)
// deposit single token
const depositResult = await invariant.depositSingleToken(admin, tokenXAddress, tokenXAmount)
console.log(depositResult)
```

:::tip Output
<br/>
[100n, 100n]<br/>
100n<br/>
:::


### Withdraw
These entrypoints allow for funds withdrawal after performing desired operations. `null` may be passed instead of the amount to withdraw the current balance without having to query the state. Return value of these entrypoints contains the amount of tokens withdrawn in the same order that they were provided.
```typescript
// withdraw both tokens at once
const withdrawResult = await invariant.withdrawTokenPair(admin, [tokenXAddress, tokenXAmount], [tokenYAddress, tokenYAmount])
console.log(withdrawResult)
// withdraw single token
const withdrawResult = await invariant.withdrawSingleToken(admin, tokenXAddress, tokenXAmount)
console.log(withdrawResult)
// withdraw both tokens at once without knowing the amount of the tokens in the contract
const withdrawResult = await invariant.withdrawTokenPair(admin, [tokenXAddress, null], [tokenYAddress, null])
console.log(withdrawResult)
// withdraw single token without knowing the amount of the tokens in the contract
const withdrawResult = await invariant.withdrawSingleToken(admin, tokenXAddress, null)
console.log(withdrawResult)
```

:::tip Output
<br/>
[100n, 100n]<br/>
100n<br/>
[1000n, 0n]<br/>
[10n]<br/>
:::

### Create position

:::info How to calculate input amount
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000.
:::

Creating position involves preparing parameters such as the amount of tokens, tick indexes for the desired price range, liquidity, slippage and approving token transfers. There is need to calculate desired liquidity based on specified token amounts. For this case there are provided functions `getLiquidityByX` or `getLiquidityByY`. The slippage parameter represents the acceptable price difference that can occur on the pool during the execution of the transaction.

```typescript
// token y has 12 decimals and we want to add 8 integer tokens to our position
const tokenYAmount = 8n * 10n ** 12n

// set lower and upper tick indexes, we want to create position in range [-10, 10]
const lowerTickIndex = -10n
const upperTickIndex = 10n

// calculate amount of token x we need to give to create position
const { amount: tokenXAmount, l: positionLiquidity } = getLiquidityByY(
  tokenYAmount,
  lowerTickIndex,
  upperTickIndex,
  initSqrtPrice,
  true
)

// print amount of token x and y we need to give to create position based on parameteres we passed
console.log(tokenXAmount, tokenYAmount)
// approve transfers of both tokens
await GRC20.approve(admin, invariant.programId(), tokenXAmount, poolKey.tokenX)
await GRC20.approve(admin, invariant.programId(), tokenYAmount, poolKey.tokenY)

// deposit tokens in the contract
await invariant.depositTokenPair(
  admin,
  [poolKey.tokenX, tokenXAmount],
  [poolKey.tokenY, tokenYAmount]
)

// check user balances before creating position
const userBalances = await invariant.getUserBalances(admin.addressRaw)
console.log(userBalances)

// create position
const createPositionResult = await invariant.createPosition(
  admin,
  poolKey,
  lowerTickIndex,
  upperTickIndex,
  positionLiquidity,
  initSqrtPrice,
  0n
)

console.log(createPositionResult) // print transaction result

// withdraw tokens from the contract
// passing null will try to withdraw all tokens in case no tokens are deposited
const withdrawResult = await invariant.withdrawTokenPair(
  admin,
  [poolKey.tokenX, null],
  [poolKey.tokenY, null]
)
console.log(withdrawResult)

```

:::tip Output
7999999999880n 8000000000000n <br/>
Map(2) {<br/>
&emsp; '0x476f15fb07f2c1fa3d2a8212496db9535e9911929760651840c335a48791af5b' => 8000000000000n, <br/>
&emsp; '0x439d17e3bad34ca76cca21ec23c1e746673187a9d7da9d65988c55350c5292d1' => 7999999999880n <br/>
}<br/>
{<br/>
&emsp; poolKey: {<br/>
&emsp; &emsp; tokenX: '0x439d17e3bad34ca76cca21ec23c1e746673187a9d7da9d65988c55350c5292d1',<br/>
&emsp; &emsp; tokenY: '0x476f15fb07f2c1fa3d2a8212496db9535e9911929760651840c335a48791af5b',<br/>
&emsp; &emsp; feeTier: { fee: 6000000000n, tickSpacing: 10 }<br/>
&emsp; },<br/>
&emsp; liquidity: 1000000000000n,<br/>
&emsp; lowerTickIndex: -20n,<br/>
&emsp; upperTickIndex: 10n,<br/>
&emsp; feeGrowthInsideX: 0n,<br/>
&emsp; feeGrowthInsideY: 0n,<br/>
&emsp; lastBlockNumber: 352n,<br/>
&emsp; tokensOwedX: 0n,<br/>
&emsp; tokensOwedY: 0n<br/>
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
// token0 has 12 decimals so we need to multiply it by 10^12
const amount = 6n * 10n ** 12n

// approve token x transfer
await GRC20.approve(admin, invariant.programId(), amount, poolKey.tokenX)
// deposit tokenX
await invariant.depositSingleToken(admin, poolKey.tokenX, amount)

// get estimated result of swap
const quoteResult = await invariant.quote(poolKey, true, amount, true)

// slippage is a price change you are willing to accept,
// for examples if current price is 1 and your slippage is 1%, then price limit will be 1.01
const allowedSlippage = toPercentage(1n, 3n) // 0.001 = 0.1%

// calculate sqrt price limit based on slippage
const sqrtPriceLimit = calculateSqrtPriceAfterSlippage(
  quoteResult.targetSqrtPrice,
  allowedSlippage,
  false
)

const swapResult = await invariant.swap(admin, poolKey, true, amount, true, sqrtPriceLimit)
console.log(swapResult)

await invariant.withdrawSingleToken(admin, poolKey.tokenY, null)
```
:::tip Output
{<br/>
&emsp;  amountIn: 6000000000000n, <br/>
&emsp;  amountOut: 5937796254308n, <br/>
&emsp;  startSqrtPrice: 1000000000000000000000000n, <br/>
&emsp;  targetSqrtPrice: 999628999041807638582903n, <br/>
&emsp;  fee: 60000000000n, <br/>
&emsp;  pool: { <br/>
&emsp;  &emsp;  liquidity: 16004800319759905588483n, <br/>
&emsp;  &emsp;  sqrtPrice: 999628999041807638582903n, <br/>
&emsp;  &emsp;  currentTickIndex: -8n, <br/>
&emsp;  &emsp;  feeGrowthGlobalX: 37488752625000000000000n, <br/>
&emsp;  &emsp;  feeGrowthGlobalY: 0n, <br/>
&emsp;  &emsp;  feeProtocolTokenX: 0n, <br/>
&emsp;  &emsp;  feeProtocolTokenY: 0n, <br/>
&emsp;  &emsp;  startTimestamp: 1719399192000n, <br/>
&emsp;  &emsp;  lastTimestamp: 1719399204000n, <br/>
&emsp;  &emsp;  feeReceiver: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
&emsp;  } <br/>,
&emsp;  ticks: []<br/>
}<br/>
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
}

const poolState: Pool = await invariant.getPool(TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)
```

- Get All PoolKeys

```typescript
const poolKeys: PoolKey[] = await invariant.getAllPoolKeys()
```

:::note Position indexing
Remember that positions are indexed from 0. So if you create position, its index will be 0 and your next positions index will be 1.
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
}

const positionState: Position = await invariant.getPosition(owner.addressRaw, positionIndex)
```

### Query states and Calculate Fee

To query the state and calculate **unclaimed** fees **belonging to the position**, several functions are utilized. Positions, ticks, and pools are accessed to gather information about the state, and the calculateFee function is used to determine the amount of unclaimed tokens.

```typescript
// query states
const pool: Pool = await invariant.getPool(TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)
const position: Position = await invariant.getPosition(account.addressRaw, 0n)
const lowerTick: Tick = await invariant.getTick(poolKey, position.lowerTickIndex)
const upperTick: Tick = await invariant.getTick(poolKey, position.upperTickIndex)

// check amount of tokens is able to claim
const fees = calculateFee(pool, position, lowerTick, upperTick)

// print amount of unclaimed x and y token
console.log(fees)
```

:::tip Output
{x: 59999999999n, y: 0n }
:::

### Claim fees

Fees from a specific position are claimed without closing the position. This process involves specifying the position ID (indexed from 0), calling the claimFee function, and then checking the balance of a specific token after claiming the fees.

```typescript
// get balance of a specific token before claiming position fees and print it
const adminBalanceBeforeClaim = await GRC20.balanceOf(admin.addressRaw, token0Address)
console.log(adminBalanceBeforeClaim)

// specify position id
const positionId = 0n
// claim fee
const claimFeeResult = await invariant.claimFee(admin, positionId)
console.log(claimFeeResult)
const withdrawResult = await invariant.withdrawSingleToken(admin, poolKey.tokenX, null)
console.log(withdrawResult)

// get balance of a specific token after claiming position fees and print it
const adminBalanceAfterClaim = await GRC20.balanceOf(admin.addressRaw, token0Address)
console.log(adminBalanceAfterClaim)
```

:::tip Output
[ 59999999999n, 0n ] <br/>
999999999999999986000000000120n <br/>
[ 59999999999n, 0n ] <br/>
59999999999n <br/>
999999999999999986060000000119n <br/>
:::

### Transfer position

The entrypoint facilitates the seamless transfer of positions between users. This functionality streamlines the process of reassigning ownership of a specific position to another account. The entrypoint takes two parameters: index of position to transfer, address of account to receive the position.

```typescript
const positionToTransfer = await invariant.getPosition(admin.addressRaw, 0n)
// Transfer position from admin (signer) to receiver
await invariant.transferPosition(admin, 0n, receiver.addressRaw)
// load received position
const receiverPosition = await invariant.getPosition(receiver.addressRaw, 0n)

// ensure that the position are equal
assert.deepEqual(positionToTransfer, receiverPosition)
console.log(receiverPosition)
```

:::tip Output
{<br/>
&emsp;  poolKey: {<br/>
&emsp;  &emsp;  tokenX: '0xb26c4ab30334ccb23a3023465cb615bb5d0fa4635e9cac7c9428a7f1add9844a',<br/>
&emsp;  &emsp;  tokenY: '0xb519977de99135feacb3b8c813a62faecfcc263a238a16f58041adcd65fa61f9',<br/>
&emsp;  &emsp;  feeTier: { fee: 10000000000n, tickSpacing: 1 }<br/>
&emsp;  },<br/>
&emsp;  liquidity: 16004800319759905588483n,<br/>
&emsp;  lowerTickIndex: -10n,<br/>
&emsp;  upperTickIndex: 10n,<br/>
&emsp;  feeGrowthInsideX: 37488752625000000000000n,<br/>
&emsp;  feeGrowthInsideY: 0n,<br/>
&emsp;  lastBlockNumber: 1665n,<br/>
&emsp;  tokensOwedX: 0n,<br/>
&emsp;  tokensOwedY: 0n<br/>
}<br/>
:::

### Remove position

Position is removed from the protocol, and fees associated with that position are automatically claimed in the background. Here's a detailed description of the process:

```typescript
// fetch user balances before removal
const adminToken0BalanceBeforeRemove = await GRC20.balanceOf(admin.addressRaw, token0Address)
const adminToken1BalanceBeforeRemove = await GRC20.balanceOf(admin.addressRaw, token1Address)
console.log(adminToken0BalanceBeforeRemove, adminToken1BalanceBeforeRemove)
// remove position

const removePositionResult = await invariant.removePosition(admin, positionId)
console.log(removePositionResult)

await invariant.withdrawTokenPair(admin, [poolKey.tokenX, null], [poolKey.tokenY, null])

// get balance of a specific token after removing position
const adminToken0BalanceAfterRemove = await GRC20.balanceOf(admin.addressRaw, token0Address)
const adminToken1BalanceAfterRemove = await GRC20.balanceOf(admin.addressRaw, token1Address)

// print balances
console.log(adminToken0BalanceAfterRemove, adminToken1BalanceAfterRemove)
```
:::tip Output
999999999999999986060000000119n 999999999999999997937796254308n <br/>
[ 13939999999879n, 2062203745691n ] <br/>
999999999999999999999999999998n 999999999999999999999999999999n <br/>
:::

### Listen to Event

Invariant provides the capability to set up event listeners, allowing developers to respond to specific events within the contract. The event listener structs are detailed below, accompanied by a code snippet demonstrating how to set up listeners for each specific event type.

```typescript
interface PositionCreatedEvent {
    timestamp: bigint
    address: string
    poolKey: PoolKey
    liquidityDelta: Liquidity
    lowerTick: bigint
    upperTick: bigint
    sqrtPrice: SqrtPrice
}

interface CrossTickEvent {
    timestamp: bigint
    address: string
    poolKey: PoolKey
    indexes: bigint[]
}

interface PositionRemovedEvent {
    timestamp: bigint
    address: string
    poolKey: PoolKey
    liquidityDelta: Liquidity
    lowerTick: bigint
    upperTick: bigint
    sqrtPrice: SqrtPrice
}

interface SwapEvent {
    timestamp: bigint
    address: string
    poolKey: PoolKey
    amountIn: TokenAmount
    amountOut: TokenAmount
    fee: TokenAmount
    startSqrtPrice: SqrtPrice
    targetSqrtPrice: SqrtPrice
    xToY: boolean
}
```

Developers can define a handler function, such as the handler function in the code snippet, that takes an event parameter matching the structure of the respective event type (e.g., `SwapEvent`). This handler function enables developers to perform actions based on the event details.

```typescript
const handler = (event: SwapEvent) => {
  // checking if swap was made on a specific pool
  if (event.poolKey === poolKey) {
    // do action
  }
}
```

The `invariant.on` method allows developers to subscribe to specific events, such as `SwapEvent`, by specifying the event type and providing the corresponding handler function.

```typescript
// attach event listener to invariant contract and listen for swap events
invariant.on({ident: InvariantEvent.SwapEvent, callback: handler})
```

When event subscriptions are no longer needed, developers can use the `invariant.off` method to unsubscribe from specific events. This ensures efficient resource management and stops further notifications for the specified event type.

```typescript
// remove event listener when it is no longer needed
invariant.off({ident: InvariantEvent.SwapEvent, callback: handler})
```
