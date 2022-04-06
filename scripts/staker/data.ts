import { Staker, Network } from '../../staker-sdk/src'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { BN } from '../../staker-sdk/lib'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { CreateIncentive } from '../../staker-sdk/src/staker'
import {
  getMarketAddress,
  MAX_TICK,
  MOCK_TOKENS,
  PRICE_DENOMINATOR,
  tou64
} from '@invariant-labs/sdk'
import { InitPosition, PoolStructure } from '@invariant-labs/sdk/src/market'
import { feeToTickSpacing, FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { MINTER } from '../minter'
import { getLiquidityByY } from '@invariant-labs/sdk/src/math'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
const feeTier = FEE_TIERS[0]

const upperTick = 0
const lowerTick = -MAX_TICK + (MAX_TICK % (feeTier.tickSpacing ?? feeToTickSpacing(feeTier.fee)))
const amount = new BN(9e6).muln(1e6)
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  //const staker = await Staker.build(Network.DEV, provider.wallet, connection)
  const market = await Market.build(Network.DEV, provider.wallet, connection)
  //console.log(MINTER.publicKey.toString())
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)
  // const pool = await market.getPool(pair)
  // console.log(pool.currentTickIndex)
  // console.log(pool.tickSpacing)
  const positionAddress = await market.getPositionAddress(MINTER.publicKey, 0)
  const position = await market.getPosition(MINTER.publicKey, 0)
  console.log(position.id.toString())
  console.log(positionAddress.positionAddress.toString())
  //await usdcWsolCreatePosition(market)
  //const position = await market.getPositionAddress(MINTER.publicKey, 0)
  // console.log(position.positionAddress.toString())
  //const poolStructure: PoolStructure[] = await market.getPositionAddress()
  // console.log(poolStructure[])
  // console.log('here')
  //const pool = market.getPool
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()

const usdcWsolCreatePosition = async (market: Market) => {
  console.log('creating accounts...')
  const pair = new Pair(
    new PublicKey(MOCK_TOKENS.USDC),
    new PublicKey(MOCK_TOKENS.WSOL),
    FEE_TIERS[0]
  )
  console.log(
    `is token A first?: ${pair.tokenX.equals(new PublicKey(MOCK_TOKENS.USDC)).toString()}`
  )
  if (!pair.tokenX.equals(new PublicKey(MOCK_TOKENS.USDC))) {
    throw new Error('tokens are in reverse order, ticks should be opposite')
  }

  const tokenX = new Token(connection, new PublicKey(pair.tokenX), TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, new PublicKey(pair.tokenY), TOKEN_PROGRAM_ID, wallet)

  const [minterX, minterY] = await Promise.all([
    tokenX.createAccount(MINTER.publicKey),
    tokenY.createAccount(MINTER.publicKey)
  ])

  console.log('minting tokens...')
  await Promise.all([
    // tokenX.mintTo(minterX, MINTER, [], amount),
    tokenY.mintTo(minterY, MINTER, [], tou64(amount))
  ])

  console.log('calculating position...')

  const y = amount
  const pool = await market.getPool(pair)
  const { liquidity } = getLiquidityByY(y, lowerTick, upperTick, pool.sqrtPrice, true)

  console.log('creating position...')
  const initPositionVars: InitPosition = {
    pair,
    owner: MINTER.publicKey,
    userTokenX: minterX,
    userTokenY: minterY,
    lowerTick,
    upperTick,
    liquidityDelta: liquidity,
    knownPrice: { v: PRICE_DENOMINATOR },
    slippage: { v: new BN(0) }
  }
  await market.initPosition(initPositionVars, MINTER)
  console.log('done')
}
