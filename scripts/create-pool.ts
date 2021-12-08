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
const market = new Market(Network.DEV, provider.wallet, connection)
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  await createUsdcUsdt(market)
  await createUsdcSol(market)
  await createUsdcSolPricier(market)
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
    signer: wallet,
    initTick: 16000
  })
}
const createUsdcSolPricier = async (market: Market) => {
  const pair = new Pair(
    new PublicKey(MOCK_TOKENS.USDC),
    new PublicKey(MOCK_TOKENS.SOL),
    FEE_TIERS[1]
  )

  await market.create({
    pair,
    signer: wallet,
    initTick: 16000
  })
}

main()
