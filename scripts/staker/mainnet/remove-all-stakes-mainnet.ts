import { Staker, Network } from '../../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
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
const INCENTIVE: PublicKey = new PublicKey('')

const main = async () => {
  const staker = await Staker.build(Network.MAIN, signer, connection)

  await staker.removeAllStakes(INCENTIVE, FOUNDER)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
