import { Market, Network } from '@invariant-labs/sdk/src'
import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair } from '@solana/web3.js'
import { createStandardFeeTiers } from '../tests/testUtils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
const market = new Market(Network.DEV, provider.wallet, connection)
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  await createStandardFeeTiers(market, wallet)
}
main()
