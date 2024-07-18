---
title: Handling AZERO

slug: /aleph_zero/handling_azero
---

## What is wAZERO?

Wrapped coins and tokens virtually have the same value as their underlying assets. Therefore, [wAZERO](https://github.com/Cardinal-Cryptography/wAZERO) is the PSP22 compatible and tradable version of AZERO and can be used to interact with other AZERO assets.

## How to create a pool with wAZERO?

The Invariant Protocol enables token exchanges within the PSP22 token standard. To ensure compatibility with this interface, an additional action is required for the AZERO native cryptocurrency. Before depositing a token into a pool or a swap where the input token is AZERO, you must first wrap AZERO using the [wAZERO](https://github.com/Cardinal-Cryptography/wAZERO) contract. The opposite procedure applies when withdrawing tokens or swapping, where wAZERO is the output token. In this scenario, it would be useful to unwrap the token.
