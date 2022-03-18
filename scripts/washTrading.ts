import * as fs from 'fs'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { FEE_TIERS, toDecimal } from '@invariant-labs/sdk/src/utils'
import { Swap } from '@invariant-labs/sdk/src/market'
import { BN } from '../sdk-staker/lib'
import {
  CloserLimit,
  getCloserLimit,
  simulateSwap,
  SimulateSwapInterface,
  U128MAX
} from '@invariant-labs/sdk/lib/utils'
import {
  calculatePriceAfterSlippage,
  calculateSwapStep,
  findClosestTicks,
  U64_MAX
} from '@invariant-labs/sdk/lib/math'
import { calculatePriceSqrt } from '@invariant-labs/sdk'
import { getTickFromPrice } from '@invariant-labs/sdk/src/tick'
import { Tick } from '@invariant-labs/sdk/lib/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  commitment: 'confirmed',
  skipPreflight: true
})

const connection = provider.connection
const dirPath = './logs/washTrading'

// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  const filePath = `${dirPath}/washTrading-${Date.now()}`

  const market = await Market.build(Network.DEV, provider.wallet, connection)

  const pair = new Pair(
    new PublicKey(MOCK_TOKENS.USDC),
    new PublicKey(MOCK_TOKENS.USDT),
    FEE_TIERS[0]
  )

  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  const accountX = await tokenX.createAccount(MINTER.publicKey)
  const accountY = await tokenY.createAccount(MINTER.publicKey)

  await tokenX.mintTo(accountX, MINTER, [], tou64(1e13))
  await tokenY.mintTo(accountY, MINTER, [], tou64(1e13))

  const tickmap = await market.getTickmap(pair)

  while (true) {
    const start = Date.now()

    const side = false

    const pool = await market.getPool(pair)

    const closerLimit: CloserLimit = {
      sqrtPriceLimit: side ? { v: new BN(1) } : { v: U128MAX.subn(1) },
      xToY: side,
      currentTick: pool.currentTickIndex,
      tickSpacing: pool.tickSpacing,
      tickmap: tickmap
    }
    console.log('liquidity: ', pool.liquidity.v.toString())

    const { swapLimit, limitingTick } = getCloserLimit(closerLimit)

    console.log('swapLimit: ', swapLimit.v.toString())
    console.log('pool.sqrtPrice: ', pool.sqrtPrice.v.toString())

    const result = calculateSwapStep(
      pool.sqrtPrice,
      swapLimit,
      pool.liquidity,
      new BN(U64_MAX.subn(10)),
      true,
      pool.fee
    )

    console.log(swapLimit.v.eq(result.nextPrice.v))
    console.log('limitingTick: ', limitingTick?.index)
    console.log('currentTick: ', pool.currentTickIndex)
    console.log(
      `swap ${side ? 'x -> y' : 'y -> x'}: ${result.amountIn.add(result.feeAmount).toString()}`
    )
    const currentTickBefore = (await market.getPool(pair)).currentTickIndex

    // const ticksArray: Tick[] = await market.getClosestTicks(pair, Infinity)
    // const ticks: Map<number, Tick> = new Map<number, Tick>()

    // for (const tick of ticksArray) {
    //   ticks.set(tick.index, tick)
    // }

    // const vars: SimulateSwapInterface = {
    //   xToY: side,
    //   byAmountIn: true,
    //   swapAmount: result.amountIn.add(result.feeAmount).addn(100),
    //   priceLimit: side ? { v: new BN(1) } : { v: U128MAX.subn(1) },
    //   slippage: toDecimal(0, 2),
    //   ticks,
    //   pool,
    //   tickmap
    // }

    // const simulate = simulateSwap(vars)
    const swapVars: Swap = {
      xToY: side,
      accountX: accountX,
      accountY: accountY,
      amount: result.amountIn.add(result.feeAmount).addn(100),
      byAmountIn: true,
      estimatedPriceAfterSwap: side ? { v: new BN(1) } : { v: U128MAX.subn(1) },
      slippage: toDecimal(0, 2),
      pair,
      owner: MINTER.publicKey
    }

    // const result = getTickFromPrice(
    //   pool.currentTickIndex,
    //   pool.tickSpacing,
    //   { v: simulateSwap(vars).priceAfterSwap },
    //   side
    // )

    try {
      await market.swapSplit(swapVars, MINTER)
    } catch (err: any) {
      const pool = await market.getPool(pair)
      const swapDetails = `swap details:\nxToY: ${
        // trunk-ignore(eslint/@typescript-eslint/restrict-template-expressions)
        swapVars.xToY
      }\namount: ${swapVars.amount.toString()}\n`
      const poolDetails = `pool details:\ncurrentTickIndex: ${
        pool.currentTickIndex
      }\nliquidity: ${pool.liquidity.v.toString()}\n`

      fs.appendFileSync(filePath, swapDetails)
      fs.appendFileSync(filePath, poolDetails)
      // trunk-ignore(eslint/@typescript-eslint/restrict-template-expressions)
      fs.appendFileSync(filePath, `error: ${err.toString()}\n\n`)
      continue
    }
    const currentTickAfter = (await market.getPool(pair)).currentTickIndex
    console.log(currentTickBefore !== currentTickAfter ? 'Tick crossed' : 'Tick not crossed')
    console.log('currentTickBefore: ', currentTickBefore)
    console.log('currentTickAfter: ', currentTickAfter)
    console.log(`time: ${Date.now() - start}\n`)
  }
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
