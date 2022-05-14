import { Network } from '../../staker-sdk/src/'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Pair } from '@invariant-labs/sdk'
import { MINTER } from '../minter'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Market } from '@invariant-labs/sdk'
import { getTickArray } from '../../staker-sdk/src/utils'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const TOKEN_X: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_Y: PublicKey = new PublicKey(MOCK_TOKENS.WSOL)
const FEE_TIER = FEE_TIERS[0]

const main = async () => {
  const pair = new Pair(TOKEN_X, TOKEN_Y, FEE_TIER)
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  const pool = await market.getPool(pair)
  const rawTicks = await market.getAllTicks(pair)
  const ticks = getTickArray(rawTicks, pool)
  const tickmap = await market.getTickmap(pair)

  console.log(ticks)
  console.log('##############')
  console.log(tickmap.bitmap)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
