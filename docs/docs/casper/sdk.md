---
title: SDK

slug: /casper/sdk
---

SDK can be used to interact with our DEX programmatically. It provides an easy way to integrate your app with Invariant and ERC20 tokens.

## Installation

### Download

Published package can be found [here](https://www.npmjs.com/package/@invariant-labs/cspr-sdk).

### Build

You can find build steps [here](installation.md).

## Overview

The Invariant SDK comprises two distinct contracts:

1. DEX Contract (Invariant): This is the contract handling DEX functionality within the Invariant ecosystem.

2. Token Contract (ERC20): This contract is responsible for managing and implementing the ERC20 token standard within the Invariant protocol. Allows to deploy or load existing contracts.

### Transactions and Queries

When working with contracts, developers can initiate interactions by calling methods from the corresponding contract class. The first parameter usually designates the account, and subsequent parameters act as transaction/query parameters.

1. **Transactions**: These involve invoking methods that result in changes to the blockchain state. Transactions typically alter the data stored on the blockchain and may include operations like transferring assets, updating records, or executing specific actions. Once the transaction will be confirmed it returns the result.

2. **Queries**: Queries are read-only interactions with the contract. They allow developers to retrieve information from the blockchain without modifying its state. Queries are useful for obtaining current contract state, or verifying certain conditions. Importantly, queries do not return a result like transaction does; instead, they provide results in the form of structs from [storage](storage.md).

### Values and Helper functions

The SDK includes fundamental values and utility functions for application development. These encompass parameters such as maximum tick, maximum price, and calculations for price impact.

### Contracts Metadata

Within the Contracts folder, developers can find deploy-ready contracts essential for interactions.

### Wasm

The Wasm functionality is encapsulated in separate package, which includes Rust structs and data exported to WebAssembly using wasm_bindgen. This integration facilitates the utilization of identical functions and data within the main Invariant contract.

### Source

The Source directory consolidates all pieces into an easy-to-use interface. This organized structure simplifies the development process and provides developers with a centralized location for accessing essential resources.

### Tests

End-to-end (E2E) tests are an essential component of our testing strategy. We have adopted the ts-mocha framework for our end-to-end testing needs. For assertion and expectation handling, we rely on the Chai assertion library. Our end-to-end tests encompass a comprehensive examination of the entire protocol. This includes testing all entrypoints of every contract within our protocol, ensuring that each contract behaves as expected under various conditions. Additionally, we thoroughly test our SDK math utilities to guarantee their accuracy and reliability.

### Project Structure

```
📦sdk
 ┣ 📂contracts
 ┣ 📂src
 ┣ 📂tests
 ┗ 📂wasm
```

## Types

### Decimal

These types are utilized to represent decimal values, and it is worth noting that these decimal types are already exported from Rust through WebAssembly (Wasm) using wasm-bindgen. Each type in this collection comes with associated decimal scales and functionalities, allowing for precise and reliable handling of decimal calculations. Read more about [decimals](types.md).

```typescript
export type TokenAmount = { v: bigint }

export type Liquidity = { v: bigint }

export type FeeGrowth = { v: bigint }

export type SqrtPrice = { v: bigint }

export type Price = { v: bigint }

export type FixedPoint = { v: bigint }

export type Percentage = { v: bigint }
```

### Network

Network serves as a convenient way to select the network on which various actions are performed. The enumeration includes options for 'local', 'mainnet', and 'testnet'. Users can switch between networks without the need of any code adjustments.

```typescript
enum Network {
  Local = 'casper-net-1',
  Testnet = 'casper-test',
  Mainnet = 'casper'
}
```

### Key

The key serves as the determinant for the particular address in question. The enumeration encompasses choices such as 'account' and 'hash'. An 'account' refers to a standard user account capable of executing transactions, whereas a 'hash' signifies a deployed entity on the blockchain, be it a contract, contract package, or similar.

```typescript
enum Key {
  Account = 0,
  Hash = 1
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
  tokenX: string
  tokenY: string
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

Follow a step-by-step example demonstrating how to use the Invariant SDK, with each step accompanied by code snippets. The complete code for these examples is available [here](https://github.com/invariant-labs/protocol-cspr/blob/master/sdk/tests/example.test.ts), ensuring a hands-on and comprehensive understanding of the SDK's functionality.

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

Initiate the Casper Client effortlessly with the provided `initCasperClient` function. Use first parameter to specify your desired node.

```typescript
// initialize client, use first parameter to specify the node
const client = initCasperClient(NODE_URL)
```

### Transaction Signer

Utilize the `parseAccountKeys` function to easily load your account.

```typescript
// initialize account, use path to your own private key
const account = parseAccountKeys(KEYS_PATH, Algo.ed25519)
const accountAddress = getAccountHashFromKey(account)
```

### ERC20 token

In the following TypeScript code, we demonstrate approach deploying and initializing a ERC20 token contracts using the `Erc20.deploy` method. Apart from the deployment and initialization, the code also demonstrates how to fetch token metadata. This can include details such as the token name, symbol, token decimal.

```typescript
// deploy tokens
const [token0ContractPackage, token0ContractHash] = await Erc20.deploy(
  client,
  Network.Local,
  account,
  'erc20-1',
  1000000000000000n,
  'Coin',
  'COIN',
  12n,
  150000000000n
)
const [token1ContractPackage, token1ContractHash] = await Erc20.deploy(
  client,
  Network.Local,
  account,
  'erc20-2',
  1000000000000000n,
  'Coin',
  'COIN',
  12n,
  150000000000n
)

// load token by passing its address (you can use existing one), it allows you to interact with it
const erc20 = await Erc20.load(client, Network.Local, token0ContractHash)

// interact with token 0
const account0Balance = await erc20.getBalanceOf(Key.Account, accountAddress)
console.log(account0Balance)

// if you want to interact with different token,
// simply set different contract address
erc20.setContractHash(token1ContractHash)

// now we can interact with token y
const account1Balance = await erc20.getBalanceOf(Key.Account, accountAddress)
console.log(account1Balance)

// fetch token metadata for previously deployed token0
erc20.setContractHash(token0ContractHash)
const token0Name = await erc20.getName()
const token0Symbol = await erc20.getSymbol()
const token0Decimals = await erc20.getDecimals()
console.log(token0Name, token0Symbol, token0Decimals)

// load diffrent token and load its metadata
erc20.setContractHash(token1ContractHash)
const token1Name = await erc20.getName()
const token1Symbol = await erc20.getSymbol()
const token1Decimals = await erc20.getDecimals()
console.log(token1Name, token1Symbol, token1Decimals)
```

:::tip Output
500n<br />
500n<br />
CoinA ACOIN 12n<br />
CoinB BCOIN 12n
:::

### Load DEX and tokens

:::note Deploying and loading erc20 contracts
The deploy function serves as a one-stop solution for deploying ERC20 contracts. When invoked, returns a unique contract address. This address serves as a reference for the deployed contract.
By providing the contract hash returned during deployment, the load function dynamically adds all necessary methods to the specified contract. This dynamic loading capability ensures that the contract is equipped with the essential functionalities defined by the ERC20 standard.
:::

Load the Invariant contract by providing the Casper Client (`client`), and indicating the Invariant contract hash (`INVARIANT_CONTRACT_HASH`). Similarly, initialize the ERC20 token contract using the same approach.

```typescript
// load invariant contract
const invariant = await Invariant.load(client, invariantContractHash, Network.Local)

// load token contract
const erc20 = await Erc20.load(client, Network.Local, token0ContractHash)
```

### Create pool

:::info Big numbers
You can create custom decimals using the `toDecimal` syntax, where the first argument indicates type of a decimal, second represents the numerical value (A), and the third indicates the power of 10 (B) in the formula `A * 10^(-B)`. For example, `toDecimal(Decimal.Percentage, 3n, 2n)` will result in a percentage decimal equal to 0.03. For further details on supported types, please check the documentation [here](types.md).
:::

:::note Why "n" is at the end of every number
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision.
:::

:::warning Token sorting
Tokens are sorted alphabetically when pool key is created, so make sure that you swap tokens in correct direction. Read more about pool keys [here](storage#poolkey).
:::

To create a new pool, a fee tier and pool key need to be prepared. The fee tier represents the desired fee for the pool, and the price needs to be converted to sqrt price because the entry points of the protocol accept it in this format. The pool key is constructed using the addresses of two tokens and the specified fee tier. Finally, the `createPool` function is called with the user's account, the pool key, and the initial square root price, resulting in the creation of a new pool. The transaction hash of the pool creation is then logged to the console.

```typescript
// set fee tier, make sture that fee tier with specified parameters exists
const feeTier = await newFeeTier(await toDecimal(Decimal.Percentage, 1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

// if the fee tier does not exist, you have to add it
const isAdded = await invariant.feeTierExist(feeTier)
if (!isAdded) {
  await invariant.addFeeTier(account, feeTier)
}

// set initial square root of price of the pool, we set it to 1.00
const initSqrtPrice = await toDecimal(Decimal.SqrtPrice, 1n, 0n)

// set pool key, make sure that pool with speecified parameters does not exists
const poolKey = await newPoolKey(token0ContractPackage, token1ContractPackage, feeTier)

const createPoolResult = await invariant.createPool(account, poolKey, initSqrtPrice)

// print transaction result
console.log(createPoolResult.execution_results[0].result)
```

:::tip Output
Success
:::

### Create position

:::info How to calculate input amount
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000.
:::

Creating position involves preparing parameters such as the amount of tokens, tick indexes for the desired price range, liquidity, slippage and approving token transfers. There is need to calculate desired liquidity based on specified token amounts. For this case there are provided functions `getLiquidityByX` or `getLiquidityByY`. The slippage parameter represents the acceptable price difference that can occur on the pool during the execution of the transaction.

```typescript
// token y has 12 decimals and we want to add 8 actual tokens to our position
const tokenYAmount: TokenAmount = { v: 8n * 10n ** 12n }

// set lower and upper tick indexes, we want to create position in range [-10, 10]
const lowerTickIndex = -10n
const upperTickIndex = 10n

// calculate amount of token x we need to give to create position
const { amount: tokenXAmount, l: positionLiquidity } = await getLiquidityByY(
  tokenYAmount,
  lowerTickIndex,
  upperTickIndex,
  initSqrtPrice,
  true
)

// print amount of token x and y we need to give to create position based on parameters we passed
console.log(tokenXAmount, tokenYAmount)

const [tokenXContractHash, tokenYContractHash] = await orderTokens(
  token0ContractPackage,
  token1ContractPackage,
  token0ContractHash,
  token1ContractHash
)

// approve transfers of both tokens
erc20.setContractHash(tokenXContractHash)
await erc20.approve(account, Key.Hash, invariantContractPackage, tokenXAmount.v)
erc20.setContractHash(tokenYContractHash)
await erc20.approve(account, Key.Hash, invariantContractPackage, tokenYAmount.v)

// create position
const createPositionResult = await invariant.createPosition(
  account,
  poolKey,
  lowerTickIndex,
  upperTickIndex,
  positionLiquidity,
  initSqrtPrice,
  sqrtPriceLimit
)
console.log(createPositionResult.execution_results[0].result) // print transaction result
```

:::tip Output
{ v: 7999999999880n } { v: 8000000000000n }<br />
Success
:::

### Swap tokens

Performing a swap requires: specifying the amount of tokens to be swapped or desired amount to receive from the swap (input token amount will be calculated durning the swap), approving the transfer of the token, estimating the result of the swap, direction, determining the allowed slippage, calculating the square root price limit based on slippage, and finally, executing the swap. It's essential to note that the swap tolerance is expressed in square root price (sqrtPrice) after the swap, rather than the amount of tokens.

```typescript
// we want to swap 6 token0
// token0 has 12 deciamls so we need to multiply it by 10^12
const amount: TokenAmount = { v: 6n * 10n ** 12n }

// approve token x transfer
erc20.setContractHash(tokenXContractHash)
await erc20.approve(account, Key.Hash, invariantContractPackage, amount.v)

// ###
const TARGET_SQRT_PRICE = await toDecimal(Decimal.SqrtPrice, 10n, 0n)
// ###

// slippage is a price change you are willing to accept,
// for examples if current price is 1 and your slippage is 1%, then price limit will be 1.01
const allowedSlippage = await toDecimal(Decimal.Percentage, 1n, 3n) // 0.001 = 0.1%

// calculate sqrt price limit based on slippage
const slippageLimit = await calculateSqrtPriceAfterSlippage(
  TARGET_SQRT_PRICE,
  allowedSlippage,
  false
)

const swapResult = await invariant.swap(account, poolKey, true, amount, true, slippageLimit)
console.log(swapResult.execution_results[0].result) // print transaction result
```

:::tip Output
Success
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

const tick: Tick = await invariant.getTick(poolKey, tickIndex)
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

const pool: Pool = await invariant.getPool(poolKey)
```

- Get All Pools

```typescript
const pools: Pool[] = await invariant.getPools()
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

const position: Position = await invariant.getPosition(owner, positionIndex)
```

- Get Positions

```typescript
const positions: Position[] = await invariant.getPositions(owner)
```

### Query states and Calculate Fee

To query the state and calculate **unclaimed** fees **belonging to the position**, several functions are utilized. Positions, ticks, and pools are accessed to gather information about the state, and the calculateFee function is used to determine the amount of unclaimed tokens.

```typescript
// query state
const pool: Pool = await invariant.getPool(poolKey)
const position: Position = await invariant.getPosition(account, 0n)
const lowerTick: Tick = await invariant.getTick(poolKey, lowerTickIndex)
const upperTick: Tick = await invariant.getTick(poolKey, upperTickIndex)

// check amount of tokens that is available to claim
const fees = await calculateFee(pool, position, lowerTick, upperTick)

// print amount of unclaimed x and y tokens
console.log(fees)
```

:::tip Output
[ { v: 5999999999n }, { v: 0n } ]
:::

### Claim fees

Fees from a specific position are claimed without closing the position. This process involves specifying the position ID (indexed from 0), calling the claimFee function, and then checking the balance of a specific token after claiming the fees.

```typescript
// get balance of a specific token before claiming position fees and print it
const accountBalanceBeforeClaim = await erc20.getBalanceOf(Key.Account, accountAddress)
console.log(accountBalanceBeforeClaim)

// specify position id
const positionId = 0n
// claim fee
const claimFeeResult = await invariant.claimFee(account, positionId)
// print transaction result
console.log(claimFeeResult.execution_results[0].result)

// get balance of a specific token after claiming position fees and print it
const accountBalanceAfterClaim = await erc20.getBalanceOf(Key.Account, accountAddress)
console.log(accountBalanceAfterClaim)
```

:::tip Output
986000000000120n<br />
Success<br />
986006000000119n<br />
:::

### Transfer position

The entrypoint facilitates the seamless transfer of positions between users. This functionality streamlines the process of reassigning ownership of a specific position to another account. The entrypoint takes two parameters: index of position to transfer, address of account to receive the position.

```typescript
const positionToTransfer = await invariant.getPosition(account, 0n)

// transfer position from one account to another
await invariant.transferPosition(account, 0n, Key.Account, receiverAddress)

// get received position
const receiverPosition = await invariant.getPosition(receiver, 0n)
```

### Remove position

Position is removed from the protocol, and fees associated with that position are automatically claimed in the background. Here's a detailed description of the process:

```typescript
// fetch user balances before removal
const accountToken0BalanceBeforeRemove = await erc20.getBalanceOf(Key.Account, accountAddress)
erc20.setContractHash(token1ContractHash)
const accountToken1BalanceBeforeRemove = await erc20.getBalanceOf(Key.Account, accountAddress)
console.log(accountToken0BalanceBeforeRemove, accountToken1BalanceBeforeRemove)

// remove position
const removePositionResult = await invariant.removePosition(account, 0n)
console.log(removePositionResult.execution_results[0].result)

// fetch user balances after removal
erc20.setContractHash(token0ContractHash)
const accountToken0BalanceAfterRemove = await erc20.getBalanceOf(Key.Account, accountAddress)
erc20.setContractHash(token1ContractHash)
const accountToken1BalanceAfterRemove = await erc20.getBalanceOf(Key.Account, accountAddress)

// print balances
console.log(accountToken0BalanceAfterRemove, accountToken1BalanceAfterRemove)
```

:::tip Output
986006000000119n 997991756011645n<br />
Success<br />
999999999999998n 999999999999999n<br />
:::
