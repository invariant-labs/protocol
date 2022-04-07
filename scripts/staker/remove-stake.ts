import { Staker, Network } from '../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { Market } from '@invariant-labs/sdk/lib/market'
import { MINTER } from '../minter'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { getMarketAddress, MOCK_TOKENS, Pair } from '@invariant-labs/sdk'

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
const wallet = new Wallet(MINTER)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const TOKEN_X: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_Y: PublicKey = new PublicKey(MOCK_TOKENS.SOL)
const OWNER: PublicKey = MINTER.publicKey
const FOUNDER: PublicKey = MINTER.publicKey
const INCENTIVE: PublicKey = new PublicKey('9X2p99zymwWpuJb7giF5rmbBLJAv5eDNA2zorpFEyJ4G')
const POSITION_INDEX = 0

const main = async () => {
  const staker = await Staker.build(Network.DEV, wallet, connection)
  const market = await Market.build(Network.DEV, wallet, connection)
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(TOKEN_X, TOKEN_Y, feeTier)
  const [poolAddress] = await pair.getAddressAndBump(new PublicKey(getMarketAddress(Network.DEV)))
  const position = await market.getPosition(OWNER, POSITION_INDEX)

  await staker.removeStake(poolAddress, position.id, INCENTIVE, FOUNDER)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
