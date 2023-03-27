import { FeeTier, Tick } from '@invariant-labs/sdk/lib/market'
import { Market, Network, Pair } from '@invariant-labs/sdk/src'
import { simulateSwap, toDecimal } from '@invariant-labs/sdk/src/utils'
import { BN, Provider } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()


const provider = Provider.local('https://solana-mainnet.g.alchemy.com/v2/olFft01iKDVd2zzpVgTiCc2oKQnic3vs', {
    skipPreflight: true
})
const connection = provider.connection

const FTT = new PublicKey('EzfgjvkSwthhgHaceR3LnKXUoRkP6NUhfghdaHAj1tUv')
const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

const main = async () => {
    const market = await Market.build(Network.MAIN, provider.wallet, connection)

    const feeTier: FeeTier = {
        fee: new BN(500000000000),
        tickSpacing: 5
    }
    const pair = new Pair(USDC, FTT, feeTier)
    // UPDATE SWAP DIRECTION HERE
    const usdcToFtt = false
    let xToY = usdcToFtt
    if (pair.tokenX.equals(USDC)) {
        console.log('x = USDC')
        console.log('y = FTT')
    } else {
        xToY = !usdcToFtt
        console.log('x = FTT')
        console.log('y = USDC')
    }

    console.log(`tokenX = ${pair.tokenX.toString()}`)
    console.log(pair.tokenX)

    // pool data
    const pool = await market.getPool(pair)
    console.log(pool)

    // simulate swap
    const ticks: Map<number, Tick> = new Map(
        (await market.getAllTicks(pair)).map(tick => {
            return [tick.index, tick]
        })
    )
    const swapAmount = new BN(1e6)
    const tickmap = await market.getTickmap(pair)
    const {
        status,
        accumulatedAmountIn,
        accumulatedFee,
        accumulatedAmountOut,
        amountPerTick,
    } = simulateSwap({
        pool,
        byAmountIn: true,
        slippage: { v: new BN(0) },
        swapAmount,
        xToY,
        ticks,
        tickmap
    })
    // IN_TOKENS = accumulatedAmountIn + accumulatedFee
    // OUT_TOKENS = accumulatedAmountOut
    console.log(status)
    console.log(`accumulatedAmountIn = ${accumulatedAmountIn.toString()}`)
    console.log(`accumulatedFee = ${accumulatedFee.toString()}`)
    console.log(`accumulatedAmountOut = ${accumulatedAmountOut.toString()}`)
    console.log(`amountPerTick = ${amountPerTick.toString()}`)
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
