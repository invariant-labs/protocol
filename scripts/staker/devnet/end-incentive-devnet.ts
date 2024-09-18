import { Provider, Wallet } from '@coral-xyz/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS } from '@invariant-labs/sdk'
import { EndIncentive, Staker } from '../../../staker-sdk/src/staker'
import { Network } from '../../../staker-sdk/src'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(wallet)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const FOUNDER: PublicKey = wallet.publicKey
const FOUNDER_TOKEN_ACCOUNT: PublicKey = new PublicKey(
  'tLeyLk6PexmoupDg67PMa9q8YnE3Fu1fwhALXg4XtXz'
)
const INCENTIVE: PublicKey = new PublicKey('')
const INCENTIVE_TOKEN: PublicKey = new PublicKey(MOCK_TOKENS.HBB)
const INCENTIVE_TOKEN_ACCOUNT: PublicKey = new PublicKey('')
const main = async () => {
  const staker = await Staker.build(Network.DEV, signer, connection)

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
