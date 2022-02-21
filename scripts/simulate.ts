import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import {
  FEE_TIERS,
  fromFee,
  simulateSwap,
  SimulateSwapInterface
} from '@invariant-labs/sdk/src/utils'
import { Swap, Tick } from '@invariant-labs/sdk/src/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection

// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  const pair = new Pair(
    new PublicKey(MOCK_TOKENS.BTC),
    new PublicKey(MOCK_TOKENS.REN_DOGE),
    FEE_TIERS[2]
  )

  const ticksArray: Tick[] = await market.getClosestTicks(pair, Infinity)

  console.log(ticksArray.map(({ index }) => index))

  const ticks: Map<number, Tick> = new Map<number, Tick>()

  for (const tick of ticksArray) {
    ticks.set(tick.index, tick)
  }

  const poolData = await market.getPool(pair)
  console.log('starting simulation')

  const pp: SimulateSwapInterface = {
    xToY: false,
    byAmountIn: true,
    swapAmount: new anchor.BN(0x0f4240),
    priceLimit: { v: new anchor.BN('18446744073709551615') },
    slippage: { v: new anchor.BN(0x02540be400) },
    ticks,
    tickmap: await market.getTickmap(pair),
    pool: poolData
  }

  simulateSwap(pp)

  // await market.swap(swapVars, MINTER)
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
