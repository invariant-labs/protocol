import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromInteger, Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { getLiquidityByX } from '@invariant-labs/sdk/src/math'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const market = await Market.build(Network.DEV, provider.wallet, connection)

  await usdtUsdcCreatePosition(market)
}

const usdtUsdcCreatePosition = async (market: Market) => {
  const pair = new Pair(
    new PublicKey(MOCK_TOKENS.USDC),
    new PublicKey(MOCK_TOKENS.USDT),
    FEE_TIERS[0]
  )

  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const usdt = new Token(connection, new PublicKey(MOCK_TOKENS.USDT), TOKEN_PROGRAM_ID, wallet)
  const amount = tou64(1000 * 10 ** 6)

  const [minterUsdc, minterUsdt] = await Promise.all(
    [
      usdc.createAccount(MINTER.publicKey),
      usdt.createAccount(MINTER.publicKey)
    ]
  )
  await Promise.all(
    [
      usdc.mintTo(minterUsdc, MINTER, [], amount),
      usdt.mintTo(minterUsdt, MINTER, [], amount)
    ]
  )

  const x = new anchor.BN(500 * 10 ** 6)
  const lowerTick = -4
  const upperTick = 4
  const pool = await market.getPool(pair)
  const { liquidity } = getLiquidityByX(x, lowerTick, upperTick, pool.sqrtPrice, true)

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
