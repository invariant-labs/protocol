import { Staker, Network } from '../../staker-sdk/src/'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { BN } from '../../staker-sdk/lib'
import { Decimal, Market } from '@invariant-labs/sdk/lib/market'
import { CreateIncentive } from '../../staker-sdk/src/staker'
import { getMarketAddress, MOCK_TOKENS, Pair } from '@invariant-labs/sdk'
import { MINTER } from '../minter'
import { createToken } from '../../tests-staker/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const wallet = new Wallet(MINTER)
// @ts-expect-error
const payer = provider.wallet.payer as Keypair
const connection = provider.connection
const seconds = new Date().valueOf() / 1000
const currentTime = new BN(Math.floor(seconds))
console.log(MINTER.publicKey.toString())

//create token

//const founderTokenAccount = await incentiveToken.createAccount(MINTER.publicKey)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const REWARD: Decimal = { v: new BN(10) }
const START_TIME: Decimal = { v: currentTime.add(new BN(10)) }
const END_TIME: Decimal = { v: currentTime.add(new BN(10000)) }
//const POOL: PublicKey = new PublicKey('0')
const FOUNDER: PublicKey = MINTER.publicKey
//const INCENTIVE_TOKEN: PublicKey = incentiveToken.publicKey
//const FOUNDER_TOKEN_ACC: PublicKey = new PublicKey('0')

const main = async () => {
  //const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, payer)
  //const wsol = new Token(connection, new PublicKey(MOCK_TOKENS.WSOL), TOKEN_PROGRAM_ID, wallet)
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)

  //const market = await Market.build(Network.DEV, provider.wallet, connection)
  const staker = await Staker.build(Network.DEV, wallet, connection)
  const [poolAddress] = await pair.getAddressAndBump(new PublicKey(getMarketAddress(Network.DEV)))
  console.log('pool address', poolAddress.toString())
  const founderTokenAccount = new PublicKey('7p7zjaPR7GViePr7sLt5PZC1jwJzUBoRY39seMVmowmP')

  const incentiveParams: CreateIncentive = {
    reward: REWARD,
    startTime: START_TIME,
    endTime: END_TIME,
    pool: poolAddress,
    founder: FOUNDER,
    incentiveToken: new PublicKey(MOCK_TOKENS.USDC),
    founderTokenAccount: founderTokenAccount,
    invariant: new PublicKey('9aiirQKPZ2peE9QrXYmsbTtR7wSDJi2HkQdHuaMpTpei')
  }

  //staker.createIncentiveIx
  const { stringTx, incentive, incentiveToken } = await staker.createIncentive(incentiveParams)
  console.log(stringTx)
  console.log(incentive.toString())
  console.log(incentiveToken.toString())
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
