import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { FEE_TIERS, fromFee } from '@invariant-labs/sdk/src/utils'
import { Swap } from '@invariant-labs/sdk/src/market'
import { swap } from '../tests/testUtils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
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
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const usdt = new Token(connection, new PublicKey(MOCK_TOKENS.USDT), TOKEN_PROGRAM_ID, wallet)
  const minterUsdc = await usdc.createAccount(MINTER.publicKey)
  const minterUsdt = await usdt.createAccount(MINTER.publicKey)
  const amount = 10 ** 4

  await usdc.mintTo(minterUsdc, MINTER, [], tou64(2 * amount))
  await usdt.mintTo(minterUsdt, MINTER, [], tou64(2 * amount))

  const pool = await market.getPool(pair)

  const swapVars: Swap = {
    xToY: false,
      accountX: minterUsdt,
      accountY: minterUsdc,
      amount: tou64(amount),
      byAmountIn: true,
      knownPrice: pool.sqrtPrice,
      slippage: { v: fromFee(new anchor.BN(1000)) },
      pair,
      owner: MINTER.publicKey
  }
  await swap(market, swapVars, MINTER)
}
main()
