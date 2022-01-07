import { Market, Network, Pair } from '@invariant-labs/sdk/src'
import { MOCK_TOKENS } from '@invariant-labs/sdk/src/network'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)
  // const pair = new Pair(new PublicKey(MOCK_TOKENS.USDT), new PublicKey(MOCK_TOKENS.USDC), feeTier)

  // const currentTick = 12
  // const lowerFailed = -40
  // const lowerSuccess = -44
  // const upper = -20

  const pool = await market.getPool(pair)
  console.log(pool.currentTickIndex)

  const array = await Promise.all([
    market.getPool(pair)
    // market.getTick(pair, currentTick),
    // market.getTick(pair, lowerFailed),
    // market.getTick(pair, lowerSuccess),
    // market.getTick(pair, upper)
  ])

  console.log(array)
}
main()
