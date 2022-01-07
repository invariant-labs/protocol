import { Provider, BN } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { feeToTickSpacing, FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { MAX_TICK } from '@invariant-labs/sdk'
import { getLiquidityByY } from '@invariant-labs/sdk/lib/math'
import { InitPosition } from '@invariant-labs/sdk/src/market'
import { initPosition } from '../tests/testUtils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const feeTier = FEE_TIERS[0]
const tokenA = MOCK_TOKENS.USDC
const tokenB = MOCK_TOKENS.ANA
const upperTick = 0
const lowerTick = -MAX_TICK + (MAX_TICK % (feeTier.tickSpacing ?? feeToTickSpacing(feeTier.fee)))
const amount = new BN(9e6).muln(1e6)

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  await usdtUsdcCreatePosition(market)
}

const usdtUsdcCreatePosition = async (market: Market) => {
  console.log('creating accounts...')
  const pair = new Pair(new PublicKey(tokenA), new PublicKey(tokenB), FEE_TIERS[0])
  console.log(`is token A first?: ${pair.tokenX.equals(new PublicKey(tokenA))}`)
  if (!pair.tokenX.equals(new PublicKey(tokenA)))
    throw new Error('tokens are in reverse order, ticks should be opposite')

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
    liquidityDelta: liquidity
  }
  await initPosition(market, initPositionVars, MINTER)
  console.log('done')
}

main()
