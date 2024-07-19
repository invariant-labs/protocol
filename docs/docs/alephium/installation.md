---
title: Installation

slug: /alephium/installation
---

This section provides detailed instructions on how to install the Invariant protocol on Alephium, including prerequisites and steps for setting up the development environment.

## Prerequisites

- Node.js ([node](https://nodejs.org/en/download))
- Docker Engine ([docker-engine](https://docs.docker.com/engine/install/))
- Docker Compose ([substrate-contracts-node](https://docs.docker.com/compose/install/))

#### Install Node.js

```bash
# installs nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# download and install Node.js (you may need to restart the terminal)
nvm install 20

# verifies the right Node.js version is in the environment
node -v # should print `v20.15.1`

# verifies the right NPM version is in the environment
npm -v # should print `10.7.0`
```

#### Install Docker Engine

##### Uninstall all conflicting packages
```bash
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done
```

##### Add `Docker` to your `apt` repository'
```bash
# adds Docker's official GPG key
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# adds the repository to Apt sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

##### Install Docker Engine
```bash
# installs the latest version
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

#verify if Docker Engine runs correctly
sudo docker run hello-world
```

#### Install Docker Compose
Installation of Docker Engine is required before installing Docker Compose.

```bash
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

## Protocol
### Build 

#### Clone repository

```bash
git clone git@github.com:invariant-labs/protocol-alephium.git
```

#### Install packages

```bash
npm install
```

#### Start a local devnet for testing and development

```bash
cd alephium-stack && make start-devnet
```

#### Compile contracts

```bash
npm run compile
```

### Test

##### All

```bash
npm run test
```

##### Contracts

```bash
npm run test:contract
```

##### SDK

```bash
npm run test:sdk
```
<!-- TODO-ALEPHIUM: describe SDK installation -->
<!-- ## Build SDK

#### Build SDK with its associated dependencies

```bash
cd sdk
./build.sh
```

#### Run e2e tests

```bash
./tests.sh
``` -->
