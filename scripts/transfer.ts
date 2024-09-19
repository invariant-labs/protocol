import { BN, AnchorProvider } from '@coral-xyz/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = AnchorProvider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const recipient = new PublicKey('9ceXFTqXzJMFDzf9s3fQn2UZDV9ihD8TYRMygGNmSL6G')

  await transferUsdcUsdt(recipient)
  await transferUsdcSol(recipient)
}

const transferUsdcUsdt = async (recipient: PublicKey) => {
  const recipientUsdc = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    recipient
  )
  const recipientUsdt = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDT),
    recipient
  )

  const usdcAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USDC
  const usdtAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USDT

  await mintTo(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    recipientUsdc,
    MINTER.publicKey,
    usdcAmount
  )
  await mintTo(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDT),
    recipientUsdt,
    MINTER.publicKey,
    usdtAmount
  )
}
const transferUsdcSol = async (recipient: PublicKey) => {
  const recipientUsdc = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    recipient
  )
  const recipientSol = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.SOL),
    recipient
  )

  const usdcAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USD
  const solAmount = new BN(10).pow(new BN(9)).muln(5) // 5 SOL

  await mintTo(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    recipientUsdc,
    MINTER.publicKey,
    usdcAmount
  )
  await mintTo(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.SOL),
    recipientSol,
    MINTER.publicKey,
    solAmount
  )
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
