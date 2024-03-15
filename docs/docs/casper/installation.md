---
title: Installation

slug: /casper/installation
---

This section provides detailed instructions on how to install the Invariant protocol on Casper, including prerequisites and steps for setting up the development environment.

## Prerequisites

- Rust & Cargo ([rustup](https://www.rust-lang.org/tools/install))
- wasm-strip ([wabt](https://github.com/WebAssembly/wabt))
- cargo-odra ([cargo-odra](https://github.com/odradev/cargo-odra))

#### Rust & Cargo

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### wasm-strip

```bash
sudo apt install wabt
```

#### Add WASM

```bash
rustup target add wasm32-unknown-unknown
```

#### cargo-odra

```bash
cargo install cargo-odra --locked
```

## Build protocol

#### Clone repository

```bash
git clone git@github.com:invariant-labs/protocol-cspr.git
```

#### Build contract

```bash
cargo odra build -b casper
```

## Run tests

#### Run command

```bash
# Run tests on MockVM
cargo odra test
```

```bash
# Run tests on Casper backend
cargo odra test -b casper
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
