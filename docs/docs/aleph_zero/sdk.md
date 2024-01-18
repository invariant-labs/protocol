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
const main = async () => {
  const api = await initPolkadotApi(Network.Main) // initialize api, use enum to specify the network

  // initialize account, you can use your own wallet by pasting mnemonic phase
  const keyring = new Keyring({ type: 'sr25519' })
  const account = await keyring.addFromUri('//Alice')
}

main()
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
const main = async () => {
  // --snip--

  // load invariant contract
  const invariant = await Invariant.load(api, Network.Main, INVARIANT_ADDRESS)

  // load token contracts
  const token0 = await PSP22.load(api, Network.Main, TOKEN0_ADDRESS) // token we want to give
  const token1 = await PSP22.load(api, Network.Main, TOKEN1_ADDRESS) // token we want to receive

  // set fee tier and pool key, make sure that pool with specified parameters exists
  const feeTier = newFeeTier(toFee(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1
  const poolKey = newPoolKey(
    token0.contract.address.toString(),
    token1.contract.address.toString(),
    feeTier
  )

  // make sure that you swap in correct direction,
  // here we check if token0 (token we want to give) is tokenX
  let xToY = isTokenX(token0.contract.address.toString(), token1.contract.address.toString())
}

main()
```

### Perform swap

:::info How to calculate input amount
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000.
:::

```typescript
const main = async () => {
  // --snip--

  // here we want to swap 6 token0
  // token0 has 12 decimals so we need to multiply it by 10^12
  const amount = 6n * 10n ** 12n

  // approve token0 transfer
  await token0.approve(account, invariant.contract.address.toString(), amount)

  // slippage is a price change you are willing to accept,
  // for examples if current price is 1 and your slippage is 1%, then price limit will be 1.01
  const allowedSlippage = toPercentage(1n, 3n) // 0.001 = 0.1%

  // swap message only accepts price limit so we have to calculate it in order to use slippage,
  // here we are passing current price and allowed slippage to calculate price limit
  const pool = await invariant.getPool(
    account,
    token0.contract.address.toString(),
    token1.contract.address.toString(),
    feeTier
  )
  const sqrtPriceLimit = calculateSqrtPriceAfterSlippage(pool.sqrtPrice, allowedSlippage, xToY)

  const result = await invariant.swap(account, poolKey, xToY, amount, true, priceLimit)
  console.log(result.hash) // print transaction hash
}

main()
```

### Query state

```typescript
const main = async () => {
  // --snip--

  // get specific user address
  const userAddress = account.address.toString()

  // retrieve positions of that user
  const positions = invariant.getPositions(account, userAddress)

  const fees = new Map()

  // loop through user's positions
  positions.map(position => {
    // get token x and y addresses
    const tokenX = position.poolKey.tokenX
    const tokenY = position.poolKey.tokenY

    // add unclaimed fees to a map
    map.set(tokenX, (map.get(tokenX) || 0) + position.tokensOwedX)
    map.set(tokenY, (map.get(tokenY) || 0) + position.tokensOwedY)
  })

  // print total amount of fees of all positions
  console.log(fees)
}

main()
```

### Claim fees

```typescript
const main = async () => {
  // --snip--

  // claim fees
  // specify position id, positions are indexed from 0
  const positionId = 0n
  await invariant.claimFee(account, positionId)

  // get balance of a specific token after claiming position fees and print it
  const accountBalance = await token0.balanceOf(account, account.address)
  console.log(accountBalance)
}

main()
```

### Wrap AZERO

:::note Why do you need to wrap AZERO
In order to use native token you have to wrap it to PSP22 token using Wrapped AZERO contract. After sending AZERO you will receive the same amount as a PSP22 token which you can use in our DEX. You can feely exchange them at 1:1 ratio.
:::

:::warning Only use official Wrapped AZERO contract
You should only use official Wrapped AZERO contract. This address represents official testnet contract: `5EFDb7mKbougLtr5dnwd5KDfZ3wK55JPGPLiryKq4uRMPR46`. Mainnet contract is not deployed yet.
:::

```typescript
const main = async () => {
  // --snip--

  // load wazero contract
  const wazero = await WrappedAZERO.load(api, network, WAZERO_ADDRESS)

  // send AZERO using deposit method
  await wazero.deposit(1000n)

  // you will receive WAZERO token which you can use as any other token,
  // later you can exchange it back to AZERO at 1:1 ratio
  const accountBalance = wazero.balanceOf(account, account.address)
}

main()
```

### Attach event listeners

```typescript
const main = async () => {
  // --snip--

  // attach event listener to invariant contract and listen for swap events
  invariant.on(InvariantEvent.SwapEvent, (event: SwapEvent) => {
    // checking if swap was made on a specific pool
    if (event.poolKey === poolKey) {
      // do action
    }
  })
}

main()
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
