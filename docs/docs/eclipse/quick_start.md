---
title: Quick start

slug: /eclipse/quick_start
---

### Setting Up

For any help/setup questions, feel free to ask in [# ❓┆questions](https://discord.com/channels/916085610270322738/916117229895049227) on Discord!

### Installation

Requires [Anchor](https://www.npmjs.com/package/%40project-serum%2Fanchor) and Solana's web3.js library to be installed.

```
npm i @invariant-labs/sdk-eclipse
```

### Usage

```
import { Market, Pair } from '@invariant-labs/sdk-eclipse'
```

### Program IDs

| Endpoint |                  Program ID                  |
| -------- | :------------------------------------------: |
| Devnet   | CsT21LCRqBfh4SCcNZXtWjRZ6xvYKvdpEBaytCVmWnVJ |
| Testnet  | CsT21LCRqBfh4SCcNZXtWjRZ6xvYKvdpEBaytCVmWnVJ |

Data structures are an exact mapping, with the only changes being type and case. Methods called by a user have a corresponding method, that creates instructions, adds them to transaction, signs, and sends it. All methods (including ones used only by admin) have corresponding methods that return just the instruction.

Before you begin making your first pool and position, you must first construct the market as shown below.

```ts
const market = await Market.build([Network.MAIN | Network.DEV], provider.wallet, connection)
```
