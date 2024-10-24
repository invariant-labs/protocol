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
  const recipient = new PublicKey('')
  // await mintUsdc(recipient)
  // await mintUsdh(recipient)
  // await mintHbb(recipient)
}

const mintUsdh = async (recipient: PublicKey) => {
  const recipientUsdh = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDH),
    recipient
  )
  console.log(recipientUsdh.toString())

  const usdhAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 usdh

  await mintTo(
    connection,
    MINTER,
    new PublicKey(MOCK_TOKENS.USDH),
    recipientUsdh,
    MINTER.publicKey,
    usdhAmount
  )
}

const mintHbb = async (recipient: PublicKey) => {
  const recipientHbb = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.HBB),
    recipient
  )
  console.log(recipientHbb.toString())

  const hbbAmount = new BN(10).pow(new BN(6)).muln(10000) // 1000 hbb

  await mintTo(
    connection,
    MINTER,
    new PublicKey(MOCK_TOKENS.HBB),
    recipientHbb,
    MINTER.publicKey,
    hbbAmount
  )
}

const mintUsdc = async (recipient: PublicKey) => {
  const recipientUsdc = await createAssociatedTokenAccount(
    connection,
    wallet,
    new PublicKey(MOCK_TOKENS.USDC),
    recipient
  )
  console.log(recipientUsdc.toString())

  const usdcAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 usdc

  await mintTo(
    connection,
    MINTER,
    new PublicKey(MOCK_TOKENS.USDC),
    recipientUsdc,
    MINTER.publicKey,
    usdcAmount
  )
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
