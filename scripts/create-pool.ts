import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const feeTier = FEE_TIERS[0]

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  await createUsdcUsdt(market)
  await createUsdcSol(market)
}
const createUsdcUsdt = async (market: Market) => {
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.USDT), feeTier)

  await market.create({
    pair,
    signer: wallet
  })
}
const createUsdcSol = async (market: Market) => {
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)

  await market.create({
    pair,
    signer: wallet
  })
}

main()
