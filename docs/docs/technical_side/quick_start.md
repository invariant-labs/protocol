---
title: Quick start

slug: /sdk/quick_start
---

### Setting Up

For any help/setup questions, feel free to ask in [# ❓┆questions](https://discord.com/channels/916085610270322738/916117229895049227) on Discord!

### Installation

Requires [Anchor](https://www.npmjs.com/package/%40project-serum%2Fanchor) and Solana's web3.js library to be installed.

```
npm i @invariant-labs/sdk
```

### Usage

```
import { Market, Pair } from '@invariant-labs/sdk'
```

### Program IDs

| Endpoint |                  Program ID                  |
| -------- | :------------------------------------------: |
| Devnet   | ESRPyq2GA57atfh3mpq59skfTka3tmd4euajAqkbsiMm |
| Mainnet  |                    :soon:                    |

Data structures are an exact mapping, with the only changes being type and case. Methods called by a user have a corresponding method, that creates instructions, adds them to transaction, signs, and sends it. All methods (including ones used only by admin) have corresponding methods that return just the instruction.
