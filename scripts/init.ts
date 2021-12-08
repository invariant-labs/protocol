import { FEE_TIER } from '@invariant-labs/sdk'
import { Market, Network } from '@invariant-labs/sdk/src'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { FEE_TIERS, fromFee } from '@invariant-labs/sdk/src/utils'
import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair } from '@solana/web3.js'
import { MINTER } from './minter'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
    skipPreflight: true
})
const createStandardFeeTiers = async (market: Market, payer: Keypair) => {
    Promise.all(
        FEE_TIERS.map(async (feeTier) => {
            await market.createFeeTier(feeTier, payer)
        })
    )
}

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
    const market = await Market.build(Network.DEV, provider.wallet, connection)
    const protocolFee: Decimal = { v: fromFee(new anchor.BN(10000)) }

    await market.createState(MINTER, protocolFee)
    await createStandardFeeTiers(market, MINTER)
}
main()
