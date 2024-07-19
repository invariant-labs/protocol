---
title: Overview

slug: /alephium/overview
---

This section provides an overview of the structural organization of the Invariant Protocol smart contract project on Alephium. The project is meticulously structured to enhance readability, maintainability, and efficiency. The architecture is designed to handle user interactions in the main contract and perform computations in another, minimizing fees and simplifying interactions, all within the limits imposed by the Alephium blockchain. 

## Contracts Architecture

The runtime structure of Contracts is as follows:

```
📦protocol-alephium
┣ 📜Invariant
┃ ┣ 📜Reserve
┃ ┣ 🗺️poolKeys
┃ ┣ 🗺️pools
┃ ┣ 🗺️ticks
┃ ┣ 🗺️bitmap
┃ ┣ 🗺️positions
┃ ┣ 🗺️positionsCounter
┃ ┗ 🗺️reserves
┃ 📜CLAMM
┃ 📜Utils
┗ 📜Reserve

Legend:
📜 - Contract
🗺️ - mapping
```

### Invariant
To optimize gas usage, we centralize entrypoints in a singular contract. This streamlined approach not only cuts costs but also simplifies processes, enhancing accessibility. By concentrating state changes and entrypoints within this central contract, we reduce the intricacies of managing external contracts, while smart mapping intelligently conserves storage resources and bolsters system efficiency.

### CLAMM
The Concentrated Liquidity Automatic Market Maker (CLAMM) Contract's task is performing computations, it houses all the mathematical formulas related to logarithms, scrutinizingly optimized for our use-case, and other functionality required to perform an efficient swap that minimizes its price.

### Utils
The Utils Contract is never instantiated, it doesn't contain any state and is used in an off-chain fashion. The contract contains functions that aid in calculations. They are an indispensable aid especially when deciding on the inputs to position creation or swap. Our SDK uses them internally.

### Reserve
Reserves are subcontracts of Invariant instantiated at runtime, designed to overcome the limitation of being able to only store up to 8 assets per Contract. Each different token type is considered an asset. An effort has been made so our protocol can scale to an arbitrary number of different tokens while maintaining the same performance. The [Reserves](collections.md#reserves) collection serves as an intermediary for when Invariant interacts with an [Reserve](storage.md#reserve).

The Reserve at the same level as Invariant and CLAMM is a special template that is deployed before the Invariant protocol, and thus not governed by it making it unfit for use as a storage. Its purpose is to serve as a template for Subcontracts, reducing the gas fee associated with their instantiation.

### Mapping
Mappings in itself are not `Contract`s, rather, they deploy and manage new subcontracts that are only simple data entries. Their explanation can be found in the [collections section](collections.md).

## Project Structure

The following presents the project's overall structure, supplying insights into the logical segmentation into modules:

```
📦protocol-alephium
 ┣ 📂contracts
 ┃ ┣ 📂collections
 ┃ ┣ 📂math
 ┃ ┣ 📂scripts
 ┃ ┃ ┗ 📜invariant_tx.ral
 ┃ ┣ 📂storage
 ┃ ┗ 📂token
 ┣ 📂src
 ┗ 📂test
```

### Contracts

Within this directory, we house our contract structures, collections, and associated logic. These components are pivotal in facilitating the seamless operation of our contract. Everything in this directory is written using Alephium's very own [Ralph smart contract programming language](https://docs.alephium.org/ralph/) which influenced our design compared to most other protocol versions written in Rust.

#### Math

The "Math" directory serves as a repository for core mathematical functions, constants, and the custom `U512` data type that is the foundation of executing precise mathematical calculations, ensuring accuracy and reliability in our contract. These mathematical components are indispensable for performing complex calculations in our contract. For an in-depth understanding of the mathematical specifications implemented in our project, please refer to our comprehensive [Math Specification Document](https://invariant.app/math-spec-alph.pdf). This document provides detailed insights into the design choices, algorithms, and methodologies underpinning our mathematical components.

#### Storage

The "Storage" directory houses indispensable data structures crucial for contract storage. These structs are specifically crafted to facilitate the sharing of the state of the exchange within the CLAMM model. Notable examples of these structs include Tick, Pool, and others. These data structures allow for maintaining and organizing information related to the exchange. For example, the "Tick" structure encapsulates details regarding the distribution of liquidity relative to price. The "Position" structure furnishes details about the user's position, such as the price range, size of liquidity, accumulated fees, and more. The "Pool" structure stores real-time information about the pool's status, including the current price (square root of the price), active liquidity, and collected fees. These structures are instantiated as separate contracts via Ralph's [Map](https://docs.alephium.org/ralph/types#map) syntax, enhancing protection against unauthorized changes.

#### Collections

Our "Collections" directory is dedicated to collections of data that leverage Ralph's [Map](https://docs.alephium.org/ralph/types#map) syntax, enhancing protection against unauthorized changes and following Ralph's design principles. These collections help us manage data in a structured manner. Within our collection interface, we enforce a tightly defined set of operations available for all data collections. Each collection is implemented as an [Abstract Contract](https://docs.alephium.org/ralph/contracts#inheritance), ensuring minimal inter-contract communication, which improves security and reduces gas usage.

#### Token

Tokens used in our protocol adhere to the official Alephium's [Fungible Token Standard](https://docs.alephium.org/dapps/standards/fungible-tokens/#fungible-token-standard).
Due to tokens being first world citizens in the Alephium ecosystem, the "Token" directory is solely for our end-to-end tests. It enables us to simulate production-ready token interactions and transactions, with the exchange operating on UTXO model. This detail is essential for implementing transfers in entrypoints and conducting thorough end-to-end tests to validate the protocol.

#### Scripts

The "Scripts" directory contains all entrypoints, including ones used for e2e tests. The most noteworthy is "invariant_tx.ral", the file consolidates all entrypoints of our main contract, streamlining the organization of key functionalities. This modular approach enhances code clarity and accessibility, providing a centralized location for developers to locate and understand the various entrypoints available within the contract.

### Src

The "Src" directory contains the sdk package that can be used to interact with dex and functions suite designed for efficient end-to-end testing. A comprehensive description of the sdk package can be found [here](sdk.md). 
Meanwhile the functions suite simplifies transaction building, allowing developers to focus solely on verifying expected logic during tests. This minimizes code repetition, simplifies the testing interface, and ensures a clear and concise testing environment.

### Test

The "test" directory hosts an extensive suite of tests, and is further split into these subdirectories:

```
📂test
 ┣ 📂contract
 ┃ ┣ 📂e2e
 ┃ ┗ 📂unit
 ┗ 📂sdk
   ┣ 📂e2e
   ┗ 📂unit
```

The split into "contract" and "sdk" subdirectories is motivated by division of responsibility between different levels of abstraction in our protocol.  
In the "contract" directory the tests anticipate even the most malicious behaviors meant to harm our contract, they are meant to validate behaviors in all cases. These tests cover entrypoints for both basic and edge cases, ensuring thorough examination of the protocol's functionality across a spectrum of scenarios. The "sdk" directory contains tests that validate and verify expected behaviors and edge cases pertaining to the usage of our SDK.  
These directories are further split into "e2e" - a suite of end-to-end (e2e) tests that pertain to entry points users can directly interact with in a meaningful way, and "unit" - tests that focus on individual building blocks of the software, ensuring that each component functions correctly in isolation and indirectly supports user interactions.

### Source Code Access

For a detailed exploration of our contract structures, collections, and associated logic, please refer to the corresponding [Source Code Repository](https://github.com/invariant-labs/protocol-alephium). This repository contains the complete and up-to-date implementation of our contract architecture. Here lies the comprehensive project structure, which can be represented as follows.


```
📦protocol-alephium
 ┣ 📂alephium-stack
 ┣ 📂contracts
 ┃ ┣ 📂collections
 ┃ ┣ ┣ 📜pool_keys.ral
 ┃ ┣ ┣ 📜pools.ral
 ┃ ┣ ┣ 📜positions.ral
 ┃ ┣ ┣ 📜reserves.ral
 ┃ ┣ ┣ 📜tickmap.ral
 ┃ ┣ ┗ 📜ticks.ral
 ┃ ┣ 📂math
 ┃ ┣ ┣ 📜clamm.ral
 ┃ ┣ ┣ 📜decimal.ral
 ┃ ┣ ┣ 📜log.ral
 ┃ ┣ ┣ 📜uints.ral
 ┃ ┣ ┗ 📜utils.ral
 ┃ ┣ 📂scripts
 ┃ ┣ ┣ 📜invariant_tx.ral
 ┃ ┣ ┣ 📜reserve_tx.ral
 ┃ ┃ ┗ 📜token_tx.ral
 ┃ ┣ 📂storage
 ┃ ┣ ┣ 📜batch.ral
 ┃ ┣ ┣ 📜fee_tier.ral
 ┃ ┣ ┣ 📜pool_key.ral
 ┃ ┣ ┣ 📜pool.ral
 ┃ ┣ ┣ 📜position.ral
 ┃ ┣ ┣ 📜reserve.ral
 ┃ ┣ ┗ 📜tick.ral
 ┃ ┣ 📂token
 ┃ ┣ ┗ 📜token.ral
 ┃ ┗ 📜invariant.ral
 ┣ 📂src
 ┃ ┣ 📜consts.ts
 ┃ ┣ 📜fungible-token.ts
 ┃ ┣ 📜index.ts
 ┃ ┣ 📜invariant.ts
 ┃ ┣ 📜math.ts
 ┃ ┣ 📜network.ts
 ┃ ┣ 📜snippets.ts
 ┃ ┣ 📜testUtils.ts
 ┃ ┗ 📜utils.ts
 ┗ 📂test
   ┣ 📂contract
   ┃ ┣ 📂e2e
   ┃ ┃ ┣ 📜add-fee-tier.test.ts
   ┃ ┃ ┣ 📜change-fee-receiver.test.ts
   ┃ ┃ ┣ 📜change-protocol-fee.test.ts
   ┃ ┃ ┣ 📜claim.test.ts
   ┃ ┃ ┣ 📜create-pool.test.ts
   ┃ ┃ ┣ 📜cross-both-side.test.ts
   ┃ ┃ ┣ 📜cross.test.ts
   ┃ ┃ ┣ 📜interaction-with-pool-on-removed-fee-tier.test.ts
   ┃ ┃ ┣ 📜limits.test.ts
   ┃ ┃ ┣ 📜liquidity-gap.test.ts
   ┃ ┃ ┣ 📜max-tick-cross.test.ts
   ┃ ┃ ┣ 📜multiple-swap.test.ts
   ┃ ┃ ┣ 📜position-list.test.ts
   ┃ ┃ ┣ 📜position-slippage.test.ts
   ┃ ┃ ┣ 📜position.test.ts
   ┃ ┃ ┣ 📜protocol-fee.test.ts
   ┃ ┃ ┣ 📜remove-fee-tier.test.ts
   ┃ ┃ ┣ 📜reserves.test.ts
   ┃ ┃ ┣ 📜slippage.test.ts
   ┃ ┃ ┗ 📜swap.test.ts
   ┃ ┗ 📂unit
   ┃   ┣ 📜clamm.test.ts
   ┃   ┣ 📜log.test.ts
   ┃   ┣ 📜reserve.test.ts
   ┃   ┣ 📜tickmap.test.ts
   ┃   ┣ 📜token.test.ts
   ┃   ┗ 📜uints.test.ts
   ┗ 📂sdk
     ┣ 📂e2e
     ┃ ┣ 📜fungible-token.test.ts
     ┃ ┣ 📜get-tickmap.test.ts
     ┃ ┣ 📜invariant.test.ts
     ┃ ┣ 📜pool-with-alph.test.ts
     ┃ ┗ 📜query-on-pair.test.ts
     ┗ 📂unit
       ┗ 📜math.test.ts
```
