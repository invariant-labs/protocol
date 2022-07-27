import { Staker, Network } from '../../staker-sdk/src/'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { BN } from '../../staker-sdk/lib'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { CreateIncentive } from '../../staker-sdk/src/staker'
import { getMarketAddress, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { MAINNET_TOKENS } from '@invariant-labs/sdk/src/network'

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
const REWARD: Decimal = { v: new BN(10).pow(new BN(6)).muln(14000) } // amount of HBB token
const START_TIME: Decimal = { v: currentTime.add(new BN(0)) }
const END_TIME: Decimal = { v: currentTime.add(new BN(3600 * 24 * 14)) } // 2 weeks
const FOUNDER: PublicKey = wallet.publicKey
const TOKEN_USDC: PublicKey = new PublicKey(MAINNET_TOKENS.USDC)
const TOKEN_USDH: PublicKey = new PublicKey(MAINNET_TOKENS.USDH)
const FOUNDER_TOKEN_ACCOUNT = new PublicKey('BbCS6yDqbo6PjXCDFjBtt376P1a1WaZgYtu362eqsY2m') // define founder token account
const FEE_TIER = FEE_TIERS[0] // 0.01%
const INVARIANT = new PublicKey(getMarketAddress(Network.MAIN))
const INCENTIVE_TOKEN = new PublicKey(MAINNET_TOKENS.HBB)

const main = async () => {
  const pair = new Pair(TOKEN_USDC, TOKEN_USDH, FEE_TIER)
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
