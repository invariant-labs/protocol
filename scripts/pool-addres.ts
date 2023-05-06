import { getMarketAddress } from '@invariant-labs/sdk'
import { Network, Pair } from '@invariant-labs/sdk/src'
import { fromFee } from '@invariant-labs/sdk/src/utils'
import { BN } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'

const usdc = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const taco = new PublicKey('5Q7EfoEzqDeYZRoqxvcdUjKx8hfQswyxPNdZAr3pwuCu')

const main = async () => {
    const marketAddress = new PublicKey(getMarketAddress(Network.MAIN))
    const feeTier = { fee: fromFee(new BN(5000)), tickSpacing: 5 }

    const pair = new Pair(usdc, taco, feeTier)
    const address = await pair.getAddress(marketAddress)
    console.log(`address: ${address}`)

}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
