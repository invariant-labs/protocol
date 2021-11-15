import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromInteger, Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { getLiquidityByX } from '@invariant-labs/sdk/src/tick'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
const market = new Market(Network.DEV, provider.wallet, connection)
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const pair = new Pair(
    new PublicKey(MOCK_TOKENS.USDC),
    new PublicKey(MOCK_TOKENS.USDT),
    FEE_TIERS[0]
  )
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const usdt = new Token(connection, new PublicKey(MOCK_TOKENS.USDT), TOKEN_PROGRAM_ID, wallet)
  const minterUsdc = await usdc.createAccount(MINTER.publicKey)
  const minterUsdt = await usdt.createAccount(MINTER.publicKey)
  const amount = tou64(1000 * 10 ** 6)

  await usdc.mintTo(minterUsdc, MINTER, [], amount)
  await usdt.mintTo(minterUsdt, MINTER, [], amount)

  // await market.createPositionList(MINTER)

  const x = new anchor.BN(500 * 10 ** 6)
  const lowerTick = -4
  const upperTick = 4
  const pool = await market.getPool(pair)

  const { liquidity } = getLiquidityByX(x, lowerTick, upperTick, pool.currentTickIndex, true)

  await market.initPosition(
    {
      pair,
      owner: MINTER.publicKey,
      userTokenX: minterUsdt,
      userTokenY: minterUsdc,
      lowerTick,
      upperTick,
      liquidityDelta: liquidity
    },
    MINTER
  )
}
main()
