import * as anchor from '@project-serum/anchor'
import { Market, Network, Pair } from '@invariant-labs/sdk'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS } from '@invariant-labs/sdk'
import { FEE_TIERS } from '@invariant-labs/sdk/src/network'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
const market = new Market(Network.DEV, provider.wallet, connection)
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.USDT))

  await market.create({
    pair,
    signer: wallet,
    feeTier: FEE_TIERS[0]
  })
}
main()
