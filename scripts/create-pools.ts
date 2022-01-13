import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS, fromFee } from '@invariant-labs/sdk/src/utils'
import { CreatePool, Decimal } from '@invariant-labs/sdk/src/market'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from '../sdk-staker/lib'
import { createPool } from '../tests/testUtils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const feeTier = FEE_TIERS[0]

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  await createUsdcUsdt(market)
  await createUsdcSol(market)
  await createMsolSol(market)
}
const createUsdcUsdt = async (market: Market) => {
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.USDT), feeTier)
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

  const createPoolVars: CreatePool = {
    pair,
    payer: wallet,
    protocolFee,
    tokenX,
    tokenY
  }
  await createPool(market, createPoolVars)
}
const createUsdcSol = async (market: Market) => {
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

  const createPoolVars: CreatePool = {
    pair,
    payer: wallet,
    protocolFee,
    tokenX,
    tokenY,
    initTick: 18000
  }
  await createPool(market, createPoolVars)
}

const createMsolSol = async (market: Market) => {
  const pair = new Pair(new PublicKey(MOCK_TOKENS.MSOL), new PublicKey(MOCK_TOKENS.SOL), feeTier)
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

  const createPoolVars: CreatePool = {
    pair,
    payer: wallet,
    protocolFee,
    tokenX,
    tokenY,
    initTick: 200
  }
  await createPool(market, createPoolVars)
}

main()
