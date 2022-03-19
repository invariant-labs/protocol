import * as fs from 'fs'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Connection, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { FEE_TIERS, toDecimal } from '@invariant-labs/sdk/src/utils'
import { Swap } from '@invariant-labs/sdk/src/market'
import { BN } from '../sdk-staker/lib'
import { CloserLimit, getCloserLimit, U128MAX } from '@invariant-labs/sdk/lib/utils'
import { calculateSwapStep, getDeltaX, getDeltaY, U64_MAX } from '@invariant-labs/sdk/src/math'
import { findClosestTicks } from '@invariant-labs/sdk/src/math'
import { formatLiquidity, formatPrice, handleMint, isRPCError } from './utils'
import { sleep } from '@invariant-labs/sdk'
import { PoolStructure } from '@invariant-labs/sdk/lib/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  commitment: 'confirmed',
  skipPreflight: true
})

const connection = new Connection('https://psytrbhymqlkfrhudd.dev.genesysgo.net:8899', {
  wsEndpoint: 'wss://psytrbhymqlkfrhudd.dev.genesysgo.net:8900',
  commitment: 'confirmed'
})
const dirPath = './scripts/logs/washTrading'

// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const pairs: [Pair, string][] = [
  [
    new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.USDT), FEE_TIERS[0]),
    'USDC-USDT 0'
  ],
  [
    new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.USDT), FEE_TIERS[1]),
    'USDC-USDT 1'
  ]
]

const main = async () => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  const filePath = `${dirPath}/washTrading-${new Date(Date.now()).toISOString()}`

  const market = await Market.build(Network.DEV, provider.wallet, connection)

  while (true) {
    const [pair, name] = pairs[Math.floor(Math.random() * pairs.length)]
    const { accountX, accountY } = await handleMint(connection, pair, new BN(1e14), MINTER)

    const pool = await market.getPool(pair)
    const tickmap = await market.getTickmap(pair)

    let randomXtoY = Math.random() > 0.5

    const washTradingLimit = 10000 * pair.tickSpacing

    const reverseDirection = randomXtoY
      ? pool.currentTickIndex < -washTradingLimit
      : pool.currentTickIndex > washTradingLimit

    const xToY = reverseDirection ? !randomXtoY : randomXtoY

    const closerLimit: CloserLimit = {
      sqrtPriceLimit: xToY ? { v: new BN(1) } : { v: U128MAX.subn(1) },
      xToY,
      currentTick: pool.currentTickIndex,
      tickSpacing: pool.tickSpacing,
      tickmap
    }

    const { swapLimit, limitingTick } = getCloserLimit(closerLimit)
    const swapLogs: string[] = []

    swapLogs.push(`Ticks: ${pool.currentTickIndex} -> ${limitingTick?.index} at ${name}`)
    swapLogs.push(
      `Price: ${formatPrice(pool.sqrtPrice)} -> ${formatPrice(
        swapLimit
      )}, Liquidity: ${formatLiquidity(pool.liquidity)}`
    )

    const result = calculateSwapStep(
      pool.sqrtPrice,
      swapLimit,
      pool.liquidity,
      new BN(U64_MAX.subn(10)),
      false,
      pool.fee
    )
    const amount = result.amountIn.add(result.feeAmount).addn(1)

    swapLogs.push(
      `swap ${xToY ? 'x -> y' : 'y -> x'}: ${formatLiquidity({
        v: amount
      })}+ -> ${formatLiquidity({ v: result.amountOut })}`
    )
    const currentTickBefore = pool.currentTickIndex

    const swapVars: Swap = {
      xToY,
      accountX,
      accountY,
      amount: result.amountOut.addn(1),
      byAmountIn: false,
      estimatedPriceAfterSwap: xToY ? { v: new BN(1) } : { v: U128MAX.subn(1) },
      slippage: toDecimal(0),
      pair,
      owner: MINTER.publicKey
    }

    swapLogs.forEach(log => console.log(log))

    try {
      const tx = await market.swapSplit(swapVars, MINTER)
      console.log('success: ', tx)
    } catch (err: any) {
      if (isRPCError(err)) {
        console.log(`error: ${err.toString()}`)
        console.log('RPC error, continuing...\n')
      } else {
        swapLogs.unshift(`Swap error of ${name} at ${new Date(Date.now()).toISOString()}`)
        swapLogs.push(`Price after error: ${formatPrice((await market.getPool(pair)).sqrtPrice)}`)
        swapLogs.push(`Error: ${err.toString()}'n`)
        swapLogs.push('\n\n')

        console.log(`error: ${err.toString()}`)
        fs.appendFileSync(filePath, swapLogs.join('\n'))
      }
      continue
    }

    let poolAfter: PoolStructure | undefined = undefined
    do {
      if (poolAfter != undefined) console.log('skip')
      await sleep(500)
      poolAfter = await market.getPool(pair)
    } while (poolAfter.sqrtPrice.v.eq(pool.sqrtPrice.v))

    const currentTickAfter = poolAfter.currentTickIndex
    console.log(`Tick ${currentTickBefore !== currentTickAfter ? 'crossed' : 'not crossed'}\n`)
  }
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
