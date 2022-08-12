import { Staker, Network } from '../../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { BN } from '../../../staker-sdk/lib'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { CreateIncentive } from '../../../staker-sdk/src/staker'
import { getMarketAddress, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { MAINNET_TOKENS } from '@invariant-labs/sdk/src/network'

////////////////////  README  /////////////////////////////////
// 1. Default signer is local Keypair
// 2. Set reward and reward token decimal, default is 1
// 3. Set start time (number of seconds from current time), default is 0
// 4. Set end time (duration in seconds), default is 0
// 5. FOUNDER is local keypair
// 6. Choose pool tokens from MAINNET_TOKENS
// 7. Set founder token account
// 8. Set fee tier, default is 0.01%
// 9. Set incentive token(reward) from MAINNET_TOKENS
///////////////////////////////////////////////////////////////

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local('https://api.mainnet-beta.solana.com', {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(wallet)

const seconds = new Date().valueOf() / 1000
const currentTime = new BN(Math.floor(seconds))

// DEFINE ALL THESE VARS BEFORE EXECUTION
const REWARD_TOKEN_DECIMAL = 6
const REWARD: Decimal = { v: new BN(10).pow(new BN(REWARD_TOKEN_DECIMAL)).muln(1) }
const START_TIME: Decimal = { v: currentTime.add(new BN(0)) }
const END_TIME: Decimal = { v: currentTime.add(START_TIME.v).add(new BN(0)) }
const FOUNDER: PublicKey = wallet.publicKey
const TOKEN_A: PublicKey = new PublicKey('')
const TOKEN_B: PublicKey = new PublicKey('')
const FOUNDER_TOKEN_ACCOUNT = new PublicKey('')
const FEE_TIER = FEE_TIERS[0]
const INVARIANT = new PublicKey(getMarketAddress(Network.MAIN))
const INCENTIVE_TOKEN = new PublicKey('')

const main = async () => {
  const pair = new Pair(TOKEN_A, TOKEN_B, FEE_TIER)
  const staker = await Staker.build(Network.MAIN, signer, connection)
  const [poolAddress] = await pair.getAddressAndBump(INVARIANT)

  const incentiveParams: CreateIncentive = {
    reward: REWARD,
    startTime: START_TIME,
    endTime: END_TIME,
    pool: poolAddress,
    founder: FOUNDER,
    incentiveToken: INCENTIVE_TOKEN,
    founderTokenAccount: FOUNDER_TOKEN_ACCOUNT,
    invariant: INVARIANT
  }

  const { stringTx, incentive, incentiveToken } = await staker.createIncentive(incentiveParams)
  console.log('tx hash', stringTx)
  console.log('incentive address', incentive.toString())
  console.log('incentive token address', incentiveToken.toString())
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
