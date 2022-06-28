import { Market, Network } from '@invariant-labs/sdk/src'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('mainnet-beta'), {
  skipPreflight: true
})

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.MAIN, provider.wallet, connection)

  const positions = await market.getAllUserPositions(
    new PublicKey('JDn5Ttup4ur8aeH2cs5vf6HBE2nqRgZwea9c3bbv75Dj')
  )
  console.log('length', positions.length)
  for (const position of positions) {
    console.log('########################################')
    console.log('token X pubkey', position.tokenX.toString())
    console.log('token Y pubkey', position.tokenY.toString())
    console.log('fee', position.feeTier.fee.toString())
    console.log('amount X', position.amountTokenX.toString())
    console.log('amount Y', position.amountTokenY.toString())
    console.log('lower price', position.lowerPrice.v.toString())
    console.log('upper price', position.upperPrice.v.toString())
    console.log('unclaimed fee X', position.unclaimedFeesX.toString())
    console.log('unclaimed fee Y', position.unclaimedFeesY.toString())
    console.log('########################################')
  }
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
