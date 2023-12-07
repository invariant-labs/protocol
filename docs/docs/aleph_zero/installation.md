---
title: Installation

slug: /aleph_zero/installation
---

This section provides detailed instructions on how to install the Invariant protocol on Aleph Zero, including prerequisites and steps for setting up the development environment.

## Prerequisites

- Rust & Cargo ([rustup](https://www.rust-lang.org/tools/install))
- cargo-contract ([cargo-contract](https://github.com/paritytech/cargo-contract))
- substrate-contracts-node ([substrate-contracts-node](https://github.com/paritytech/substrate-contracts-node))

### Rust & Cargo

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### cargo-contract

```bash
rustup component add rust-src && cargo install --force --locked cargo-contract
```

### substrate-contracts-node

```bash
cargo install contracts-node --git https://github.com/paritytech/substrate-contracts-node.git
```

## Build protocol

- Clone repository

```
git clone git@github.com:invariant-labs/protocol-a0.git
```

- Build contract

```
cargo contract build
```

- Run tests

```
cargo test --features e2e-tests
```
