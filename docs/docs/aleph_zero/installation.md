---
title: Installation

slug: /aleph_zero/installation
---

This section provides detailed instructions on how to install the Invariant protocol on Aleph Zero, including prerequisites and steps for setting up the development environment.

## Prerequisites

- Rust & Cargo ([rustup](https://www.rust-lang.org/tools/install))
- cargo-contract ([cargo-contract](https://github.com/paritytech/cargo-contract))
- substrate-contracts-node ([substrate-contracts-node](https://github.com/paritytech/substrate-contracts-node))

#### Install Rust & Cargo

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Install cargo-contract

```bash
rustup component add rust-src && cargo install --force --locked cargo-contract
```

#### Install substrate-contracts-node

```bash
cargo install contracts-node --git https://github.com/paritytech/substrate-contracts-node.git
```

#### Install wasm-bindgen

```bash
sudo apt install --locked wasm-bindgen-cli
```

## Build Protocol

#### Clone repository

```bash
git clone git@github.com:invariant-labs/protocol-a0.git
```

#### Build contract

```bash
cargo contract build
```

#### Build in release mode

```bash
cargo contract build --release
```

#### Run tests

```bash
cargo test
```

## Build SDK

#### Build SDK with its associated dependencies

```bash
cd sdk
./build.sh
```

#### Run e2e tests

```bash
./tests.sh
```
