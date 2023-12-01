---
title: Installation

slug: /aleph_zero/installation
---

This section provides detailed instructions on how to install the Invariant protocol smart contract on Aleph Zero, including prerequisites and steps for setting up the development environment.

## Prerequisites

* Rust & Cargo ([rustup](https://www.rust-lang.org/tools/install))
* cargo-contract ([cargo-contract](https://github.com/paritytech/cargo-contract))
* substrate-contracts-node ([substrate-contracts-node](https://github.com/paritytech/substrate-contracts-node))
* ink! ([ink!](https://use.ink/getting-started/setup))

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
cargo install contracts-node
```
## Installation

* Clone repository
```
git clone git@github.com:invariant-labs/protocol-a0.git
```

* Run tests
```
cargo test --features e2e-tests
```

* Build contract
```
cargo contract build
```