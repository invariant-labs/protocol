import { Staker, Network } from '../../sdk-staker/src'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const FOUNDER: PublicKey = new PublicKey('0')
const INCENTIVE: PublicKey = new PublicKey('0')

const DEFINED: boolean = false

const main = async () => {
  const staker = await Staker.build(Network.DEV, provider.wallet, connection)

  if (DEFINED) {
    await staker.removeAllStakes(INCENTIVE, FOUNDER)
  }
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
