import { Staker, Network } from '../../../staker-sdk/lib'
import { Provider, Wallet } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { EndIncentive } from '../../../staker-sdk/src/staker'
import { MAINNET_TOKENS } from '@invariant-labs/sdk/lib/network'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(
  'https://tame-ancient-mountain.solana-mainnet.quiknode.pro/6a9a95bf7bbb108aea620e7ee4c1fd5e1b67cc62/',
  {
    skipPreflight: true
  }
)

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(wallet)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const FOUNDER: PublicKey = wallet.publicKey
const FOUNDER_TOKEN_ACCOUNT: PublicKey = new PublicKey('')
const INCENTIVE: PublicKey = new PublicKey('')
const INCENTIVE_TOKEN: PublicKey = new PublicKey(MAINNET_TOKENS.USDC)
const INCENTIVE_TOKEN_ACCOUNT: PublicKey = new PublicKey('')
const main = async () => {
  const staker = await Staker.build(Network.MAIN, signer, connection)

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
