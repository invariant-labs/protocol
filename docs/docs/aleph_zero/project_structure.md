---
title: Project Structure

slug: /aleph_zero/project_structure
---

```
📦protocol-a0
 ┣ 📂contracts
 ┃ ┣ 📜storage
 ┃ ┗ 📜collections
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
The "Math" directory serves as a repository for core mathematical functions, constants, and custom data types that are meticulously crafted using the Decimal library. These mathematical components are indispensable for performing complex calculations in our contract.

### Test Helpers
Our "Test Helpers" directory is equipped with macros designed to streamline end-to-end testing processes. These macros are instrumental in simplifying and enhancing the efficiency of our testing procedures, ensuring the robustness of our contract.

### Token
The "Token" directory is dedicated to the implementation of a fundamental PSP22 token. This token serves as a foundational element in our end-to-end tests, enabling us to simulate real-world token interactions and transactions.

### Traceable Result
In the "Traceable Result" directory, you will find a comprehensive library comprising data structures used in debugging processes. In the event of an error, this library generates a detailed stack trace, providing valuable insights that aid in the identification and resolution of issues, thereby promoting the reliability and stability of our contract.
