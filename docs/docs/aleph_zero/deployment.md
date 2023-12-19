---
title: Deployment

slug: /aleph_zero/deployment
---

This section provides detailed instructions on how to deploy the Invariant protocol on local network, including prerequisites and steps for setting up the environment.

### Clone the Repository

```bash
git clone git@github.com:invariant-labs/protocol-a0.git
```

### Build Contract

```bash
cargo contract build --release
```

### Run Makefile

#### Deploy on Testnet

```bash
make setup n=testnet
```

#### Deploy on Localhost

Execute the following commands to stop, clean, and restart the Substrate Contracts Node:

```bash
make chain-stop
make chain-clean
make chain-restart
```

Run the deployment script to deploy the Invariant contract:

```bash
make setup n=localhost
```

### Verify deployment

Check the `addresses.json` file to ensure that the contracts have been deployed successfully.

```bash
cat scripts/addresses.json
```

The file should contain the contract addresses and other relevant information.
