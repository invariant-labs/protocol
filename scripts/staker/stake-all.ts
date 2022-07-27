import { Staker, Network } from '../../staker-sdk/src'
import { Provider, utils, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { Market, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { CreateStake } from '../../staker-sdk/lib/staker'
import { getMarketAddress, Pair, MOCK_TOKENS } from '@invariant-labs/sdk/src'
import { FEE_TIERS, getPositionIndex } from '@invariant-labs/sdk/src/utils'
import { MAINNET_TOKENS } from '@invariant-labs/sdk/lib/network'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local('https://api.mainnet-beta.solana.com', {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(wallet)

// DEFINE ALL THESE VARS BEFORE EXECUTION
const INCENTIVE: PublicKey = new PublicKey('EfAJjXZppDeQPRpfjkndsPjUrp6hjcMuACHhghNmYE1t')
const TOKEN_USDC: PublicKey = new PublicKey(MAINNET_TOKENS.USDC)
const TOKEN_USDT: PublicKey = new PublicKey(MAINNET_TOKENS.USDH)
const INVARIANT = new PublicKey(getMarketAddress(Network.MAIN))
const FEE_TIER = FEE_TIERS[0]

const main = async () => {
  const staker = await Staker.build(Network.MAIN, signer, connection)
  const market = await Market.build(Network.MAIN, signer, connection)

  const pair = new Pair(TOKEN_USDC, TOKEN_USDT, FEE_TIER)
  const [poolAddress] = await pair.getAddressAndBump(INVARIANT)
  const pool = await market.getPool(pair)
  const positions = await market.getPositionsForPool(poolAddress)

  for (const position of positions) {
    const index = await getPositionIndex(position.address, INVARIANT, position.owner)
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: position.owner,
      signer: signer.publicKey,
      lowerTickIndex: position.lowerTickIndex,
      upperTickIndex: position.upperTickIndex,
      index
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: position.id,
      index,
      position: position.address,
      incentive: INCENTIVE,
      owner: position.owner,
      signer: signer.publicKey,
      invariant: INVARIANT
    }

    const result = await staker.createStake(market, update, createStake)
    console.log(`Created stake `, result.stringTx)
  }
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
