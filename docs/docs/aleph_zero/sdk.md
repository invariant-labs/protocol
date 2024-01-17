---
title: SDK

slug: /aleph_zero/sdk
---

SDK (Software Development Kit) can be used to interact with our DEX programatically. It provides an easy way to integrate your app with Invariant, PSP22 tokens and Wrapped AZERO.

## Build

### Installation

Clone repository

```bash
git clone git@github.com:invariant-labs/protocol-a0.git
```

Install substrate-contracts-node

```bash
cargo install contracts-node --git https://github.com/paritytech/substrate-contracts-node.git
```

Run build script

```bash
./build.sh
```

Run test script

```bash
./tests.sh
```

## Overview

### Structure

Invariant SDK consists of 3 separate contracts: our DEX contract (Invariant), token contract (PSP22), contract that can be used to wrap native currency (Wrapped AZERO) and various helper functions. You can deploy your own or use existing address of any of those contracts.

### Txs and Queries

Network enum allows you to choose network you want to perform actions on. In order to make a contract call you have to use methods of classes of loaded or deployed contracts. First parameter will always be an account you want to use and rest of parameters will be an entrypoint parameters.

### Event listeners

Invariant class has additional methods that allows you to attach event listeners so you can run your own code based on contract activity.

### Values and Helper functions

SDK also contains all essential values that might be needed in your app like maximum tick, maximum price and many others. Also you can use helper functions that will simplify various calculations.

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
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision. We use it almost everywhere in our SDK.  
:::

:::warning Token sorting
Tokens are sorted alphabetically when pool key is created, so make sure that you swap tokens in correct direction.
:::

```typescript
const main = async () => {
  // --snip--

  // load invariant contract
  const invariant = await Invariant.load(api, Network.Main, '0x_contract_address')

  // load token contracts
  const token0 = await PSP22.load(api, Network.Main, '0x_token0_address') // token we want to give
  const token1 = await PSP22.load(api, Network.Main, '0x_token0_address') // token we want to receive

  // set fee tier and pool key, make sure that pool with specified parameters exists
  const feeTier = newFeeTier(toFee(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1
  const poolKey = newPoolKey(
    token0.contract.address.toString(),
    token1.contract.address.toString(),
    feeTier
  )

  // make sure that you swap in correct direction,
  // here we check if token0 (token we want to give) is tokenX,
  // if it is then set xToY param to true, otherwise set it to false
  let xToY
  if (isTokenX(token0.contract.address.toString(), token1.contract.address.toString())) {
    xToY = true
  } else {
    xToY = false
  }
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
  console.log(result.hash) // print hash of a transaction
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
  const wazero = await WrappedAZERO.load(api, network, '0x_wazero_address')

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
