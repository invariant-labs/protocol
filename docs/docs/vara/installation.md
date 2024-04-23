---
title: Installation

slug: /vara/installation
---

This section provides detailed instructions on how to install the Invariant protocol on Vara, including prerequisites and steps for setting up the development environment.

## Prerequisites

- Rust & Cargo ([rustup](https://www.rust-lang.org/tools/install))

#### Install Rust & Cargo

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
#### Add wasm32 target
```bash
rustup target add wasm32-unknown-unknown
```

## Build Protocol

#### Clone repository

```bash
git clone git@github.com:invariant-labs/protocol-vara.git
```

#### Build contract

```bash
cargo build
```

#### Build in release mode

```bash
cargo contract build --release
```

#### Run tests

```bash
./tests.sh
```

