---
title: Overview

slug: /aleph_zero/overview
---

This section provides an overview of the structural organization of the Invariant Protocol smart contract project on Aleph Zero. The project is meticulously structured to enhance readability, maintainability, and efficiency. The architecture is designed to consolidate data within a single contract, minimizing fees and simplifying interactions.

## Contract Architecture

To optimize gas usage, we centralize data and entrypoints in a singular contract, reducing expenses associated with pool and position creation. This streamlined approach not only cuts costs but also simplifies processes, enhancing accessibility. By concentrating state changes and entrypoints within this central contract, we eliminate the intricacies of managing external contracts, while smart mapping intelligently conserves storage resources and bolsters system efficiency.

## Project Structure

The following presents the project's overall structure, supplying insights into the logical segmentation into modules:

```
📦protocol-a0
 ┣ 📂contracts
 ┃ ┣ 📂collections
 ┃ ┣ 📂logic
 ┃ ┣ 📂storage
 ┃ ┗ 📜entrypoints.rs
 ┣ 📂decimal
 ┣ 📂math
 ┣ 📂test_helpers
 ┣ 📂e2e
 ┣ 📂token
 ┣ 📂traceable_result
 ┗ 📜lib.rs
```

### Decimal

Contained within the "Decimal" directory is a specialized decimal library. This library serves as the foundation for creating custom data types and executing precise mathematical calculations, ensuring accuracy and reliability in our contract. [Decimal](https://github.com/invariant-labs/decimal) is also an open-source project.

### Math

The "Math" directory serves as a repository for core mathematical functions, constants, and custom data types that are meticulously crafted using the Decimal library. These mathematical components are indispensable for performing complex calculations in our contract. This directory includes crucial types like Liquidity and SqrtPrice. For an in-depth understanding of the mathematical specifications implemented in our project, please refer to our comprehensive [Math Specification Document](https://invariant.app/math-spec-a0.pdf). This document provides detailed insights into the design choices, algorithms, and methodologies underpinning our mathematical components.

### Contracts

Within this directory, we house our contract structures, collections, and associated logic. These components are pivotal in facilitating the seamless operation of our contract.

#### Storage

The "Storage" directory houses indispensable data structures crucial for contract storage. These structs are specifically crafted to facilitate the sharing of the state of the exchange within the CLAMM model. Notable examples of these structs include Tick, Pool, and others. These data structures allow for maintaining and organizing information related to the exchange. For example, the "Tick" structure encapsulates details regarding the distribution of liquidity relative to price. The "Position" structure furnishes details about the user's position, such as the price range, size of liquidity, accumulated fees, and more. The "Pool" structure provides real-time information about the pool's status, including the current price (square root of the price), active liquidity, and collected fees.

#### Collections

Our "Collections" directory is dedicated to collections of data that leverage structs with mappings or vectors. These collections helps us manage data in a structured manner. Within our collection interface, we enforce a tightly defined set of operations available for all data collections. Each collection implements the same basic methods, allowing for consistent data management regardless of the underlying data structures (vectors or mappings).

#### Logic

The "Logic" folder hosts a suite of mathematical calculations which are primarily designed for conducting test calculations and supporting our SDK. It is noteworthy that optimization efforts for these calculations need not be exhaustive, as they are intended for off-chain use and will not be executed on the blockchain.

#### Entrypoints

An "Entrypoint" file consolidates all contract entrypoints within a single trait, streamlining the organization of key functionalities. This modular approach enhances code clarity and accessibility, providing a centralized location for developers to locate and understand the various entrypoints available within the contract.

### Test Helpers

The "Test Helpers" directory contains macros designed for efficient end-to-end testing. These macros abstract low-level calls and transaction building, allowing developers to focus solely on verifying expected logic during tests. This minimizes code repetition, simplifies the testing interface, and ensures a clear and concise testing environment.

### e2e

The "e2e" subfolder in our repository hosts an extensive suite of end-to-end (e2e) tests meticulously designed to validate and verify expected behaviors within our protocol. These tests cover entrypoints for both basic and edge cases, ensuring thorough examination of the protocol's functionality across a spectrum of scenarios.

### Token

The "Token" directory is solely for the implementation of a basic [PSP22 token](https://github.com/Cardinal-Cryptography/PSP22), serving as a key element in our end-to-end tests. It enables us to simulate production-ready token interactions and transactions, with the exchange operating specifically on PSP22 tokens. This detail is essential for implementing transfers in entrypoints and conducting thorough end-to-end tests to validate the protocol.

### Traceable Result

In the "Traceable Result" directory, you will find a comprehensive library comprising data structures used in debugging processes. In the event of an error, this library generates a detailed stack trace, providing valuable insights that aid in the identification and resolution of issues, thereby promoting the reliability and stability of our contract.

### Source Code Access

For a detailed exploration of our contract structures, collections, and associated logic, please refer to the corresponding [Source Code Repository](https://github.com/invariant-labs/protocol-a0). This repository contains the complete and up-to-date implementation of our contract architecture. Here lies the comprehensive project structure, which can be represented as follows.

### Lib

The "Lib" file comprises all entrypoints, storage, and essential logic, serving as the heart of our protocol's functionality.

```
📦protocol-a0
┣ 📂contracts
┃ ┣ 📂collections
┃ ┃ ┣ 📜fee_tiers.rs
┃ ┃ ┣ 📜pools.rs
┃ ┃ ┣ 📜positions.rs
┃ ┃ ┣ 📜pool_keys.rs
┃ ┃ ┗ 📜ticks.rs
┃ ┣ 📂logic
┃ ┃ ┗ 📜math.rs
┃ ┣ 📂storage
┃ ┃ ┣ 📜fee_tier.rs
┃ ┃ ┣ 📜pool_key.rs
┃ ┃ ┣ 📜pool.rs
┃ ┃ ┣ 📜position.rs
┃ ┃ ┣ 📜state.rs
┃ ┃ ┣ 📜tick.rs
┃ ┃ ┗ 📜tickmap.rs
┃ ┗ 📜entrypoints.rs
┣ 📂decimal
┣ 📂math
┃ ┣ 📂types
┃ ┃ ┣ 📜sqrt_price.rs
┃ ┃ ┣ 📜fee_growth.rs
┃ ┃ ┣ 📜fixed_point.rs
┃ ┃ ┣ 📜liquidity.rs
┃ ┃ ┣ 📜percentage.rs
┃ ┃ ┣ 📜seconds_per_liquidity.rs
┃ ┃ ┗ 📜token_amount.rs
┃ ┣ 📜consts.rs
┃ ┣ 📜log.rs
┃ ┗ 📜clamm.rs
┃ 📂test_helpers
┃ ┣ 📜lib.rs
┃ ┣ 📜snippets.rs
┃ ┣ 📜token.rs
┃ ┗ 📜entrypoints.rs
┃ 📂e2e
┃ ┣ 📜add_fee_tier.rs
┃ ┣ 📜change_admin.rs
┃ ┣ 📜change_fee_receiver.rs
┃ ┣ 📜change_liquidity.rs
┃ ┣ 📜change_protocol_fee.rs
┃ ┣ 📜claim.rs
┃ ┣ 📜constructor.rs
┃ ┣ 📜create_pool.rs
┃ ┣ 📜cross_both_side.rs
┃ ┣ 📜cross.rs
┃ ┣ 📜get_tickmap.rs
┃ ┣ 📜get_positions.rs
┃ ┣ 📜get_position_with_associates.rs
┃ ┣ 📜interaction_with_pool_on_removed_fee_tier.rs
┃ ┣ 📜limits.rs
┃ ┣ 📜liquidity_gap.rs
┃ ┣ 📜max_tick_cross.rs
┃ ┣ 📜multiple_swap.rs
┃ ┣ 📜position_list.rs
┃ ┣ 📜position.rs
┃ ┣ 📜position_slippage.rs
┃ ┣ 📜protocol_fee.rs
┃ ┣ 📜remove_fee_tier.rs
┃ ┣ 📜set_code.rs
┃ ┣ 📜slippage.rs
┃ ┣ 📜swap_route.rs
┃ ┗ 📜swap.rs
┣ 📂token
┃ ┣ 📜data.rs
┃ ┣ 📜errors.rs
┃ ┣ 📜lib.rs
┃ ┣ 📜testing.rs
┃ ┗ 📜traits.rs
┣ 📂traceable_result
┃ ┗ 📜lib.rs
┗ 📜lib.rs
```
