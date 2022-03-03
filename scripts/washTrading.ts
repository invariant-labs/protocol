import * as fs from 'fs'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS, Network } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Market, Pair, tou64 } from '@invariant-labs/sdk/src'
import { FEE_TIERS, toDecimal } from '@invariant-labs/sdk/src/utils'
import { Swap } from '@invariant-labs/sdk/src/market'
import { BN } from '../sdk-staker/lib'
import { U128MAX } from '@invariant-labs/sdk/lib/utils'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  commitment: 'confirmed',
  skipPreflight: true
})

const connection = provider.connection
const dirPath = './logs/washTrading'

// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  const filePath = `${dirPath}/washTrading-${Date.now()}`

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

  await tokenX.mintTo(accountX, MINTER, [], tou64(1e18))
  await tokenY.mintTo(accountY, MINTER, [], tou64(1e18))

  while (true) {
    const start = Date.now()

    const side = Math.random() > 0.5
    const amount = 0 // To be estimated for certain prepared pool

    console.log(`swap ${side ? 'x -> y' : 'y -> x'}: ${amount}`)

    const swapVars: Swap = {
      xToY: side,
      accountX: accountX,
      accountY: accountY,
      amount: tou64(amount),
      byAmountIn: true,
      estimatedPriceAfterSwap: side ? { v: new BN(1) } : { v: U128MAX },
      slippage: toDecimal(2, 2),
      pair,
      owner: MINTER.publicKey
    }

    try {
      await market.swap(swapVars, MINTER)
    } catch (err: any) {
      const pool = await market.getPool(pair)
      const swapDetails = `swap details:\nxToY: ${
        // trunk-ignore(eslint/@typescript-eslint/restrict-template-expressions)
        swapVars.xToY
      }\namount: ${swapVars.amount.toString()}\n`
      const poolDetails = `pool details:\ncurrentTickIndex: ${
        pool.currentTickIndex
      }\nliquidity: ${pool.liquidity.v.toString()}\n`

      fs.appendFileSync(filePath, swapDetails)
      fs.appendFileSync(filePath, poolDetails)
      // trunk-ignore(eslint/@typescript-eslint/restrict-template-expressions)
      fs.appendFileSync(filePath, `error: ${err.toString()}`)
      continue
    }
    console.log(`time: ${Date.now() - start}`)
  }
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
