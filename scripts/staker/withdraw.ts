import { Staker, Network } from '../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { Market, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { Withdraw } from '../../staker-sdk/src/staker'
import { getMarketAddress, MOCK_TOKENS, Pair } from '@invariant-labs/sdk'
import { MINTER } from '../minter'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
const wallet = new Wallet(MINTER)
// @ts-expect-error
const payer = provider.wallet.payer as Keypair

// DEFINE ALL THESE VARS BEFORE EXECUTION
const OWNER: PublicKey = MINTER.publicKey
const OWNER_TOKEN_ACCOUNT = new PublicKey('7p7zjaPR7GViePr7sLt5PZC1jwJzUBoRY39seMVmowmP')
const INCENTIVE: PublicKey = new PublicKey('9X2p99zymwWpuJb7giF5rmbBLJAv5eDNA2zorpFEyJ4G')
const INCENTIVE_TOKEN: PublicKey = new PublicKey('Fw4CV1RQjLkgVYPdcsJnt4qDsNqbt2mUH2ogYMPYKwHf')
const POSITION_INDEX = 0
const TOKEN_X: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_Y: PublicKey = new PublicKey(MOCK_TOKENS.SOL)
const POSITION = new PublicKey('9bbq51zmVnS7XitBzs8xJwtje1QL9iDqy5zes6FvTYJG')

const main = async () => {
  const staker = await Staker.build(Network.DEV, wallet, connection)
  const market = await Market.build(Network.DEV, wallet, connection)
  const position = await market.getPosition(OWNER, POSITION_INDEX)
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(TOKEN_X, TOKEN_Y, feeTier)
  const [poolAddress] = await pair.getAddressAndBump(new PublicKey(getMarketAddress(Network.DEV)))
  const pool = await market.getPool(pair)
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, payer)
  const ownerTokenBalanceBefore = (await usdc.getAccountInfo(OWNER_TOKEN_ACCOUNT)).amount
  console.log('ownerTokenBalance', ownerTokenBalanceBefore.toString())
  const update: UpdateSecondsPerLiquidity = {
    pair,
    owner: OWNER,
    lowerTickIndex: position.lowerTickIndex,
    upperTickIndex: position.upperTickIndex,
    index: pool.currentTickIndex
  }
  const withdraw: Withdraw = {
    incentive: INCENTIVE,
    pool: poolAddress,
    id: position.id,
    position: POSITION,
    owner: OWNER,
    incentiveTokenAccount: INCENTIVE_TOKEN,
    ownerTokenAcc: OWNER_TOKEN_ACCOUNT,
    index: POSITION_INDEX
  }
  const hashTx = await staker.withdraw(market, update, withdraw)
  console.log('hashTx', hashTx)
  const ownerTokenBalanceAfter = (await usdc.getAccountInfo(OWNER_TOKEN_ACCOUNT)).amount
  console.log('ownerTokenBalanceAfter', ownerTokenBalanceAfter.toString())
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
