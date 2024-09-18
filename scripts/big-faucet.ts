import { BN, Provider } from '@coral-xyz/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS } from '@invariant-labs/sdk/lib/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { tou64 } from '@invariant-labs/sdk/lib/utils'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const ADDRESS = new PublicKey('7cGcxMCWHqqJLQ6pK13ygt8TnPEpddcnvDFvW4onNgT5')
const AMOUNT = new BN(1e6) // no decimals

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const usdt = new Token(connection, new PublicKey(MOCK_TOKENS.USDT), TOKEN_PROGRAM_ID, wallet)
  const sol = new Token(connection, new PublicKey(MOCK_TOKENS.SOL), TOKEN_PROGRAM_ID, wallet)

  console.log('creating accounts')
  const minterUsdc = await usdc.createAccount(ADDRESS)
  const minterUsdt = await usdt.createAccount(ADDRESS)
  const minterSol = await sol.createAccount(ADDRESS)

  console.log('sending tokens')
  await usdc.mintTo(minterUsdc, MINTER, [], tou64(AMOUNT.mul(new BN(10).pow(new BN(6)))))
  await usdt.mintTo(minterUsdt, MINTER, [], tou64(AMOUNT.mul(new BN(10).pow(new BN(6)))))
  await sol.mintTo(minterSol, MINTER, [], tou64(AMOUNT.mul(new BN(10).pow(new BN(9)))))
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
