---
title: Overview

slug: /aleph_zero/project_structure
---

This section provides an overview of the structural organization of the Invariant protocol smart contract project on Aleph Zero. The project is meticulously structured to enhance readability, maintainability, and efficiency. The architecture is designed to consolidate data within a single contract, minimizing fees and simplifying interactions.

## Contract Architecture

To optimize gas usage, we centralize data and entrypoints in a singular contract, reducing expenses associated with pool and position creation. This streamlined approach not only cuts costs but also simplifies processes, enhancing accessibility. By concentrating state changes and entrypoints within this central contract, we eliminate the intricacies of managing external contracts, while smart mapping intelligently conserves storage resources and bolsters system efficiency.

## Project structure

The following presents the project's overall structure, supplying insights into the logical segmentation into modules/

```
📦protocol-a0
 ┣ 📂contracts
 ┃ ┣ 📂collections
 ┃ ┣ 📂logic
 ┃ ┣ 📂storage
 | ┗ 📜entrypoints.rs
 ┣ 📂decimal
 ┣ 📂math
 ┣ 📂test_helpers
 ┣ 📂tests
 ┣ 📂token
 ┗ 📂traceable_result
```

### Contracts

Within this directory, we house our contract structures, collections, and associated logic. These components are pivotal in facilitating the seamless operation of our contract.

#### Collections

Our "Collections" directory is dedicated to collections of data that leverage structs with mappings or vectors. These collections play a crucial role in organizing and managing data in a structured manner, enhancing the overall functionality and performance of our contract.

#### Logic

The "Logic" folder hosts a suite of specialized mathematical computations crucial for managing the relationship between tokens and liquidity.

#### Storage

The "Storage" directory is home to the essential data structures utilized for contract storage. These structures are instrumental in securely and efficiently storing critical information within our contract.

### [Decimal](https://github.com/invariant-labs/decimal)

Contained within the "Decimal" directory is a specialized decimal library. This library serves as the foundation for creating custom data types and executing precise mathematical calculations, ensuring accuracy and reliability in our contract.

### Math

The "Math" directory serves as a repository for core mathematical functions, constants, and custom data types that are meticulously crafted using the Decimal library. These mathematical components are indispensable for performing complex calculations in our contract. For an in-depth understanding of the mathematical specifications implemented in our project, please refer to our comprehensive [Math Specification Document](https://invariant.app/math-spec-a0.pdf). This document provides detailed insights into the design choices, algorithms, and methodologies underpinning our mathematical components.

### Test Helpers

Our "Test Helpers" directory is equipped with macros designed to streamline end-to-end testing processes. These macros are instrumental in simplifying and enhancing the efficiency of our testing procedures, ensuring the robustness of our contract.

### Tests

Within the "Tests" subfolder of our repository, you'll find a comprehensive collection of end-to-end (e2e) tests meticulously crafted to validate and verify the expected behaviors of our protocol. These tests play a pivotal role in ensuring the reliability and robustness of our system.

### Token

The "Token" directory is dedicated to the implementation of a fundamental PSP22 token. This token serves as a foundational element in our end-to-end tests, enabling us to simulate production-ready token interactions and transactions.

### Traceable Result

In the "Traceable Result" directory, you will find a comprehensive library comprising data structures used in debugging processes. In the event of an error, this library generates a detailed stack trace, providing valuable insights that aid in the identification and resolution of issues, thereby promoting the reliability and stability of our contract.

### Source Code Access

For a detailed exploration of our contract structures, collections, and associated logic, please refer to the corresponding [Source Code Repository](https://github.com/invariant-labs/protocol-a0). This repository contains the complete and up-to-date implementation of our contract architecture. Here lies the comprehensive project structure, which can be represented as follows.

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
┃ 📂tests
┃ ┣ 📜add_fee_tier.rs
┃ ┣ 📜change_fee_receiver.rs
┃ ┣ 📜change_protocol_fee.rs
┃ ┣ 📜claim.rs
┃ ┣ 📜constructor.rs
┃ ┣ 📜create_pool.rs
┃ ┣ 📜cross_both_side.rs
┃ ┣ 📜cross.rs
┃ ┣ 📜limits.rs
┃ ┣ 📜liquidity_gap.rs
┃ ┣ 📜max_tick_cross.rs
┃ ┣ 📜multiple_swap.rs
┃ ┣ 📜position_list.rs
┃ ┣ 📜position_slippage.rs
┃ ┣ 📜position.rs
┃ ┣ 📜protocol_fee.rs
┃ ┣ 📜remove_fee_tier.rs
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
