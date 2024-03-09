---
title: SDK

slug: /casper/sdk
---

SDK can be used to interact with our DEX programmatically. It provides an easy way to integrate your app with Invariant, ERC20 tokens.

## Installation

### Download

Published package can be found [here](https://google.com).

### Build

You can find build steps [here](installation.md).

## Overview

The Invariant SDK comprises two distinct contracts:

1. DEX Contract (Invariant): This is the contract handling DEX functionality within the Invariant ecosystem.

2. Token Contract (ERC20): This contract is responsible for managing and implementing the ERC20 token standard within the Invariant protocol. Allows to deploy or load existing contracts.

### Transactions and Queries

When working with contracts, developers can initiate interactions by calling methods from the corresponding contract class. The first parameter designates the account, and subsequent parameters act as entrypoint parameters.

1. **Transactions**: These involve invoking methods that result in changes to the blockchain state. Transactions typically alter the data stored on the blockchain and may include operations like transferring assets, updating records, or executing specific actions. Once the transaction will be confirmed it returns the result.

2. **Queries**: Queries are read-only interactions with the contract. They allow developers to retrieve information from the blockchain without modifying its state. Queries are useful for obtaining current contract state, or verifying certain conditions. Importantly, queries do not return a transaction hash; instead, they provide results in the form of structs from [storage](storage.md).

### Listening to Events

-

### Values and Helper functions

The SDK includes fundamental values and utility functions for application development. These encompass parameters such as maximum tick, maximum price, and calculations for price impact.

### Contracts Metadata

Within the Contracts folder, developers can find deploy-ready contracts essential for interactions.

### Wasm

The Wasm functionality is encapsulated within our custom npm package, which includes Rust structs and data exported to WebAssembly using wasm_bindgen. This integration facilitates the utilization of identical functions and data within the main Invariant contract.

### Source

The Source directory consolidates all pieces into an easy-to-use interface. This organized structure simplifies the development process and provides developers with a centralized location for accessing essential resources.

### Tests

End-to-end (E2E) tests are an essential component of our testing strategy. We have adopted the Jest framework for our end-to-end testing needs. Our end-to-end tests encompass a comprehensive examination of the entire protocol. This includes testing all entrypoints of every contract within our protocol, ensuring that each contract behaves as expected under various conditions. Additionally, we thoroughly test our SDK math utilities to guarantee their accuracy and reliability.

### Project Structure

```
📦sdk
 ┣ 📂contracts
 ┃ ┣ 📜erc20.wasm
 ┃ ┗ 📜invariant.wasm
 ┣ 📂src
 ┗ 📂tests
```

## Types

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

Key determines the specific address. The enumeration includes options for 'account' and 'hash'. An account is a typical account that can be used to perform interactions, while a hash represents a contract, contract package, etc., deployed on the blockchain.

```typescript
enum Key {
  Account = 0,
  Hash = 1
}
```

### Events

-

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
```

## Usage Guide

Follow a step-by-step example demonstrating how to use the Invariant SDK, with each step accompanied by code snippets. The complete code for these examples is available [here](https://google.com), ensuring a hands-on and comprehensive understanding of the SDK's functionality.

### Select Network

Begin by specifying the network you intend to connect to using the Network enum. Identify your target network, whether it's the local development environment, the mainnet, or a testnet. The code is designed to work uniformly across all networks. Changing the network designation does not require any modifications to the code.

```typescript
enum Network {
  Local,
  Testnet,
  Mainnet
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

### Initlialize API

Initiate the Casper Client and Casper Service effortlessly with the provided `initCasperClientAndService` function. Use first parameter to specify your desired node.

```typescript
// initialize client and service, use first parameter to specify the node
const { client, service } = initCasperClientAndService(NODE_URL)
```

### Transaction Signer

Utilize the `parseAccountKeys` function to easily load your account.

```typescript
// initialize account, use path to your own private key
const account = parseAccountKeys(KEYS_PATH, Algo.ed25519)
```

### ERC20 token

In the following TypeScript code, we demonstrate approach deploying and initializing a ERC20 token contracts using the `ERC20.deploy` method. Apart from the deployment and initialization, the code also demonstrates how to fetch token metadata. This can include details such as the token name, symbol, token decimal.

```typescript
// deploy token, it will return tokens contract package hash and contract hash
const [erc20ContractPackageHash, erc20ContractHash] = await Erc20.deploy(
  client,
  service,
  Network.Local,
  account,
  '0',
  500n,
  'CoinA',
  'ACOIN',
  12n,
  200000000000n
)

// load token by passing its hash (you can use existing one), it allows you to interact with it
const erc20 = await Erc20.load(client, service, erc20ContractHash)

// interact with token
const accountBalance = await erc20.balanceOf(Key.Account, accountAddress)
console.log(accountBalance)

// fetch token metadata
const tokenName = await erc20.name()
const tokenSymbol = await erc20.symbol()
const tokenDecimals = await erc20.decimals()
console.log(tokenName, tokenSymbol, tokenDecimals)
```

:::tip Output
500n<br />
CoinA ACOIN 12n
:::

### Load DEX and tokens

:::note Deploying and loading erc20 contracts
The deploy function serves as a one-stop solution for deploying ERC20 contracts. When invoked, returns a unique contract address. This address serves as a reference for the deployed contract.
By providing the contract hash returned during deployment, the load function dynamically adds all necessary methods to the specified contract. This dynamic loading capability ensures that the contract is equipped with the essential functionalities defined by the ERC20 standard.
:::

Load the Invariant contract by providing the Casper Client (`client`) and Casper Serice (`service`), and indicating the Invariant contract hash (`INVARIANT_CONTRACT_HASH`). Similarly, initialize the ERC20 token contract using the same approach.

```typescript
// load invariant contract
const invariant = await Invariant.load(client, service, INVARIANT_CONTRACT_HASH)

// load token contract
const erc20 = await Erc20.load(client, service, ERC20_CONTRACT_HASH)
```
