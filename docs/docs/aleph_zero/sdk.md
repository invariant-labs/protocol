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

Math contains Rust structs and data from main Invariant contract exported using WASM.

### Source

Everything combined in easy-to-use interface.

### Tests

Tests folder with tests to make sure everything works right.

## Usage

### Starting off

```typescript
const api = await initPolkadotApi(Network.Main) // initialize api, use enum to specify the network

// initialize account, you can use your own wallet by pasting mnemonic phase
const keyring = new Keyring({ type: 'sr25519' })
const account = await keyring.addFromUri('//Alice')
```

### Initialize DEX and tokens

:::note Why "n" is at the end of every number
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision. Read more about BigInt here: [BigInt MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt).
:::

:::info Creating types
You can create custom decimals with `toDecimal` syntax. First argument is an integer and second argument is a number of zeros. For example `toFee(3n, 2n)` will produce decimal equal to `0.03`. Read more about types here: [Types](types.md).
:::

:::warning Token sorting
Tokens are sorted alphabetically when pool key is created, so make sure that you swap tokens in correct direction. Read more about pool keys here: [PoolKey](storage#poolkey).
:::

```typescript
// --snip--

// load invariant contract
const invariant = await Invariant.load(api, Network.Local, INVARIANT_ADDRESS)

// load token contract
const psp22 = await PSP22.load(api, Network.Local, TOKEN0_ADDRESS)
```

### Create pool

```typescript
// --snip--

// set fee tier, make sure that fee tier with specified parameters exists
const feeTier = newFeeTier(toPercentage(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

// set initial price of the pool, we set it to 1.00
const initSqrtPrice = toSqrtPrice(1n, 0n)

await invariant.createPool(account, TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier, initSqrtPrice, 0n)
```

### Open position

```typescript
// token y has 12 decimals and we want to add 8 actual tokens to our position
const tokenYAmount = 8n * 10n ** 12n

// set lower and upper tick, we want to create position in range [-10, 10]
const lowerTick = -10n
const upperTick = 10n

const liquidityResult = getLiquidityByX(tokenYAmount, lowerTick, upperTick, initSqrtPrice, true)
const tokenXAmount = liquidityResult.amount
const positionLiquidity = liquidityResult.l

// print amount of token x and y we need to give to open position based on parameteres we passed
console.log(tokenYAmount, tokenXAmount)

// approve transfers of both tokens
await psp22.approve(
  account,
  invariant.contract.address.toString(),
  isTokenX(TOKEN0_ADDRESS, TOKEN1_ADDRESS) ? tokenYAmount : tokenXAmount
)
await psp22.setContractAddress(TOKEN1_ADDRESS)
await psp22.approve(
  account,
  invariant.contract.address.toString(),
  isTokenX(TOKEN0_ADDRESS, TOKEN1_ADDRESS) ? tokenXAmount : tokenYAmount
)
await psp22.setContractAddress(TOKEN0_ADDRESS)

// open up position
await invariant.createPosition(
  account,
  poolKey,
  lowerTick,
  upperTick,
  positionLiquidity,
  initSqrtPrice,
  initSqrtPrice
)
```

### Perform swap

:::info How to calculate input amount
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000.
:::

```typescript
// --snip--

const poolKey = newPoolKey(TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)

// make sure that you swap in correct direction,
// here we check if token0 (token we want to give) is tokenX
const xToY = isTokenX(TOKEN0_ADDRESS, TOKEN1_ADDRESS)

// here we want to swap 6 token0
// token0 has 12 decimals so we need to multiply it by 10^12
const amount = 6n * 10n ** 12n

// approve token0 transfer
await psp22.approve(account, invariant.contract.address.toString(), amount)

// slippage is a price change you are willing to accept,
// for examples if current price is 1 and your slippage is 1%, then price limit will be 1.01
const allowedSlippage = toPercentage(1n, 3n) // 0.001 = 0.1%

// swap message only accepts price limit so we have to calculate it in order to use slippage,
// here we are passing current price and allowed slippage to calculate price limit
const pool = await invariant.getPool(account, TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)
const sqrtPriceLimit = calculateSqrtPriceAfterSlippage(pool.sqrtPrice, allowedSlippage, !xToY)

const result = await invariant.swap(account, poolKey, xToY, amount, true, sqrtPriceLimit)
console.log(result.hash) // print transaction hash
```

### Query state

```typescript
// --snip--

// query state
const poolAfter = await invariant.getPool(account, TOKEN0_ADDRESS, TOKEN1_ADDRESS, feeTier)
const positionAfter = await invariant.getPosition(account, account.address, 0n)
const lowerTickAfter = await invariant.getTick(account, poolKey, positionAfter.lowerTickIndex)
const upperTickAfter = await invariant.getTick(account, poolKey, positionAfter.upperTickIndex)

// calculate unclaimed fees
const unclaimedFees = simulateUnclaimedFees(
  poolAfter,
  positionAfter,
  lowerTickAfter,
  upperTickAfter
)

// print amount of unclaimed x and y token
console.log(unclaimedFees)
```

### Claim fees

```typescript
// --snip--

// claim fees
// specify position id, positions are indexed from 0
const positionId = 0n
await invariant.claimFee(account, positionId)

// get balance of a specific token after claiming position fees and print it
const accountBalance = await psp22.balanceOf(account, account.address)
console.log(accountBalance)
```

### Remove position

```typescript
// remove position
invariant.removePosition(account, positionId)

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

### Attach event listeners

```typescript
// --snip--

// attach event listener to invariant contract and listen for swap events
invariant.on(InvariantEvent.SwapEvent, (event: SwapEvent) => {
  // checking if swap was made on a specific pool
  if (event.poolKey === poolKey) {
    // do action
  }
})
```

## Types

### Network

Network allows you to choose network you want to perform actions on.

```typescript
enum Network {
  Local = 'local',
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}
```

### Decimal

Read more about decimals here: [Types](types.md)

```typescript
interface DecimalName {
  v: bigint
}

// exception
type TokenAmount = bigint
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
