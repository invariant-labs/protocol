import { Market, Network, Pair } from '@invariant-labs/sdk/src'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl } from '@solana/web3.js'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
