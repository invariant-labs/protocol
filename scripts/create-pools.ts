import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { CreatePool } from '@invariant-labs/sdk/src/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
// const feeTier = FEE_TIERS[0]

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  await createUsdcUsdt(market)
  await createUsdcWSol(market)
  // await createMsolSol(market)
}
const createUsdcUsdt = async (market: Market) => {
  for (const i of [0]) {
    const pair = new Pair(
      new PublicKey(MOCK_TOKENS.USDC),
      new PublicKey(MOCK_TOKENS.USDT),
      FEE_TIERS[i]
    )

    const createPoolVars: CreatePool = {
      pair,
      payer: wallet
    }
    await market.createPool(createPoolVars)
  }
}

const createUsdcWSol = async (market: Market) => {
  for (const i of [0, 1, 2]) {
    const pair = new Pair(
      new PublicKey(MOCK_TOKENS.USDC),
      new PublicKey(MOCK_TOKENS.WSOL),
      FEE_TIERS[i]
    )

    const createPoolVars: CreatePool = {
      pair,
      payer: wallet,
      initTick: 21200
    }
    await market.createPool(createPoolVars)
  }
}

// const createMsolWSol = async (market: Market) => {
//   for (const i of [0, 1, 2]) {
//     const pair = new Pair(
//       new PublicKey(MOCK_TOKENS.USDC),
//       new PublicKey(MOCK_TOKENS.WSOL),
//       FEE_TIERS[i]
//     )

//     const createPoolVars: CreatePool = {
//       pair,
//       payer: wallet,
//       initTick: 18000
//     }
//     await market.createPool(createPoolVars)
//   }
// }

// const createMsolSol = async (market: Market) => {
//   const pair = new Pair(new PublicKey(MOCK_TOKENS.MSOL), new PublicKey(MOCK_TOKENS.SOL), feeTier)

//   const createPoolVars: CreatePool = {
//     pair,
//     payer: wallet,
//     initTick: 200
//   }
//   await market.createPool(createPoolVars)
// }

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
