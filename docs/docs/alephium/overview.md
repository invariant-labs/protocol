---
title: Overview

slug: /alephium/overview
---

This section provides an overview of the structural organization of the Invariant Protocol smart contract project on Alephium. The project is meticulously structured to enhance readability, maintainability, and efficiency. The architecture is designed to consolidate data within a single contract where possible, minimizing fees and simplifying interactions.

## Contract Architecture

To optimize gas usage, we centralize entrypoints in a singular contract. This streamlined approach not only cuts costs but also simplifies processes, enhancing accessibility. By concentrating state changes and entrypoints within this central contract, we reduce the intricacies of managing external contracts, while smart mapping intelligently conserves storage resources and bolsters system efficiency.

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
 ┣ 📂test
 ┗ 📜tests.sh
```

### Contracts

Within this directory, we house our contract structures, collections, and associated logic. These components are pivotal in facilitating the seamless operation of our contract. Everything in this directory is written using Alephium's very own [Ralph smart contract programming language](https://docs.alephium.org/ralph/) which influenced our design compared to most other protocol versions written in Rust.

#### Math

The "Math" directory serves as a repository for core mathematical functions, constants, and the custom `U512` data type that is the foundation of executing precise mathematical calculations, ensuring accuracy and reliability in our contract. These mathematical components are indispensable for performing complex calculations in our contract. For an in-depth understanding of the mathematical specifications implemented in our project, please refer to our comprehensive [Math Specification Document](https://invariant.app/math-spec-alph.pdf). This document provides detailed insights into the design choices, algorithms, and methodologies underpinning our mathematical components.

#### Storage

The "Storage" directory houses indispensable data structures crucial for contract storage. These structs are specifically crafted to facilitate the sharing of the state of the exchange within the CLAMM model. Notable examples of these structs include Tick, Pool, and others. These data structures allow for maintaining and organizing information related to the exchange. For example, the "Tick" structure encapsulates details regarding the distribution of liquidity relative to price. The "Position" structure furnishes details about the user's position, such as the price range, size of liquidity, accumulated fees, and more. The "Pool" structure stores real-time information about the pool's status, including the current price (square root of the price), active liquidity, and collected fees. These structures are instantiated as separate contracts via Ralph's [Map](https://docs.alephium.org/ralph/types#map) syntax, enhancing protection against unauthorized changes.

#### Collections

Our "Collections" directory is dedicated to collections of data that leverage Ralph's [Map](https://docs.alephium.org/ralph/types#map) syntax, enhancing protection against unauthorized changes and following Ralph's design principles. These collections help us manage data in a structured manner. Within our collection interface, we enforce a tightly defined set of operations available for all data collections. Each collection is implemented as an [Abstract Contract](https://docs.alephium.org/ralph/contracts#inheritance), ensuring minimal inter-contract communication, which improves security and reduces gas prices.

#### Token

The "Token" directory is solely for our end-to-end tests. It enables us to simulate production-ready token interactions and transactions, with the exchange operating on UTXO model. This detail is essential for implementing transfers in entrypoints and conducting thorough end-to-end tests to validate the protocol.

#### Scripts

The "Scripts" directory contains all entrypoints, including ones used for e2e tests. The most noteworthy is "invariant_tx.ral", the file consolidates all entrypoints of our main contract, streamlining the organization of key functionalities. This modular approach enhances code clarity and accessibility, providing a centralized location for developers to locate and understand the various entrypoints available within the contract.

### Src

The "Src" directory contains macros designed for efficient end-to-end testing. These macros abstract low-level calls and transaction building, allowing developers to focus solely on verifying expected logic during tests. This minimizes code repetition, simplifies the testing interface, and ensures a clear and concise testing environment.

### Test

The "test" subfolder in our repository hosts an extensive suite of end-to-end (e2e) tests meticulously designed to validate and verify expected behaviors within our protocol. These tests cover entrypoints for both basic and edge cases, ensuring thorough examination of the protocol's functionality across a spectrum of scenarios.

### Tests.sh
The "tests" file initiates the development network and executes all tests with a single bash command.

### Source Code Access

For a detailed exploration of our contract structures, collections, and associated logic, please refer to the corresponding [Source Code Repository](https://github.com/invariant-labs/protocol-alephium). This repository contains the complete and up-to-date implementation of our contract architecture. Here lies the comprehensive project structure, which can be represented as follows.


```
📦protocol-alephium
 ┣ 📂alephium-stack
 ┣ 📂contracts
 ┃ ┣ 📂collections
 ┃ ┣ ┣ 📜fee_tiers.ral
 ┃ ┣ ┣ 📜pool_keys.ral
 ┃ ┣ ┣ 📜pools.ral
 ┃ ┣ ┣ 📜positions.ral
 ┃ ┣ ┣ 📜reserves.ral
 ┃ ┣ ┣ 📜tickmap.ral
 ┃ ┣ ┗ 📜ticks.ral
 ┃ ┣ 📂math
 ┃ ┣ ┣ 📜clam.ral
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
 ┃ ┣ ┣ 📜pool.ral
 ┃ ┣ ┣ 📜pool_key.ral
 ┃ ┣ ┣ 📜position.ral
 ┃ ┣ ┣ 📜reserve.ral
 ┃ ┣ ┗ 📜tick.ral
 ┃ ┣ 📂token
 ┃ ┣ ┗ token.ral
 ┃ ┗ 📜invariant.ral
 ┣ 📂src
 ┃ ┣ 📜consts.ts
 ┃ ┣ 📜index.ts
 ┃ ┣ 📜math.ts
 ┃ ┣ 📜snippets.ts
 ┃ ┣ 📜testUtils.ts
 ┃ ┗ 📜utils.ts
 ┣ 📂test
 ┃ ┣ 📜add_fee_tier.test.ts
 ┃ ┣ 📜change_fee_receiver.test.ts
 ┃ ┣ 📜change_protocol_fee.test.ts
 ┃ ┣ 📜claim.test.ts
 ┃ ┣ 📜clamm.test.ts
 ┃ ┣ 📜create_pool.test.ts
 ┃ ┣ 📜cross_both_side.test.ts
 ┃ ┣ 📜cross.test.ts
 ┃ ┣ 📜interaction_with_pool_on_removed_fee_tier.test.ts
 ┃ ┣ 📜limits.test.ts
 ┃ ┣ 📜liquidity_gap.test.ts
 ┃ ┣ 📜log.test.ts
 ┃ ┣ 📜math.test.ts
 ┃ ┣ 📜max_tick_cross.test.ts
 ┃ ┣ 📜multiple_swap.test.ts
 ┃ ┣ 📜position_list.test.ts
 ┃ ┣ 📜position_slippage.test.ts
 ┃ ┣ 📜position.test.ts
 ┃ ┣ 📜protocol_fee.test.ts
 ┃ ┣ 📜remove_fee_tier.test.ts
 ┃ ┣ 📜reserve.test.ts
 ┃ ┣ 📜reserves.test.ts
 ┃ ┣ 📜slippage.test.ts
 ┃ ┣ 📜swap.test.ts
 ┃ ┣ 📜tickmap.test.ts
 ┃ ┣ 📜token.test.ts
 ┃ ┗ 📜uints.test.ts
 ┗ 📜tests.sh
```
