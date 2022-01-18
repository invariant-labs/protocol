import { Market, Network } from '@invariant-labs/sdk/src'
import { CreateFeeTier } from '@invariant-labs/sdk/src/market'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair } from '@solana/web3.js'
import { MINTER } from './minter'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const createStandardFeeTiers = async (market: Market, payer: Keypair) => {
  await Promise.all(
    FEE_TIERS.map(async feeTier => {
      const createFeeTierVars: CreateFeeTier = {
        feeTier,
        admin: payer.publicKey
      }
      await market.createFeeTier(createFeeTierVars, payer)
    })
  )
}

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  await market.createState(MINTER.publicKey, MINTER)
  await createStandardFeeTiers(market, MINTER)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
