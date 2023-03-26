import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Market, Network, Pair } from '@invariant-labs/sdk/src'
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

    const poolData = await market.getPool(pair)
    console.log(poolData)

}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
