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
const INCENTIVE: PublicKey = new PublicKey('5ukyf8VQwvE3gJznGorUvPBoFgrisQe9dui8LFWCc9U5')
const TOKEN_X: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_Y: PublicKey = new PublicKey(MOCK_TOKENS.SOL)
const POSITION_INDEX = 0
const POSITION = new PublicKey('9bbq51zmVnS7XitBzs8xJwtje1QL9iDqy5zes6FvTYJG')

const main = async () => {
  const staker = await Staker.build(Network.DEV, wallet, connection)
  const market = await Market.build(Network.DEV, wallet, connection)

  const feeTier = FEE_TIERS[0]
  const pair = new Pair(TOKEN_X, TOKEN_Y, feeTier)
  const [poolAddress] = await pair.getAddressAndBump(new PublicKey(getMarketAddress(Network.DEV)))
  console.log('pool address', poolAddress.toString())
  const pool = await market.getPool(pair)
  const position = await market.getPosition(MINTER.publicKey, 0)
  const positionAddress = await market.getPositionAddress(MINTER.publicKey, 0)
  console.log('position', positionAddress.positionAddress.toString())

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
    position: POSITION,
    incentive: INCENTIVE,
    owner: OWNER,
    invariant: new PublicKey('9aiirQKPZ2peE9QrXYmsbTtR7wSDJi2HkQdHuaMpTpei')
  }

  await staker.createStake(market, update, createStake)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
