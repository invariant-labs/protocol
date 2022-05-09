import { Staker, Network } from '../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { EndIncentive } from '../../staker-sdk/src/staker'
import { MINTER } from '../minter'
import { MOCK_TOKENS } from '@invariant-labs/sdk'

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
const wallet = new Wallet(MINTER)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const FOUNDER: PublicKey = new PublicKey(MINTER.publicKey)
const FOUNDER_TOKEN_ACCOUNT: PublicKey = new PublicKey(
  '7p7zjaPR7GViePr7sLt5PZC1jwJzUBoRY39seMVmowmP'
)
const INCENTIVE: PublicKey = new PublicKey('12GvxJpZ8ZLCwbafEWg5s15Ys5iFqhH4vdaw31HYQv5Q')
const INCENTIVE_TOKEN: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const INCENTIVE_TOKEN_ACCOUNT: PublicKey = new PublicKey(
  'FvgniRRatzmcjLqFsRk9BvPhYBQq2gs4AjoX6Dxtx5tp'
)
const main = async () => {
  const staker = await Staker.build(Network.DEV, wallet, connection)

  const endIncentive: EndIncentive = {
    incentive: INCENTIVE,
    incentiveTokenAccount: INCENTIVE_TOKEN_ACCOUNT,
    incentiveToken: INCENTIVE_TOKEN,
    founderTokenAccount: FOUNDER_TOKEN_ACCOUNT,
    founder: FOUNDER
  }

  await staker.endIncentive(endIncentive)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
