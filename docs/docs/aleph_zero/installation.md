---
title: Installation

slug: /aleph_zero/installation
---

## Prerequisites

* Rust & Cargo ([rustup](https://www.rust-lang.org/tools/install))
* ink! ([ink!](https://use.ink/getting-started/setup))
* substrate-contracts-node ([substrate-contracts-node](https://github.com/paritytech/substrate-contracts-node))

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