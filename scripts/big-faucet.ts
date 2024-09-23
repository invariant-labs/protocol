import { BN, AnchorProvider } from '@coral-xyz/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS } from '@invariant-labs/sdk/lib/network'
import { MINTER } from './minter'
import { tou64 } from '@invariant-labs/sdk/lib/utils'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const ADDRESS = new PublicKey('7cGcxMCWHqqJLQ6pK13ygt8TnPEpddcnvDFvW4onNgT5')
const AMOUNT = new BN(1e6) // no decimals

const provider = AnchorProvider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  // const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  // const usdt = new Token(connection, new PublicKey(MOCK_TOKENS.USDT), TOKEN_PROGRAM_ID, wallet)
  // const sol = new Token(connection, new PublicKey(MOCK_TOKENS.SOL), TOKEN_PROGRAM_ID, wallet)

  console.log('creating accounts')
  const minterUsdc = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    ADDRESS
  )
  const minterUsdt = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDT),
    ADDRESS
  )
  const minterSol = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.SOL),
    ADDRESS
  )

  console.log('sending tokens')
  await mintTo(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    minterUsdc,
    MINTER.publicKey,
    AMOUNT.mul(new BN(10).pow(new BN(6)))
  )
  await mintTo(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDT),
    minterUsdt,
    MINTER.publicKey,
    AMOUNT.mul(new BN(10).pow(new BN(6)))
  )
  await mintTo(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.SOL),
    minterSol,
    MINTER.publicKey,
    AMOUNT.mul(new BN(10).pow(new BN(6)))
  )
}
// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
