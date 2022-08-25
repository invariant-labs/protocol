import { Provider, Wallet } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
import { MAINNET_TOKENS } from '@invariant-labs/sdk/lib/network'
import { getMarketAddress, Market, Network, Pair } from '@invariant-labs/sdk/src'
import {
  ApyRewardsParams,
  calculateUserDailyRewards,
  FEE_TIERS,
  getTokens,
  rewardsAPY,
  UserDailyRewardsParams
} from '@invariant-labs/sdk/src/utils'
import { getXfromLiquidity } from '@invariant-labs/sdk/lib/math'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(
  'https://tame-ancient-mountain.solana-mainnet.quiknode.pro/6a9a95bf7bbb108aea620e7ee4c1fd5e1b67cc62/',
  {
    skipPreflight: true
  }
)

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(wallet)

// DEFINE ALL THESE VARS BEFORE EXECUTION
// const FOUNDER: PublicKey = wallet.publicKey
// const FOUNDER_TOKEN_ACCOUNT: PublicKey = new PublicKey(
//   'BbCS6yDqbo6PjXCDFjBtt376P1a1WaZgYtu362eqsY2m'
// )
// const INCENTIVE: PublicKey = new PublicKey('9yAstgXzyM2qG2JpXjr7yJ5RsYomJopxiPqhsbpjAtUw')
// const INCENTIVE_TOKEN: PublicKey = new PublicKey(MAINNET_TOKENS.HBB)
// const INCENTIVE_TOKEN_ACCOUNT: PublicKey = new PublicKey(
//   'FBNC4ZmLWLnGAvHnPvhnFDFeiEgztGcAKJktBwUaYdmx'
// )
const TOKEN_USDC: PublicKey = new PublicKey(MAINNET_TOKENS.USDC)
const TOKEN_USDH: PublicKey = new PublicKey(MAINNET_TOKENS.USDH)
const INVARIANT = new PublicKey(getMarketAddress(Network.MAIN))
const FEE_TIER = FEE_TIERS[0]

const main = async () => {
  //const staker = await Staker.build(Network.MAIN, signer, connection)
  const market = await Market.build(Network.MAIN, signer, connection)
  const pair = new Pair(TOKEN_USDC, TOKEN_USDH, FEE_TIER)
  const [poolAddress] = await pair.getAddressAndBump(INVARIANT)
  const pool = await market.getPool(pair)
  console.log(pool.liquidity.v.toString())
  console.log(poolAddress.toString())
  const tokens = await market.getAllPoolLiquidityInTokens(poolAddress)
  console.log(tokens.toString())

  const paramsApy: ApyRewardsParams = {
    currentTickIndex: pool.currentTickIndex,
    currentLiquidity: pool.liquidity.v,
    allLiquidityInTokens: tokens,
    tickSpacing: 1, // 1
    rewardInUsd: 1100.5,
    tokenPrice: 0.9976,
    tokenDecimal: 6,
    duration: 15
  }

  const result = rewardsAPY(paramsApy)
  console.log('apy', result.apy)
  console.log('apySingleTick', result.apySingleTick)

  ////

  const paramsDailyReward: UserDailyRewardsParams = {
    poolLiquidity: pool.liquidity.v,
    currentTickIndex: pool.currentTickIndex,
    rewardInTokens: 5000,
    userLiquidity: pool.liquidity,
    duration: 15,
    lowerTickIndex: pool.currentTickIndex,
    upperTickIndex: pool.currentTickIndex + 1
  }

  const singleTickTokens = getTokens(
    pool.liquidity.v,
    pool.currentTickIndex,
    pool.currentTickIndex + 1
  )
  console.log('singleTickTokens', singleTickTokens.toString())
  // const dailyRewards = 1100.5 / 15
  // const dailyFactor = (dailyRewards * 1) / singleTickTokens.divn(1_000_000).toNumber()
  // console.log(dailyFactor)
  // const positionApy = Math.pow(dailyFactor + 1, 365) - 1
  // console.log('positionApy', positionApy)
  // 9yAstgXzyM2qG2JpXjr7yJ5RsYomJopxiPqhsbpjAtUw
  //const stakes = await staker.getAllIncentiveStakes(INCENTIVE)
  //const incentive = await staker.getIncentive(INCENTIVE)
  //const stake = await staker.getStake()

  // print all incentives address
  //console.log(stakes.length)
  //console.log(incentive.tokenAccount.toString())
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
