import { BN, Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { getLiquidityByX } from '@invariant-labs/sdk/src/tick'
import { FEE_TIERS, tou64 } from '@invariant-labs/sdk/src/utils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
const market = new Market(Network.DEV, provider.wallet, connection)
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const feeTier = FEE_TIERS[0]
  const pair = new Pair(new PublicKey(MOCK_TOKENS.USDC), new PublicKey(MOCK_TOKENS.SOL), feeTier)

  // CREATE POOL
  const initTick = 16000

  await market.create({
    pair,
    signer: wallet,
    feeTier,
    initTick
  })

  // TICKS
  await market.createTicksFromRange(pair, wallet, 15960, 16040)

  // ADD LIQUIDITY
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const sol = new Token(connection, new PublicKey(MOCK_TOKENS.SOL), TOKEN_PROGRAM_ID, wallet)
  const minterUsdc = await usdc.createAccount(MINTER.publicKey)
  const minterSol = await sol.createAccount(MINTER.publicKey)

  const pool = await market.getPool(pair)
  const usdcAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USD
  const lowerTick = 15996
  const upperTick = 16004

  const { liquidity, y: solAmount } = getLiquidityByX(
    usdcAmount,
    lowerTick,
    upperTick,
    pool.sqrtPrice,
    true
  )
  console.log(`usdc = ${usdcAmount.toString()}`)
  console.log(`sol = ${solAmount.toString()}`)

  await usdc.mintTo(minterUsdc, MINTER, [], tou64(usdcAmount))
  await sol.mintTo(minterSol, MINTER, [], tou64(solAmount))

  await market.initPosition(
    {
      pair,
      owner: MINTER.publicKey,
      userTokenX: minterUsdc,
      userTokenY: minterSol,
      lowerTick,
      upperTick,
      liquidityDelta: liquidity
    },
    MINTER
  )
}
main()
