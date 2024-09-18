import { Market, Network, Pair } from '@invariant-labs/sdk/src'
import { MOCK_TOKENS } from '@invariant-labs/sdk/src/network'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Provider } from '@coral-xyz/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.USDT), feeTier)
  // const pair = new Pair(new PublicKey(MOCK_TOKENS.USDT), new PublicKey(MOCK_TOKENS.USDC), feeTier)

  // const currentTick = 12
  // const lowerFailed = -40
  // const lowerSuccess = -44
  // const upper = -20

  const pool = await market.getPool(pair)
  // const ticks = await market.getAllTicks(pair)
  // for (let tick of ticks) {
  //   console.log(tick.index, ' ', tick.liquidityGross.v.toString())
  // }
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
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
