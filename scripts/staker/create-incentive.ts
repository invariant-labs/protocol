import { Staker, Network } from '../../sdk-staker/src/'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { BN } from '../../sdk-staker/lib'
import { Decimal } from '@invariant-labs/sdk/lib/market'
import { CreateIncentive } from '../../sdk-staker/src/staker'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const REWARD: Decimal = { v: new BN(0) }
const START_TIME: BN = new BN(0)
const END_TIME: BN = new BN(0)
const POOL: PublicKey = new PublicKey('0')
const FOUNDER: PublicKey = new PublicKey('0')
const INCENTIVE_TOKEN: PublicKey = new PublicKey('0')
const FOUNDER_TOKEN_ACC: PublicKey = new PublicKey('0')
const INVARIANT: PublicKey = new PublicKey('0')

const DEFINED: boolean = false

const main = async () => {
  const staker = await Staker.build(Network.DEV, provider.wallet, connection)

  const incentiveParams: CreateIncentive = {
    reward: REWARD,
    startTime: START_TIME,
    endTime: END_TIME,
    pool: POOL,
    founder: FOUNDER,
    incentiveToken: INCENTIVE_TOKEN,
    founderTokenAccount: FOUNDER_TOKEN_ACC,
    invariant: INVARIANT
  }

  if (DEFINED) {
    await staker.createIncentive(incentiveParams)
  }
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
