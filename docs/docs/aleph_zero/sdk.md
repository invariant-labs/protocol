---
title: SDK

slug: /aleph_zero/sdk
---

SDK (Software Development Kit) can be used to interact with our DEX programatically. It provides an easy way to integrate your app with Invariant, PSP22 tokens and Wrapped AZERO.

## Installation

### Download

Published package can be found [here](https://google.com/).

### Build

You can find build steps [here](installation.md).

## Overview

The Invariant SDK comprises three distinct contracts:

1. DEX Contract (Invariant): This is the core contract handling DEX functionality within the Invariant ecosystem.

2. Token Contract (PSP22): This contract is responsible for managing and implementing the PSP22 token standard within the Invariant framework. Allows to deploy or load existing contracts.

3. Wrapped Native Currency Contract (Wrapped AZERO): This contract allows users to wrap the native currency, providing compatibility and interoperability within the Invariant ecosystem.

### Project Structure

```
📦sdk
 ┣ 📂contracts
 ┃ ┣ 📂invariant
 ┃ ┣ 📂PSP22
 ┃ ┗ 📂wrapped-azero
 ┣ 📂math
 ┣ 📂src
 ┗ 📂tests
```

### Transactions and Queries

When working with contracts, developers can seamlessly initiate interactions by calling methods from the corresponding contract class. The first parameter designates the account, and subsequent parameters act as entrypoint parameters, facilitating smooth contract interactions.

1. **Transactions**: These involve invoking methods that result in changes to the blockchain state. Transactions typically alter the data stored on the blockchain and may include operations like transferring assets, updating records, or executing specific actions.

2. **Queries**: Unlike transactions, queries are read-only interactions with the contract. They allow developers to retrieve information from the blockchain without modifying its state. Queries are useful for obtaining current contract state, fetching data, or verifying certain conditions without making any changes to the blockchain.

### Listening to Events

The Invariant class offers additional methods empowering developers to attach event listeners. This feature enables the execution of custom code based on contract activity, enhancing flexibility and customization in response to specific events.

### Values and Helper functions

The SDK includes fundamental values and utility functions for application development. These encompass parameters such as maximum tick, maximum price, and calculations for price impact. This suite of utility functions streamlines computational aspects, enhancing the efficiency of application logic.

### Contracts Metadata

Within the Contracts folder, developers can find deploy-ready contracts and metadata essential for interactions. This structure facilitates straightforward integration with the specified contracts, simplifying the development workflow.

### Math

The Math folder contains Rust structs and data exported to WebAssembly using wasm_bindgen. This integration allows for the utilization of the same functions and data employed in the primary Invariant contract.

### Source

The Source directory consolidates all pieces into an easy-to-use interface. This organized structure simplifies the development process and provides developers with a centralized location for accessing essential resources.

### Tests

The Tests folder houses test suites to ensure the correct functioning of SDK.

## Usage Guide

Follow a step-by-step example demonstrating how to effectively use the Invariant SDK, with each step accompanied by code snippets. The complete code for these examples is available [here](https://google.com), ensuring a hands-on and comprehensive understanding of the SDK's functionality.

### Select Network

Begin by specifying the network you intend to connect to using the Network enum. Identify your target network, whether it's the local development environment, the mainnet, or a testnet. The code is designed to work uniformly across all networks. Changing the network designation does not require any modifications to the code.

```typescript
enum Network {
  Local = 'local',
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}
```

Initiate the Polkadot API effortlessly with the provided `initPolkadotApi` function. Use the `Network` enum to specify your desired network, simplifying the process of connecting to the blockchain. Utilize the versatile `Keyring` class to easily create and manage accounts. Initialize an account using your preferred method, whether it's using a provided mnemonic phrase or integrating your existing wallet.

```typescript
const api = await initPolkadotApi(Network.Local) // initialize api, use enum to specify the network

// initialize account, you can use your own wallet by pasting mnemonic phase
const keyring = new Keyring({ type: 'sr25519' })
const account = keyring.addFromUri('//Alice')
```

### Initialize DEX and tokens

Load the Invariant contract by providing the Polkadot API (`api`), specifying the network (e.g., `Network.Local` for local development), and indicating the Invariant contract address (`INVARIANT_ADDRESS`). Similarly, initialize the PSP22 token contract using the same approach. It's noteworthy that only a single instance of PSP22 is required to handle interactions with multiple tokens.

```typescript
// -- snip --

// load invariant contract
const invariant = await Invariant.load(api, Network.Local, INVARIANT_ADDRESS)

// load token contract
const psp22 = await PSP22.load(api, Network.Local, TOKEN0_ADDRESS)
```

### Create pool

:::info Creating types
You can create custom decimals using the `toDecimal` syntax, where the first argument represents the numerical value (A), and the second argument indicates the power of 10 (B) in the formula `A * 10^(-B)`. For example, `toDecimal(3n, 2n)` will result in a decimal equal to 0.03. For further details on supported types, please check the documentation [here](types.md).
:::

:::note Why "n" is at the end of every number
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision. Read more about BigInt [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt).
:::

:::warning Token sorting
Tokens are sorted alphabetically when pool key is created, so make sure that you swap tokens in correct direction. Read more about pool keys [here](storage#poolkey).
:::

To create a new pool, a fee tier and pool key need to be prepared. The fee tier represents the desired fee for the pool, and the price needs to be converted to sqrt price because the entry points of the system accept it in this format. The pool key is constructed using the addresses of two tokens and the specified fee tier. Finally, the `createPool` function is called with the user's account, the pool key, and the initial square root price, resulting in the creation of a new pool. The transaction hash of the pool creation is then logged to the console.

```typescript
// -- snip --

// set fee tier, make sure that fee tier with specified parameters exists
const feeTier = newFeeTier(toPercentage(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

// set initial price of the pool, we set it to 1.00
// all endpoints only accept sqrt price so we need to convert it before passing it
const price = toPrice(1n, 0n)
const initSqrtPrice = priceToSqrtPrice(price)

// set pool key, make sure that pool with specified parameters does not exists
const poolKey = newPoolKey(TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)

const createPoolResult = await invariant.createPool(account, poolKey, initSqrtPrice)

console.log(createPoolResult.hash)
```

:::tip Output
0x4324eaff0c4da2d5082fa03c2ef0e0138ed60946525952645a9d8c4d50cb5ec2
:::

### Create position

To create a new position within a pool, certain steps need to be followed. The process involves preparing parameters such as the amount of tokens, tick indexes for the desired price range, and approving token transfers. Below is a breakdown of the process:

```typescript
// -- snip --

// token y has 12 decimals and we want to add 8 actual tokens to our position
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
await psp22.setContractAddress(poolKey.tokenX)
await psp22.approve(account, invariant.contract.address.toString(), tokenXAmount)
await psp22.setContractAddress(poolKey.tokenY)
await psp22.approve(account, invariant.contract.address.toString(), tokenYAmount)

// create position
const createPositionResult = await invariant.createPosition(
  account,
  poolKey,
  lowerTickIndex,
  upperTickIndex,
  positionLiquidity,
  initSqrtPrice,
  0n
)
console.log(createPositionResult.hash)
```

:::tip Output
7999999999880n 8000000000000n <br/>
0x652108bb36032bc386fec2eef3f483f29970db7bdbdc9a1a340e279abd626ee2
:::

### Swap tokens

:::info How to calculate input amount
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000.
:::

Peforming a swap requires: specifying the amount of tokens to be swapped, approving the transfer of the token, estimating the result of the swap, determining the allowed slippage, calculating the square root price limit based on slippage, and finally, executing the swap. Here's a breakdown of the process:

```typescript
// -- snip --

// we want to swap 6 token0
// token0 has 12 decimals so we need to multiply it by 10^12
const amount = 6n * 10n ** 12n

// approve token x transfer
await psp22.setContractAddress(poolKey.tokenX)
await psp22.approve(account, invariant.contract.address.toString(), amount)

// get estimated result of swap
const quoteResult = await invariant.quote(account, poolKey, true, amount, true)

// slippage is a price change you are willing to accept,
// for examples if current price is 1 and your slippage is 1%, then price limit will be 1.01
const allowedSlippage = toPercentage(1n, 3n) // 0.001 = 0.1%

// calculate sqrt price limit based on slippage
const sqrtPriceLimit = calculateSqrtPriceAfterSlippage(
  quoteResult.targetSqrtPrice,
  allowedSlippage,
  false
)

const swapResult = await invariant.swap(account, poolKey, true, amount, true, sqrtPriceLimit)
console.log(swapResult.hash)
```

:::tip Output
0xd9cdfddb2c783f24a481811f0f9d7037e2f7202907f092986ecd98838db2b3cb
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

const tickState: Tick = await invariant.getTick(signer, poolKey, tickIndex)
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

const poolState: Pool = await invariant.getPool(signer, TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)
```

- Get Pools

```typescript
const pools: Pool[] = await invariant.getPools(signer)
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

const positionState: Position = await invariant.getPosition(signer, owner.address, positionIndex)
```

- Get Positions

```typescript
const positions: Position[] = await invariant.getPositions(
  await invariant.getPositions(signer, owner.address)
)
```

### Query states and Calculate Fee

To query the state and calculate fees within the system, several functions are utilized. Positions, ticks, and pools are accessed to gather information about the state, and the calculateFee function is used to determine the amount of unclaimed tokens. The process is described below:

```typescript
// -- snip --

// query state
const poolAfter: Pool = await invariant.getPool(account, TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)
const positionAfter: Position = await invariant.getPosition(account, account.address, 0n)
const lowerTickAfter: Tick = await invariant.getTick(account, poolKey, positionAfter.lowerTickIndex)
const upperTickAfter: Tick = await invariant.getTick(account, poolKey, positionAfter.upperTickIndex)

// pools, ticks and positions have many fee growth fields that are used to calculate fees,
// by doing that off chain we can save gas fees,
// so in order to see how many tokens you can claim from fees you need to use calculate fee function
const fees = calculateFee(poolAfter, positionAfter, lowerTickAfter, upperTickAfter)

// print amount of unclaimed x and y token
console.log(fees)
```

:::tip Output
{x: 59999999999n, y: 0n }
:::

### Claim fees

In the following code snippet, fees from a specific position are claimed without closing the position. This process involves specifying the position ID (indexed from 0), calling the claimFee function, and then checking the balance of a specific token after claiming the fees. The description is as follows:

```typescript
// -- snip --

// specify position id
const positionId = 0n
const claimFeeResult = await invariant.claimFee(account, positionId)
console.log(claimFeeResult.hash)

// get balance of a specific token after claiming position fees and print it
const accountBalance = await psp22.balanceOf(account, account.address)
console.log(accountBalance)
```

:::tip Output
0xead1fe084c904e7b1d0df2f3953c74d03cb90756caea46ae1e896c6956460105 <br/>
999999999999999986060000000119n
:::

### Transfer position

Position is removed from the system, and fees associated with that position are automatically claimed in the background. Here's a detailed description of the process:

```typescript
// -- snip --

const positionToTransfer = await invariant.getPosition(account, account.address, 0n)

// Transfer position from account (signer) to receiver
await invariant.transferPosition(account, 0n, receiver.address)

// load received position
const receiverPosition = await invariant.getPosition(receiver, receiver.address, 0n)

// ensure that the position are equal
assert.deepEqual(positionToTransfer, receiverPosition)
console.log(receiverPosition)
```

:::tip Output
{<br/>
&emsp; poolKey: {<br/>
&emsp; &emsp; tokenX: '5CfCkzb2YfGcBVVK5b1UNAyNYra7iAmPrPAZ7joeqbTpG77P',<br/>
&emsp; &emsp;tokenY: '5FAjg6DMbbFv9zo1QksGt9GtPGu2qwFXG6jYvdXgybrYJkmR',<br/>
&emsp; &emsp;feeTier: { fee: 10000000000n, tickSpacing: 1n }<br/>
&emsp; },<br/>
&emsp; liquidity: 16004800319759905588483n,<br/>
&emsp; lowerTickIndex: -10n,<br/>
&emsp; upperTickIndex: 10n,<br/>
&emsp; feeGrowthInsideX: 37488752625000000000000n,<br/>
&emsp; feeGrowthInsideY: 0n,<br/>
&emsp; lastBlockNumber: 474n,<br/>
&emsp; tokensOwedX: 0n,<br/>
&emsp; tokensOwedY: 0n<br/>
}

:::

### Remove position

Position is removed from the system, and fees associated with that position are automatically claimed in the background. Here's a detailed description of the process:

```typescript
// -- snip --

// remove position
const removePositionResult = await invariant.removePosition(account, positionId)
console.log(removePositionResult.hash)

// get balance of a specific token after removing position
const accountToken0Balance = await psp22.balanceOf(account, account.address)
await psp22.setContractAddress(TOKEN1_ADDRESS)
const accountToken1Balance = await psp22.balanceOf(account, account.address)

// print balances
console.log(accountToken0Balance, accountToken1Balance)
```

:::tip Output
0xe90dfeb5420b26c4f0ed2d5a77825a785a7e42106cc45f5a7d08c597f46c1171 <br/>
999999999999999999999999999998n 999999999999999999999999999998n <br/>
:::

### Using AZERO via Wrapped AZERO

:::note Why do you need to wrap AZERO
In order to use native token you have to wrap it to PSP22 token using Wrapped AZERO contract. After sending AZERO you will receive the same amount as a PSP22 token which you can use in our DEX. You can feely exchange them at 1:1 ratio.
:::

:::warning Only use official Wrapped AZERO contract
You should only use official Wrapped AZERO contract. This address represents official testnet contract: `5EFDb7mKbougLtr5dnwd5KDfZ3wK55JPGPLiryKq4uRMPR46`. Mainnet contract is not deployed yet.
:::

```typescript
// -- snip --

// load wazero contract
const wazero = await WrappedAZERO.load(api, network, WAZERO_ADDRESS)

// send AZERO using deposit method
await wazero.deposit(account, 1000n)

// you will receive WAZERO token which you can use as any other token,
// later you can exchange it back to AZERO at 1:1 ratio
const accountBalance = await wazero.balanceOf(account, account.address)
console.log(accountBalance)
```

:::tip Output
1000n<br/>
:::

### PSP22 token

In the following TypeScript code, we demonstrate approach deploying and initializing PSP22 token contracts using the `PSP22.deploy` method. Notably, a single instance of the PSP22 class proves sufficient for handling interactions with multiple tokens.

```typescript
// deploy token, it will return tokens address
const TOKEN0_ADDRESS = await PSP22.deploy(api, account, 500n, 'Coin', 'COIN', 12n)

// load token by passing its address (you can use existing one), it allows you to interact with it
const psp22 = await PSP22.load(api, Network.Local, TOKEN0_ADDRESS)

// interact with token 0
const account0Balance = await psp22.balanceOf(account, account.address)
console.log(account0Balance)

// if you want to interact with different token,
// simply set different contract address
await psp22.setContractAddress(TOKEN1_ADDRESS)

// now we can interact with token y
const account1Balance = await psp22.balanceOf(account, account.address)
console.log(account1Balance)
```

:::tip Output

500n <br/>
999999999999999999999999999998n

:::

### Listen to Event

Invariant provides the capability to set up event listeners, allowing developers to respond to specific events within the contract. The event listener structs are detailed below, accompanied by a code snippet demonstrating how to set up listeners for each specific event type.

```typescript
interface CreatePositionEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
  liquidity: Liquidity
  lowerTick: bigint
  upperTick: bigint
  currentSqrtPrice: SqrtPrice
}

interface CrossTickEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
  indexes: bigint[]
}

interface RemovePositionEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
  liquidity: Liquidity
  lowerTick: bigint
  upperTick: bigint
  currentSqrtPrice: SqrtPrice
}

interface SwapEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
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
// -- snip --

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
invariant.on(InvariantEvent.SwapEvent, handler)
```

When event subscriptions are no longer needed, developers can use the `invariant.off` method to unsubscribe from specific events. This ensures efficient resource management and stops further notifications for the specified event type.

```typescript
// remove event listener when it is no longer needed
invariant.off(InvariantEvent.SwapEvent, handler)
```

## Types

### Decimal

This types are utilized to represent decimal values, and it is worth noting that these decimal types are exported from Rust through WebAssembly (Wasm) using wasm-bindgen. Read more about [decimals](types.md).

```typescript
type DecimalName = bigint
```

### Network

Network serves as a convenient way to select the network on which various actions are performed. The enumeration includes options for 'local', 'mainnet', and 'testnet'. Users can switch between networks without the need of any code adjustments.

```typescript
enum Network {
  Local = 'local',
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}
```

### Events

Code snippet introduces several event interfaces related to the Invariant, providing structured information about various actions. These events can be subscribed to using the Invariant, enabling users to receive updates when specific actions occur within the contract.

```typescript
interface CreatePositionEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
  liquidity: Liquidity
  lowerTick: bigint
  upperTick: bigint
  currentSqrtPrice: SqrtPrice
}

interface CrossTickEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
  indexes: bigint[]
}

interface RemovePositionEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
  liquidity: Liquidity
  lowerTick: bigint
  upperTick: bigint
  currentSqrtPrice: SqrtPrice
}

interface SwapEvent {
  timestamp: bigint
  address: string
  pool: PoolKey
  amountIn: TokenAmount
  amountOut: TokenAmount
  fee: TokenAmount
  startSqrtPrice: SqrtPrice
  targetSqrtPrice: SqrtPrice
  xToY: boolean
}
```

### Storage

These interfaces are essential for managing various aspects of the Invariant's storage. It is important to note that these interfaces are exported from Rust to TypeScript using wasm-bindgen, providing seamless integration between the two languages. Read more about storage [here](storage.md).

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
