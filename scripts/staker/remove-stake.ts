import { Staker, Network } from '../../sdk-staker/src'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { Market } from '@invariant-labs/sdk/lib/market'

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const POOL: PublicKey = new PublicKey('0')
const FOUNDER: PublicKey = new PublicKey('0')
const INCENTIVE: PublicKey = new PublicKey('0')
const POSITION: PublicKey = new PublicKey('0')
const POSITION_INDEX = 0

const main = async () => {
  const staker = await Staker.build(Network.DEV, provider.wallet, connection)
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  const position = await market.getPosition(POSITION, POSITION_INDEX)

  await staker.removeStake(POOL, position.id, INCENTIVE, FOUNDER)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
