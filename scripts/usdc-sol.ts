import { BN, Provider } from '@coral-xyz/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { getLiquidityByX } from '@invariant-labs/sdk/src/math'
import {
  FEE_TIERS,
  fromFee,
  PRICE_DENOMINATOR,
  toDecimal,
  tou64
} from '@invariant-labs/sdk/src/utils'
import { CreatePool, Decimal, InitPosition } from '@invariant-labs/sdk/src/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  // CREATE POOL
  const initTick = 16000
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

  // const createPoolVars: CreatePool = {
  //   pair,
  //   payer: wallet,
  //   protocolFee,
  //   tokenX,
  //   tokenY,
  //   initTick
  // }
  // await market.createPool(createPoolVars)

  // ADD LIQUIDITY
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const sol = new Token(connection, new PublicKey(MOCK_TOKENS.SOL), TOKEN_PROGRAM_ID, wallet)
  //const minterUsdc = await usdc.createAccount(MINTER.publicKey)
  const minterSol = await sol.createAccount(MINTER.publicKey)

  const pool = await market.getPool(pair)
  const usdcAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USD
  const lowerTick = -10
  const upperTick = 10

  const { liquidity, y: solAmount } = getLiquidityByX(
    usdcAmount,
    lowerTick,
    upperTick,
    pool.sqrtPrice,
    true
  )
  console.log(`usdc = ${usdcAmount.toString()}`)
  console.log(`sol = ${solAmount.toString()}`)
  //console.log('minterUsdc', minterUsdc.toString())
  await usdc.mintTo(
    new PublicKey('7p7zjaPR7GViePr7sLt5PZC1jwJzUBoRY39seMVmowmP'),
    MINTER,
    [],
    100000
  )
  //await sol.mintTo(minterSol, MINTER, [], tou64(solAmount))

  // const initPositionVars: InitPosition = {
  //   pair,
  //   owner: MINTER.publicKey,
  //   userTokenX: minterUsdc,
  //   userTokenY: minterSol,
  //   lowerTick,
  //   upperTick,
  //   liquidityDelta: liquidity,
  //   knownPrice: { v: PRICE_DENOMINATOR },
  //   slippage: toDecimal(2, 2)
  // }
  // await market.initPosition(initPositionVars, MINTER)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
