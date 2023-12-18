---
title: Deployment

slug: /casper/deployment
---

This section provides detailed instructions on how to deploy the Invariant protocol on Casper, including prerequisites.

## Prerequisites

- Rust & Cargo ([rustup](https://www.rust-lang.org/tools/install))
- wasm-strip ([wabt](https://github.com/WebAssembly/wabt))
- cargo-odra ([cargo-odra](https://github.com/odradev/cargo-odra))
- Download & Build ([Installation](/docs/casper/installation))
- casper-client ([casper-client](https://github.com/casper-ecosystem/casper-client-rs))

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

#### Download & Build

```bash
git clone git@github.com:invariant-labs/protocol-cspr.git
cargo odra build -b casper
```

#### casper-client

```bash
cargo install casper-client
```

## Deploy contract

#### Generate account keys

```bash
casper-client keygen ed25519-keys/
```

#### Import it to Casper Wallet using secret key and claim [faucet](https://testnet.cspr.live/tools/faucet)

#### Get protocol fee as bytes

```rust
let percentage = Percentage::new(U128::from(0));
let bytes = percentage.to_bytes().unwrap();
let hex = hex::encode(bytes);
```

#### Deploy protocol

```bash
casper-client put-deploy \
--node-address $RPC_ADDRESS \
--chain-name $CHAIN_NAME \
--secret-key ./ed25519-keys/secret_key.pem \
--payment-amount $PAYMENT_AMOUNT \
--session-path ./target/wasm32-unknown-unknown/release/invariant.wasm \
--session-arg "odra_cfg_package_hash_key_name:string:'invariant'" \
--session-arg "odra_cfg_allow_key_override:bool:'false'" \
--session-arg "odra_cfg_is_upgradable:bool:'true'" \
--session-arg "odra_cfg_constructor:string:'init'" \
--session-arg "protocol_fee:u128:'protocol_fee:byte_array_15:'$PROTOCOL_FEE_AS_BYTES'"
```
