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
#### Install rust and add wasm32 target
```bash
rustup install 1.78
rustup target add wasm32-unknown-unknown --toolchain 1.78 
```
#### Install wasm-opt
```bash
cargo install wasm-opt --locked
```

## Build Protocol

#### Clone repository

```bash
git clone git@github.com:invariant-labs/protocol-vara.git
```

#### Build contract

```bash
chmod +x ./build.sh
./build.sh dev
```

#### Build in release mode

```bash
chmod +x ./build.sh
./build.sh
```

#### Run tests

```bash
chmod +x ./tests.sh
./tests.sh
```

## SDK
To build SDK go to the dedicated folder [SDK](https://github.com/invariant-labs/protocol-vara/tree/master/sdk)
#### Build sdk
```bash
chmod +x ./build.sh
./build.sh
```
#### Run sdk tests
```bash
chmod +x ./tests.sh
./tests.sh
```