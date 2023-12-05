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
 | ┗ 📜entrypoints
 ┣ 📂e2e
 ┣ 📂decimal
 ┣ 📂math
 ┣ 📂test_helpers
 ┣ 📂token
 ┗ 📂traceable_result
```

### Contracts
Within this directory, we house our contract structures, collections, and associated logic. These components are pivotal in facilitating the seamless operation of our contract.

#### Storage
The "Storage" directory is home to the essential data structures utilized for contract storage. These structures are instrumental in securely and efficiently storing critical information within our contract.

#### Collections
Our "Collections" directory is dedicated to collections of data that leverage structs with mappings or vectors. These collections play a crucial role in organizing and managing data in a structured manner, enhancing the overall functionality and performance of our contract.

### Decimal
Contained within the "Decimal" directory is a specialized decimal library. This library serves as the foundation for creating custom data types and executing precise mathematical calculations, ensuring accuracy and reliability in our contract.

### Math
The "Math" directory serves as a repository for core mathematical functions, constants, and custom data types that are meticulously crafted using the Decimal library. These mathematical components are indispensable for performing complex calculations in our contract. For an in-depth understanding of the mathematical specifications implemented in our project, please refer to our comprehensive [Math Specification Document](https://invariant.app/math-spec-a0.pdf). This document provides detailed insights into the design choices, algorithms, and methodologies underpinning our mathematical components.
### Test Helpers
Our "Test Helpers" directory is equipped with macros designed to streamline end-to-end testing processes. These macros are instrumental in simplifying and enhancing the efficiency of our testing procedures, ensuring the robustness of our contract.

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
 ┃ ┃ ┣ 📜fee_tiers
 ┃ ┃ ┣ 📜pools
 ┃ ┃ ┣ 📜positions
 ┃ ┃ ┣ 📜pool_keys
 ┃ ┃ ┗ 📜ticks
 ┃ ┣ 📂logic
 ┃ ┃ ┗ 📜math
 ┃ ┣ 📂storage
 ┃ ┃ ┣ 📜fee_tier
 ┃ ┃ ┣ 📜pool_key
 ┃ ┃ ┣ 📜pool
 ┃ ┃ ┣ 📜position
 ┃ ┃ ┣ 📜state
 ┃ ┃ ┣ 📜tick
 ┃ ┃ ┗ 📜tickmap
 ┃ ┗ 📜entrypoints
 ┣ 📂decimal
 ┣ 📂math
 ┃ ┣ 📂types
 ┃ ┃ ┣ 📜sqrt_price
 ┃ ┃ ┣ 📜fee_growth
 ┃ ┃ ┣ 📜fixed_point
 ┃ ┃ ┣ 📜liquidity
 ┃ ┃ ┣ 📜percentage
 ┃ ┃ ┣ 📜seconds_per_liquidity
 ┃ ┃ ┗ 📜token_amount
 ┃ ┣ 📜consts
 ┃ ┣ 📜log
 ┃ ┗ 📜clamm
 ┃ 📂test_helpers
 ┃ ┣ 📜lib
 ┃ ┣ 📜snippets
 ┃ ┣ 📜token
 ┃ ┗ 📜entrypoints
 ┣ 📂token
 ┃ ┣ 📜data
 ┃ ┣ 📜errors
 ┃ ┣ 📜lib
 ┃ ┣ 📜testing
 ┃ ┗ 📜traits
 ┣ 📂traceable_result
 ┃ ┗ 📜lib
 ┗ 📜lib
```