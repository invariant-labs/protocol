import { AnchorProvider } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { createToken } from '../tests/testUtils'
import { MINTER } from './minter'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = AnchorProvider.local('https://api.devnet.solana.com', {
  // preflightCommitment: 'max',
  skipPreflight: true
})

const main = async () => {
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair

  const solToken = await createToken(connection, wallet, MINTER, 9)
  const usdcToken = await createToken(connection, wallet, MINTER, 6)
  const usdtToken = await createToken(connection, wallet, MINTER, 6)
  const msolToken = await createToken(connection, wallet, MINTER, 9)
  const btcToken = await createToken(connection, wallet, MINTER, 6)
  const renDogeToken = await createToken(connection, wallet, MINTER, 8)

  console.log(`SOL: ${solToken.publicKey.toString()}`)
  console.log(`USDC: ${usdcToken.publicKey.toString()}`)
  console.log(`USDT: ${usdtToken.publicKey.toString()}`)
  console.log(`MSOL: ${msolToken.publicKey.toString()}`)
  console.log(`BTC: ${btcToken.publicKey.toString()}`)
  console.log(`renDOGE: ${renDogeToken.publicKey.toString()}`)
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
