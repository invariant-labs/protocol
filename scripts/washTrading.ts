import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { FEE_TIERS, toDecimal } from '@invariant-labs/sdk/src/utils'
import { Swap } from '@invariant-labs/sdk/src/market'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  commitment: 'confirmed',
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
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  const accountX = await tokenX.createAccount(MINTER.publicKey)
  const accountY = await tokenY.createAccount(MINTER.publicKey)

  while (true) {
    const amount = Math.floor(Math.random() * 1000000) + 1000000 // amount should be between 1000 and 2000

    const side = Math.random() > 0.5

    if (side) {
      await tokenX.mintTo(accountX, MINTER, [], tou64(amount))
    } else {
      await tokenY.mintTo(accountY, MINTER, [], tou64(amount))
    }

    const pool = await market.getPool(pair)

    console.log(`swap ${side ? 'x -> y' : 'y -> x'}: ${amount}`)

    const swapVars: Swap = {
      xToY: side,
      accountX: accountX,
      accountY: accountY,
      amount: tou64(amount),
      byAmountIn: true,
      knownPrice: pool.sqrtPrice,
      slippage: toDecimal(2, 2),
      pair,
      owner: MINTER.publicKey
    }
    await market.swap(swapVars, MINTER)
  }
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
