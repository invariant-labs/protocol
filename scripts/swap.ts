import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider } from '@coral-xyz/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { createAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS, fromFee, tou64 } from '@invariant-labs/sdk/src/utils'
import { Swap } from '@invariant-labs/sdk/src/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = AnchorProvider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection

// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  const pair = new Pair(
    new PublicKey(MOCK_TOKENS.USDC),
    new PublicKey(MOCK_TOKENS.USDT),
    FEE_TIERS[0]
  )

  const minterUsdc = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    MINTER.publicKey
  )
  const minterUsdt = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDT),
    MINTER.publicKey
  )
  const amount = 10 ** 4

  await mintTo(
    connection,
    MINTER,
    new PublicKey(MOCK_TOKENS.USDC),
    minterUsdc,
    MINTER.publicKey,
    2 * amount
  )
  await mintTo(
    connection,
    MINTER,
    new PublicKey(MOCK_TOKENS.USDT),
    minterUsdt,
    MINTER.publicKey,
    2 * amount
  )

  const pool = await market.getPool(pair)

  const swapVars: Swap = {
    xToY: false,
    accountX: minterUsdt,
    accountY: minterUsdc,
    amount: tou64(amount),
    byAmountIn: true,
    estimatedPriceAfterSwap: pool.sqrtPrice,
    slippage: { v: fromFee(new anchor.BN(1000)) },
    pair,
    owner: MINTER.publicKey
  }
  await market.swap(swapVars, MINTER)
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
