---
title: Handling CSPR

slug: /casper/handling_cspr
---

## What is WCSPR?

Wrapped coins and tokens virtually have the same value as their underlying assets. Therefore, [WCSPR](https://github.com/odradev/odra/blob/release/0.7.1/modules/src/wrapped_native.rs) is the ERC-20 compatible and tradable version of CSPR and can be used to interact with other CSPR assets.

## How to create pool to WCSPR?

The Invariant Protocol enables token exchanges within the ERC-20 token standard. To ensure compatibility with this interface, an additional action is required for the CSPR native cryptocurrency. Before depositing a token into a pool or a swap where the input token is CSPR, you must first wrap CSPR using the [WCSPR](https://github.com/odradev/odra/blob/release/0.7.1/modules/src/wrapped_native.rs) contract. The opposite procedure applies when withdrawing tokens or swapping, where WCSPR is the output token. In this scenario, it would be useful to unwrap the token.
