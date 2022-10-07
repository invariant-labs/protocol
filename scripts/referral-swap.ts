import { Provider } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Tick } from '@invariant-labs/sdk/src/market'
import { BN } from '../staker-sdk/lib'
import { simulateSwap } from '@invariant-labs/sdk/lib/utils'
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
const USDT_REFERRAL_FEE = new PublicKey('FVKG6bkrQ4rksme6GT1FN7PgvZf9cNmupyWfN5kJj8Fx') // on y token

export const main = async () => {
  const market = await Market.build(Network.MAIN, provider.wallet, connection)
  const usdcUsdt = new Pair(USDC, USDT, FEE_TIERS[0])

  const pool = await market.getPool(usdcUsdt)
  const tickmap = await market.getTickmap(usdcUsdt)

  // referral takes input token
  // swap x to y will, price will decrease
  const xToY = true
  const common = {
    byAmountIn: true,
    xToY,
    slippage: { v: new BN(0) }
  }
  const inputSwapAmount = new BN(10).pow(new BN(6))
  const ticksArray: Tick[] = await market.getClosestTicks(usdcUsdt, Infinity)
  const ticks: Map<number, Tick> = new Map<number, Tick>()
  for (const tick of ticksArray) {
    ticks.set(tick.index, tick)
  }

  const simulationResult = simulateSwap({
    pool: pool,
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
    referralAccount: xToY ? USDC_REFERRAL_FEE : USDT_REFERRAL_FEE,
    ...common
  })

  const tx = await signAndSend(swapTransaction, [wallet], connection)
  console.log(tx)
}

main()
