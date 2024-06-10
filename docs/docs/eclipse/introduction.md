---
title: Invariant SDK

slug: /eclipse/introduction
---

**Invariant** consists of two main parts: smart contract and SDK. Both of them are in a single public repository on our [Github](https://github.com/invariant-labs).
Most methods and data structures have their equivalent in both of them.

- [Rust Program](https://github.com/invariant-labs/protocol/tree/master/programs/invariant/src)
- [Typescript SDK](https://github.com/invariant-labs/protocol/tree/master/sdk/src)

**SDK** is written in Typescript as an [npm package](https://www.npmjs.com/package/@invariant-labs/sdk-eclipse) and is a wrapper for the smart contract. It takes care of low-level aspects, such as signing transactions and storing constant addresses, making writing client code easier.

We use the following naming standard for our functions:

For the `fnName` function:

- `fnName()` sending tx, require KeyPair to sign,
- `fnNameIx()`, `fnNameInstruction()` - return instruction,
- `fnNameTx()`, `fnNameTransaction()` - return transaction.
