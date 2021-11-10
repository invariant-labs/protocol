import { Market, Network, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS, MOCK_TOKENS } from '@invariant-labs/sdk/src/network'
import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { createStandardFeeTiers } from '../tests/testUtils'
import { MINTER } from './minter'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
const market = new Market(Network.DEV, provider.wallet, connection)
// @ts-expect-error
const wallet = provider.wallet.payer as Keypai

const main = async () => {
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.USDT), feeTier)

  // const feeTierStruct = await market.getFeeTier(feeTier)
  // console.log(feeTierStruct)

  // const pool = await market.getPool(pair)
  // console.log(pool)

  // const tick = await market.getTick(pair, -4)
  // console.log(tick)

  // const positionList = await market.getPositionList(MINTER.publicKey)
  // console.log(positionList)

  // const position = await market.getPosition(MINTER.publicKey, 0)
  // console.log(position)
}
main()
