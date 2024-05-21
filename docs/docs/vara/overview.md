---
title: Overview

slug: /vara/overview
---

This section provides an overview of the structural organization of the Invariant Protocol program project on Vara. The project is meticulously structured to enhance readability, maintainability, and efficiency. The architecture is designed to consolidate data within a single program, minimizing fees and simplifying interactions.

## Contract Architecture

To optimize gas usage, we centralize data and entrypoints in a singular program, reducing expenses associated with pool and position creation. This streamlined approach not only cuts costs but also simplifies processes, enhancing accessibility. By concentrating state changes and entrypoints within this central program, we eliminate the intricacies of managing external programs, while smart mapping intelligently conserves storage resources and bolsters system efficiency. Gas checks are used within entrypoints, that work with GRC-20 token, to ensure that the state remains consistent and tokens are not lost in the process.

## Project Structure

The following presents the project's overall structure, supplying insights into the logical segmentation into modules:

```
📦protocol-vara
 ┣ 📂src
 ┃ ┣ 📂contracts
 ┃ ┃ ┣ 📂collections
 ┃ ┃ ┣ 📂logic
 ┃ ┃ ┣ 📂storage
 ┃ ┣ 📂e2e
 ┃ ┣ 📂test_helpers
 ┃ ┣ 📜lib.rs
 ┣ 📂calc
 ┃ ┣ 📂decimal
 ┃ ┣ 📂math
 ┃ ┣ 📂traceable_result
 ┣ 📂io
 ┣ 📂state
 ┣ 📂fungible-token
 ┗ 📂xtask
```

### Contracts

Within this directory, we house our contract structures, collections, and associated logic. These components are pivotal in facilitating the seamless operation of our program.

#### Storage

The "Storage" directory houses indispensable data structures crucial for program storage. These structs are specifically crafted to facilitate the sharing of the state of the exchange within the CLAMM model. Notable examples of these structs include Tick, Pool, and others. These data structures allow for maintaining and organizing information related to the exchange. For example, the "Tick" structure encapsulates details regarding the distribution of liquidity relative to price. The "Position" structure furnishes details about the user's position, such as the price range, size of liquidity, accumulated fees, and more. The "Pool" structure provides real-time information about the pool's status, including the current price (square root of the price), active liquidity, and collected fees.

#### Collections

Our "Collections" directory is dedicated to collections of data that leverage structs with mappings or vectors. These collections helps us manage data in a structured manner. Within our collection interface, we enforce a tightly defined set of operations available for all data collections. Each collection implements the same basic methods, allowing for consistent data management regardless of the underlying data structures (vectors or mappings).

#### Logic

The "Logic" folder hosts a suite of mathematical calculations which are primarily designed for conducting test calculations and supporting our SDK. It is noteworthy that optimization efforts for these calculations need not be exhaustive, as they are intended for off-chain use and will not be executed on the blockchain.

### Test Helpers

The "Test Helpers" directory contains macros designed for efficient end-to-end testing. These macros abstract low-level calls and transaction building, allowing developers to focus solely on verifying expected logic during tests. This minimizes code repetition, simplifies the testing interface, and ensures a clear and concise testing environment.

### e2e

The "e2e" subfolder in our repository hosts an extensive suite of end-to-end (e2e) tests meticulously designed to validate and verify expected behaviors within our protocol. These tests cover entrypoints for both basic and edge cases, ensuring thorough examination of the protocol's functionality across a spectrum of scenarios.

### Calc
The "Calc" directory contains packages vital to low level calculations performed within the contract.

#### Decimal

Contained within the "Decimal" directory is a specialized decimal library. This library serves as the foundation for creating custom data types and executing precise mathematical calculations, ensuring accuracy and reliability in our contract. [Decimal](https://github.com/invariant-labs/decimal) is also an open-source project.

#### Math

The "Math" directory serves as a repository for core mathematical functions, constants, and custom data types that are meticulously crafted using the Decimal library. These mathematical components are indispensable for performing complex calculations in our contract. This directory includes crucial types like Liquidity and SqrtPrice. For an in-depth understanding of the mathematical specifications implemented in our project, please refer to our comprehensive [Math Specification Document](https://invariant.app/math-spec-a0.pdf). This document provides detailed insights into the design choices, algorithms, and methodologies underpinning our mathematical components.

#### Traceable Result

In the "Traceable Result" directory, you will find a comprehensive library comprising data structures used in debugging processes. In the event of an error, this library generates a detailed stack trace, providing valuable insights that aid in the identification and resolution of issues, thereby promoting the reliability and stability of our contract.

### IO

All structures necessary for communication with the program are stored within "IO" directory. 

### State

"State" folder's purpose is to allow for creation of new meta functions to extend existing state queries by defining new filers. 

### Fungible Token

The "Fungible Token" directory is solely for the implementation of a basic [GRC-20 token](https://wiki.gear-tech.io/docs/developing-programs/standards/grc20), serving as a key element in our end-to-end tests. It enables us to simulate production-ready token interactions and transactions, with the exchange operating specifically on GRC-20 tokens. This detail is essential for implementing transfers in entrypoints and conducting thorough end-to-end tests to validate the protocol.

### Xtask

Folder contains utility tool for downloading newest gear node binary for `gclient` tests.
### Source Code Access

For a detailed exploration of our program structures, collections, and associated logic, please refer to the corresponding [Source Code Repository](https://github.com/invariant-labs/protocol-vara). This repository contains the complete and up-to-date implementation of our program architecture. Here lies the comprehensive project structure, which can be represented as follows.

### Lib

The "src/lib.rs" file comprises all entrypoints, storage, and high level program logic, serving as the heart of our protocol's functionality.

```
📦protocol-vara
┣ 📂src
┗ ┣ 📂test_helpers
  ┃ ┣ 📜mod.rs
  ┃ ┣ 📂snippets
  ┃ ┣ 📂token
  ┃ ┗ 📂entrypoints
  ┣ 📂contracts
  ┃ ┣ 📂collections
  ┃ ┃ ┣ 📜fee_tiers.rs
  ┃ ┃ ┣ 📜pools.rs
  ┃ ┃ ┣ 📜positions.rs
  ┃ ┃ ┣ 📜pool_keys.rs
  ┃ ┃ ┣ 📜tickmap.rs
  ┃ ┃ ┗ 📜ticks.rs
  ┃ ┣ 📂logic
  ┃ ┃ ┣ 📜liquidity_result.rs
  ┃ ┃ ┗ 📜mod.rs
  ┃ ┗ 📂storage
  ┃   ┣ 📜fee_tier.rs
  ┃   ┣ 📜pool_key.rs
  ┃   ┣ 📜pool.rs
  ┃   ┣ 📜position.rs
  ┃   ┣ 📜state.rs
  ┃   ┗ 📜tick.rs
  ┗ 📂e2e
    ┗ 📂gtest
      ┣ 📜add_fee_tier.rs
      ┣ 📜change_fee_receiver.rs
      ┣ 📜change_protocol_fee.rs
      ┣ 📜claim.rs
      ┣ 📜create_pool.rs
      ┣ 📜cross_both_sides.rs
      ┣ 📜cross.rs
      ┣ 📜get_pool.rs
      ┣ 📜get_pools.rs
      ┣ 📜init.rs
      ┣ 📜interaction_with_pool_on_remove_fee_tier.rs
      ┣ 📜limits.rs
      ┣ 📜liquidity_gap.rs
      ┣ 📜max_tick_cross.rs
      ┣ 📜multiple_swap.rs
      ┣ 📜position_list.rs
      ┣ 📜position_slippage.rs
      ┣ 📜position.rs
      ┣ 📜protocol_fee.rs
      ┣ 📜remove_fee_tier.rs
      ┣ 📜slippage.rs
      ┣ 📜swap_route.rs
      ┗ 📜swap.rs

```
