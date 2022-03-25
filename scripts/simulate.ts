import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
// trunk-ignore(eslint/@typescript-eslint/no-unused-vars)
import { MINTER } from './minter'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS, simulateSwap, SimulateSwapInterface } from '@invariant-labs/sdk/src/utils'
import { Tick } from '@invariant-labs/sdk/src/market'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { BN } from '../staker-sdk/lib'
import { Swap } from '@invariant-labs/sdk/lib/market'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const tokenXAddress = MOCK_TOKENS.USDT
const tokenYAddress = MOCK_TOKENS.USDC
const feeTier = FEE_TIERS[0]

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  const pair = new Pair(new PublicKey(tokenXAddress), new PublicKey(tokenYAddress), feeTier)

  if (!new PublicKey(tokenXAddress).equals(pair.tokenX)) throw new Error('Order is reversed')
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

  const ticksArray: Tick[] = await market.getClosestTicks(pair, Infinity)
  const ticks: Map<number, Tick> = new Map<number, Tick>()

  console.log(ticksArray.map(tick => tick.index))

  for (const tick of ticksArray) {
    ticks.set(tick.index, tick)
  }

  const poolData = await market.getPool(pair)
  console.log('cti', poolData.currentTickIndex)
  console.log('starting simulation')

  const simProps: SimulateSwapInterface = {
    xToY: true,
    byAmountIn: true,
    swapAmount: new anchor.BN(1e10),
    priceLimit: poolData.sqrtPrice,
    slippage: { v: new anchor.BN(DENOMINATOR) },
    ticks,
    tickmap: await market.getTickmap(pair),
    pool: poolData
  }

  const result = simulateSwap(simProps)
  console.log(poolData.liquidity.v.toString())

  console.log('here', result.priceAfterSwap.toString())

  console.log(result.amountPerTick.map(i => i.toString()))

  console.log(
    result.accumulatedAmountIn.add(result.accumulatedFee).toString(),
    result.accumulatedAmountOut.toString()
  )

  const [accountX, accountY] = await Promise.all([
    tokenX.getOrCreateAssociatedAccountInfo(wallet.publicKey),
    tokenY.getOrCreateAssociatedAccountInfo(wallet.publicKey)
  ])

  const swapProps: Swap = {
    ...simProps,
    pair,
    amount: simProps.swapAmount,
    estimatedPriceAfterSwap: { v: result.priceAfterSwap },
    accountX: accountX.address,
    accountY: accountY.address
  }

  await market.swap(swapProps, wallet)
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
