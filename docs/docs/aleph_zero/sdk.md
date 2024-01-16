---
title: SDK

slug: /aleph_zero/sdk
---

SDK (Software Development Kit) can be used to interact with our contract programatically.

## Build

### Installation

Clone repository

```bash
git clone git@github.com:invariant-labs/protocol-a0.git
```

Install NPM packages & build WASM from existing contract

```bash
cd sdk
npm i
npm run wasm:build
npm run build
```

### Testing

Install substrate-contracts-node

```bash
cargo install contracts-node --git https://github.com/paritytech/substrate-contracts-node.git
```

Run test script

```bash
./tests.sh
```

## Overview

Our SDK consists of 3 separate contracts: our DEX contract (Invariant), token contarct (PSP22), and contract that can be used to wrap native currency (Wrapped AZERO) and various helper functions. You can deploy your own or use existing address of any of those contracts. Network enum allows you to choose network you want to perform actions to. In order to make a contract call you have to use methods of classes of loaded or deployed contracts. First parameter will always be an account you want to call from and rest of parameters will be entrypoint parameters. Invariant class has additional methods that allows you to attach event listeners so you can run your own code based on contract activity.

## Usage

### Starting off

```javascript
const main = async () => {
  const api = await initPolkadotApi(Network.Main) // initialize api, use enum to specify the network

  const keyring = new Keyring({ type: 'sr25519' })
  const account = await keyring.addFromUri('//Alice') // initialize account (we used dummy account, use your own)
}

main()
```

### Initialize DEX and tokens

:::note
Notice how we use "n" at the end of every number. "n" indicates that specified value is a BigInt, number with higher precision. We use it almost everywhere in our SDK.  
:::

:::warning
Tokens are sorted alphabetically when pool key is created, so make sure that you swap tokens in correct direction.
:::

```javascript
const main = async () => {
  // --snip--

  // load invariant contract
  const invariant = await Invariant.load(api, Network.Main, 'contract_address')

  // load token contracts
  const token0 = await PSP22.load(api, Network.Main, 'token0_address') // token we want to give
  const token1 = await PSP22.load(api, Network.Main, 'token0_address') // token we want to receive

  // set fee tier and pool key, make sure that pool with specified parameters exists
  const feeTier = newFeeTier({ v: 10000000000n }, 1n) // fee: 1% = 10^10, tick spacing: 1
  const poolKey = newPoolKey(
    token0.contract.address.toString(),
    token1.contract.address.toString(),
    feeTier
  )

  // make sure that you swap in correct direction,
  // here we check if token0 (token we want to give) is tokenX,
  // if it is then set xToY param to true, otherwise set it to false
  let xToY
  if (token0.contract.address.toString() === poolKey.tokenX) {
    xToY = true
  } else {
    xToY = false
  }
}

main()
```

### Perform swap

:::info How to calculate input amount?
In order to calculate input amount, we have to multiply actual token amount you want to swap times 10 to the power of decimal.
Let's say some token has decimal of 12 and we want to swap 6 actual tokens. Here is how we can calculate input amount:
6 \* 10^12 = 6000000000000.
:::

```javascript
const main = async () => {
  // --snip--

  // here we want to swap 6 token0
  // token0 has 12 decimals so we need to multiply it by 10^12
  const amount = 6n * 10n ** 12n

  // approve token0 transfer
  token0.approve(account, invariant.contract.address.toString(), amount)

  const allowedSlippage = { v: 1000000000n } // 0.1% = 10^9

  // swap message only accepts price limit so we have to calculate it in order to use slippage,
  // here we are passing current price and allowed slippage to calculate price limit
  const pool = await invariant.getPool(
    account,
    token0.contract.address.toString(),
    token1.contract.address.toString(),
    feeTier
  )
  const priceLimit = calculateSqrtPriceAfterSlippage(pool.sqrtPrice, allowedSlippage, xToY)

  await invariant.swap(account, poolKey, xToY, amount, true, priceLimit)
}

main()
```
