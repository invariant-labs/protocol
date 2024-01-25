---
title: SDK

slug: /aleph_zero/sdk
---

SDK (Software Development Kit) can be used to interact with our DEX programatically. It provides an easy way to integrate your app with Invariant, PSP22 tokens and Wrapped AZERO.

## Installation

### Download

Published package can be found here: [NPM](https://google.com/).

### Build

You can find build steps here: [Installation](installation.md).

## Overview

### Structure

Invariant SDK consists of 3 separate contracts: our DEX contract (Invariant), token contract (PSP22), contract that can be used to wrap native currency (Wrapped AZERO), various values and helper functions. You can deploy your own or use an existing contract.

### Txs and Queries

After you load or deploy a contract you can start interacting with it. In order to make a contract call you have to use methods of class that represents specific contract. First parameter will always be an account you want to use and rest of parameters will be an entrypoint parameters.

### Event listeners

Invariant class has additional methods that allows you to attach event listeners so you can run your own code based on contract activity.

### Values and Helper functions

SDK also contains all essential values and helper functions that might be needed in your app like maximum tick, maximum price, calculating price impact and many others that will simplify your calculations.

## Files

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

### Contracts

Contracts folder contains deploy-ready contracts and metadata that is used to interact with them.

### Math

Math contains Rust structs and data exported to WASM using wasm_bindgen which allowed use to the same functions and data that is used in main Invariant contract.

### Source

Everything combined in easy-to-use interface.

### Tests

Tests folder with tests to make sure everything works right.

## Usage

### Starting off

```typescript
enum Network {
  Local = 'local',
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}
```

```typescript
const api = await initPolkadotApi(Network.Local) // initialize api, use enum to specify the network

// initialize account, you can use your own wallet by pasting mnemonic phase
const keyring = new Keyring({ type: 'sr25519' })
const account = keyring.addFromUri('//Alice')
```

### Initialize DEX and tokens

```typescript
// --snip--

// load invariant contract
const invariant = await Invariant.load(api, Network.Local, INVARIANT_ADDRESS)

// load token contract
const psp22 = await PSP22.load(api, Network.Local, TOKEN0_ADDRESS)
```

### Create pool

:::info Creating types
You can create custom decimals with `toDecimal` syntax. First argument is an integer and second argument is a number of zeros. For example `toFee(3n, 2n)` will produce decimal equal to `0.03`. Read more about types here: [Types](types.md).
:::

:::note Why "n" is at the end of every number
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision. Read more about BigInt here: [BigInt MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt).
:::

:::warning Token sorting
Tokens are sorted alphabetically when pool key is created, so make sure that you swap tokens in correct direction. Read more about pool keys here: [PoolKey](storage#poolkey).
:::

```typescript
type DecimalName = bigint

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
```

```typescript
// --snip--

// set fee tier, make sure that fee tier with specified parameters exists
const feeTier = newFeeTier(toPercentage(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

// set initial price of the pool, we set it to 1.00
// all endpoints only accept sqrt price so we need to convert it before passing it
const price = toPrice(1n, 0n)
const initSqrtPrice = priceToSqrtPrice(price)

// set pool key, make sure that pool with specified parameters does not exists
const poolKey = newPoolKey(TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)

const createPoolResult = await invariant.createPool(account, poolKey, initSqrtPrice)
console.log(createPoolResult.hash) // print transaction hash
```

### Open position

```typescript
// -- snip --

// token y has 12 decimals and we want to add 8 actual tokens to our position
const tokenYAmount = 8n * 10n ** 12n

// set lower and upper tick, we want to create position in range [-10, 10]
const lowerTick = -10n
const upperTick = 10n

// calculate amount of token x we need to give to open position
const { amount: tokenXAmount, l: positionLiquidity } = getLiquidityByY(
  tokenYAmount,
  lowerTick,
  upperTick,
  initSqrtPrice,
  true
)

// print amount of token x and y we need to give to open position based on parameteres we passed
console.log(tokenXAmount, tokenYAmount)

// approve transfers of both tokens
await psp22.setContractAddress(poolKey.tokenX)
await psp22.approve(account, invariant.contract.address.toString(), tokenXAmount)
await psp22.setContractAddress(poolKey.tokenY)
await psp22.approve(account, invariant.contract.address.toString(), tokenYAmount)

// open up position
const createPositionResult = await invariant.createPosition(
  account,
  poolKey,
  lowerTick,
  upperTick,
  positionLiquidity,
  initSqrtPrice,
  0n
)
console.log(createPositionResult.hash) // print transaction hash
```

### Perform swap

:::info How to calculate input amount
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000.
:::

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

```typescript
// --snip--

// here we want to swap 6 token0
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
console.log(swapResult.hash) // print transaction hash
```

### Query state

:::note Position indexing
Remember that positions are indexed from 0. So if you create position, its id will be 0 and your next positions id will be 1.
:::

```typescript
// --snip--

// query state
const poolAfter = await invariant.getPool(account, TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)
// last parameter here is position id, positions are indexed from 0
const positionAfter = await invariant.getPosition(account, account.address, 0n)
const lowerTickAfter = await invariant.getTick(account, poolKey, positionAfter.lowerTickIndex)
const upperTickAfter = await invariant.getTick(account, poolKey, positionAfter.upperTickIndex)

// pools, ticks and positions have many fee growth fields that are used to calculate fees,
// by doing that off chain we can save gas fees,
// so in order to see how many tokens you can claim from fees you need to use calculate fee function
const fees = calculateFee(poolAfter, positionAfter, lowerTickAfter, upperTickAfter)

// print amount of unclaimed x and y token
console.log(fees)
```

### Claim fees

```typescript
// --snip--

// claim fees
// specify position id, positions are indexed from 0
const positionId = 0n
const claimFeeResult = await invariant.claimFee(account, positionId)
console.log(claimFeeResult.hash) // print transaction hash

// get balance of a specific token after claiming position fees and print it
const accountBalance = await psp22.balanceOf(account, account.address)
console.log(accountBalance)
```

### Remove position

```typescript
// -- snip --

// remove position
const removePositionResult = await invariant.removePosition(account, positionId)
console.log(removePositionResult.hash) // print transaction hash

// get balance of a specific token after removing position
const accountToken0Balance = await psp22.balanceOf(account, account.address)
await psp22.setContractAddress(TOKEN1_ADDRESS)
const accountToken1Balance = await psp22.balanceOf(account, account.address)

// print balances
console.log(accountToken0Balance, accountToken1Balance)
```

### Wrap AZERO

:::note Why do you need to wrap AZERO
In order to use native token you have to wrap it to PSP22 token using Wrapped AZERO contract. After sending AZERO you will receive the same amount as a PSP22 token which you can use in our DEX. You can feely exchange them at 1:1 ratio.
:::

:::warning Only use official Wrapped AZERO contract
You should only use official Wrapped AZERO contract. This address represents official testnet contract: `5EFDb7mKbougLtr5dnwd5KDfZ3wK55JPGPLiryKq4uRMPR46`. Mainnet contract is not deployed yet.
:::

```typescript
// --snip--

// load wazero contract
const wazero = await WrappedAZERO.load(api, network, WAZERO_ADDRESS)

// send AZERO using deposit method
await wazero.deposit(1000n)

// you will receive WAZERO token which you can use as any other token,
// later you can exchange it back to AZERO at 1:1 ratio
const accountBalance = wazero.balanceOf(account, account.address)
```

### PSP22 token

```typescript
// deploy token, it will return tokens address
const TOKEN_X_ADDRESS = await PSP22.deploy(api, account, 500n, 'Coin', 'COIN', 12n)

// load token by passing its address (you can use existing one), it allows you to interact with it
const psp22 = await PSP22.load(api, Network.Local, TOKEN_X_ADDRESS)

// interact with token x
const tokenXBalance = await psp22.balanceOf(account, account.address)
console.log(tokenXBalance)

// if you want to interact with different token,
// simply set different contract address
await psp22.setContractAddress(TOKEN_Y_ADDRESS)

// now we can interact with token y
const tokenYBalance = await psp22.balanceOf(account, account.address)
console.log(tokenYBalance)
```

### Event listeners

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

```typescript
// --snip--

const handler = (event: SwapEvent) => {
  // checking if swap was made on a specific pool
  if (event.poolKey === poolKey) {
    // do action
  }
}

// attach event listener to invariant contract and listen for swap events
invariant.on(InvariantEvent.SwapEvent, handler)

// remove event listener when it is no longer needed
invariant.off(InvariantEvent.SwapEvent, handler)
```

## Types

### Decimal

Read more about decimals here: [Types](types.md)

```typescript
type DecimalName = bigint
```

### Network

Network allows you to choose network you want to perform actions on.

```typescript
enum Network {
  Local = 'local',
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}
```

### Events

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

Read more about storage here: [Storage](storage.md)

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
