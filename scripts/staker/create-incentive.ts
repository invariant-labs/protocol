import { Staker, Network } from '../../staker-sdk/src/'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { BN } from '../../staker-sdk/lib'
import { Decimal } from '@invariant-labs/sdk/lib/market'
import { CreateIncentive } from '../../staker-sdk/src/staker'
import { getMarketAddress, MOCK_TOKENS, Pair } from '@invariant-labs/sdk'
import { MINTER } from '../minter'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const wallet = new Wallet(MINTER)
const connection = provider.connection
const seconds = new Date().valueOf() / 1000
const currentTime = new BN(Math.floor(seconds))

// DEFINE ALL THESE VARS BEFORE EXECUTION
const REWARD: Decimal = { v: new BN(1000000000) }
const START_TIME: Decimal = { v: currentTime.add(new BN(10)) }
const END_TIME: Decimal = { v: currentTime.add(new BN(3600 * 24 * 30)) }
const FOUNDER: PublicKey = MINTER.publicKey
const TOKEN_X: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_Y: PublicKey = new PublicKey(MOCK_TOKENS.WSOL)
const FOUNDER_TOKEN_ACCOUNT = new PublicKey('2KUpBdCYnbd2uCaK6BC8z5JHZ6ZM9N6xeGGUUvMY6hiT') // define founder token account
const FEE_TIER = FEE_TIERS[0]
const INVARIANT = new PublicKey('9aiirQKPZ2peE9QrXYmsbTtR7wSDJi2HkQdHuaMpTpei')
const INCENTIVE_TOKEN = new PublicKey(MOCK_TOKENS.USDC)

const main = async () => {
  const pair = new Pair(TOKEN_X, TOKEN_Y, FEE_TIER)
  const staker = await Staker.build(Network.DEV, wallet, connection)
  const [poolAddress] = await pair.getAddressAndBump(new PublicKey(getMarketAddress(Network.DEV)))

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

  //staker.createIncentiveIx
  const { stringTx, incentive, incentiveToken } = await staker.createIncentive(incentiveParams)
  console.log('tx hash', stringTx)
  console.log('incentive address', incentive.toString())
  console.log('incentive token address', incentiveToken.toString())
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
