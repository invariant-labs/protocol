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
import { CreateStake } from '../../sdk-staker/lib/staker'
import { getMarketAddress, Pair } from '@invariant-labs/sdk'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const OWNER: PublicKey = new PublicKey('0')
const INCENTIVE: PublicKey = new PublicKey('0')
const TOKEN_X: PublicKey = new PublicKey('0')
const TOKEN_Y: PublicKey = new PublicKey('0')
const POSITION_INDEX = 0

const main = async () => {
  const staker = await Staker.build(Network.DEV, provider.wallet, connection)
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  const position = await market.getPosition(OWNER, POSITION_INDEX)
  //const pool = (await market.program.account.pool.fetch(POOL)) as PoolStructure
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(TOKEN_X, TOKEN_Y, feeTier)
  const [poolAddress] = await pair.getAddressAndBump(market.program.programId)
  const pool = await market.getPool(pair)

  const update: UpdateSecondsPerLiquidity = {
    pair,
    owner: OWNER,
    lowerTickIndex: position.lowerTickIndex,
    upperTickIndex: position.upperTickIndex,
    index: pool.currentTickIndex
  }
  const createStake: CreateStake = {
    pool: poolAddress,
    id: position.id,
    index: POSITION_INDEX,
    position: market.getPositionAddress(OWNER, POSITION_INDEX),
    incentive: INCENTIVE,
    owner: OWNER,
    invariant: new PublicKey(getMarketAddress(Network.DEV))
  }

  await staker.createStake(market, update, createStake)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
