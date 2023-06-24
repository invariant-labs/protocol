import { Provider } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
import { Network } from '@invariant-labs/sdk/src/network'
import { Market } from '@invariant-labs/sdk/src'
import { PoolStructure } from '@invariant-labs/sdk/lib/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local('https://solana-mainnet.g.alchemy.com/v2/olFft01iKDVd2zzpVgTiCc2oKQnic3vs', {
    skipPreflight: true
})
const connection = provider.connection
const poolAddress = new PublicKey("3vRuk97EaKACp1Z337PvVWNdab57hbDwefdi1zoUg46D")

const main = async () => {
    const market = await Market.build(Network.MAIN, provider.wallet, connection)
    const allPools = await market.program.account.pool.all([])

    let pool = allPools.find((pool) => pool.publicKey.equals(poolAddress))?.account as any as PoolStructure;

    // tokenX = USDC | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    // tokenY = SOL1 | So11111111111111111111111111111111111111112

    console.log(pool.tokenX.toString())
    console.log(pool.tokenY.toString())
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
