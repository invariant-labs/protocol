import { Staker, Network } from '../../sdk-staker/src'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { EndIncentive } from '../../sdk-staker/src/staker'

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const FOUNDER: PublicKey = new PublicKey('0')
const FOUNDER_TOKEN_ACCOUNT: PublicKey = new PublicKey('0')
const INCENTIVE: PublicKey = new PublicKey('0')
const INCENTIVE_TOKEN: PublicKey = new PublicKey('0')

const DEFINED: boolean = false

const main = async () => {
  const staker = await Staker.build(Network.DEV, provider.wallet, connection)

  const endIncentive: EndIncentive = {
    incentive: INCENTIVE,
    incentiveTokenAccount: INCENTIVE_TOKEN,
    incentiveToken: INCENTIVE_TOKEN,
    founderTokenAccount: FOUNDER_TOKEN_ACCOUNT,
    founder: FOUNDER
  }

  if (DEFINED) {
    await staker.endIncentive(endIncentive)
  }
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
