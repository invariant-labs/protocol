import { Staker, Network } from '../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { Market, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { CreateStake } from '../../staker-sdk/lib/staker'
import { getMarketAddress, Pair, MOCK_TOKENS } from '@invariant-labs/sdk'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { MINTER } from '../minter'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
const wallet = new Wallet(MINTER)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const OWNER: PublicKey = MINTER.publicKey
const INCENTIVE: PublicKey = new PublicKey('8Bhd6me9j6AS9N6f6BxRZkgsY9nBaEBzq2maoraTw91m')
const TOKEN_X: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_Y: PublicKey = new PublicKey(MOCK_TOKENS.SOL)
const POSITION_INDEX = 0
const INVARIANT = new PublicKey('D8Xd5VFXJeANivc4LXEzYqiE8q2CGVbjym5JiynPCP6J')
const FEE_TIER = FEE_TIERS[0]

const main = async () => {
  const staker = await Staker.build(Network.DEV, wallet, connection)
  const market = await Market.build(Network.DEV, wallet, connection)

  const pair = new Pair(TOKEN_X, TOKEN_Y, FEE_TIER)
  const [poolAddress] = await pair.getAddressAndBump(new PublicKey(getMarketAddress(Network.DEV)))
  const pool = await market.getPool(pair)
  const { positionAddress } = await market.getPositionAddress(OWNER, POSITION_INDEX)
  const position = await market.getPosition(OWNER, POSITION_INDEX)

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
    position: positionAddress,
    incentive: INCENTIVE,
    owner: OWNER,
    invariant: INVARIANT
  }

  await staker.createStake(market, update, createStake)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
