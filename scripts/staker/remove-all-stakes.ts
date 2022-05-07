import { Staker, Network } from '../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { MINTER } from '../minter'

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
const wallet = new Wallet(MINTER)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const FOUNDER: PublicKey = MINTER.publicKey
const INCENTIVE: PublicKey = new PublicKey('9X2p99zymwWpuJb7giF5rmbBLJAv5eDNA2zorpFEyJ4G')

const main = async () => {
  const staker = await Staker.build(Network.DEV, wallet, connection)

  await staker.removeAllStakes(INCENTIVE, FOUNDER)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
