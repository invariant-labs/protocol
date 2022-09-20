import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS, fromFee, tou64 } from '@invariant-labs/sdk/src/utils'
import { Swap, Tick } from '@invariant-labs/sdk/src/market'
import { BN } from '../staker-sdk/lib'
import { simulateSwap } from '@invariant-labs/sdk/lib/utils'
import { calculatePriceSqrt } from '@invariant-labs/sdk'
import { MIN_TICK } from '@invariant-labs/sdk'
import { signAndSend } from '@invariant-labs/sdk'
import { associatedAddress } from '@project-serum/anchor/dist/cjs/utils/token'

const provider = Provider.local(
  'https://tame-ancient-mountain.solana-mainnet.quiknode.pro/6a9a95bf7bbb108aea620e7ee4c1fd5e1b67cc62',
  {
    skipPreflight: true
  }
)

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') // x
const USDT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') // y
const USDC_REFERRAL_FEE = new PublicKey('H5sizxhR6ssXrX2YNDoYaUv93PU34VzyRaVaUHuo5eFk') // on x token

export const main = async () => {
  const market = await Market.build(Network.MAIN, provider.wallet, connection)
  const usdcUsdt = new Pair(USDC, USDT, FEE_TIERS[0])

  const pool = await market.getPool(usdcUsdt)
  const tickmap = await market.getTickmap(usdcUsdt)

  // referral takes input token
  // swap x to y will, price will decrease
  const common = {
    byAmountIn: true,
    xToY: true,
    slippage: { v: new BN(0) }
  }
  const inputSwapAmount = new BN(10).pow(new BN(6))
  const endLimit = calculatePriceSqrt(MIN_TICK)
  const ticksArray: Tick[] = await market.getClosestTicks(usdcUsdt, Infinity)
  const ticks: Map<number, Tick> = new Map<number, Tick>()
  for (const tick of ticksArray) {
    ticks.set(tick.index, tick)
  }

  const simulationResult = simulateSwap({
    pool: pool,
    priceLimit: endLimit,
    swapAmount: inputSwapAmount,
    tickmap,
    ticks,
    ...common
  })
  console.log(simulationResult)

  const swapTransaction = await market.swapTransaction({
    accountX: await associatedAddress({ mint: USDC, owner: wallet.publicKey }),
    accountY: await associatedAddress({ mint: USDT, owner: wallet.publicKey }),
    amount: inputSwapAmount,
    pair: usdcUsdt,
    estimatedPriceAfterSwap: { v: simulationResult.priceAfterSwap },
    referralAccount: USDC_REFERRAL_FEE,
    ...common
  })

  const tx = await signAndSend(swapTransaction, [wallet], connection)
  console.log(tx)
}

main()
