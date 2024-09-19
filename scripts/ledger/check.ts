import { Market, Network, Pair } from '@invariant-labs/sdk/src'
import { MOCK_TOKENS } from '@invariant-labs/sdk/src/network'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { AnchorProvider } from '@coral-xyz/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = AnchorProvider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  const state = await market.getState()

  console.log('admin of the state')
  console.log(`state = ${state.admin.toString()}`)
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
