import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { parseLiquidityOnTicks } from '@invariant-labs/sdk/lib/utils'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)

  const ticks = await market.getClosestTicks(pair, Infinity)
  const pool = await market.getPool(pair)
  console.log(parseLiquidityOnTicks(ticks, pool))
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
