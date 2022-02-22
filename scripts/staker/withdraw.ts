import { Staker, Network } from '../../sdk-staker/src'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { BN } from '../../sdk-staker/lib'
import {
  FeeTier,
  Market,
  PoolStructure,
  UpdateSecondsPerLiquidity
} from '@invariant-labs/sdk/src/market'
import { Withdraw } from '../../sdk-staker/src/staker'
import { getMarketAddress, Pair } from '@invariant-labs/sdk'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const POOL: PublicKey = new PublicKey('0')
const OWNER: PublicKey = new PublicKey('0')
const POSITION: PublicKey = new PublicKey('0')
const INCENTIVE: PublicKey = new PublicKey('0')
const INCENTIVE_TOKEN: PublicKey = new PublicKey('0')
const POSITION_INDEX = 0

const DEFINED: boolean = false

const main = async () => {
  const staker = await Staker.build(Network.DEV, provider.wallet, connection)
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  const position = await market.getPosition(POSITION, POSITION_INDEX)
  const pool = (await market.program.account.pool.fetch(POOL)) as PoolStructure
  const feeTier: FeeTier = {
    fee: new BN(pool.fee.v),
    tickSpacing: pool.tickSpacing
  }
  const pair = new Pair(pool.tokenXReserve, pool.tokenXReserve, feeTier)

  const update: UpdateSecondsPerLiquidity = {
    pair,
    owner: OWNER,
    lowerTickIndex: position.lowerTickIndex,
    upperTickIndex: position.upperTickIndex,
    index: pool.currentTickIndex
  }
  const withdraw: Withdraw = {
    incentive: INCENTIVE,
    pool: POOL,
    id: position.id,
    position: POSITION,
    owner: OWNER,
    incentiveTokenAccount: INCENTIVE_TOKEN,
    ownerTokenAcc: OWNER,
    index: POSITION_INDEX
  }

  if (DEFINED) {
    await staker.withdraw(market, update, withdraw)
  }
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
