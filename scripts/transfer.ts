import { BN, Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey, sendAndConfirmRawTransaction } from '@solana/web3.js'
import { MOCK_TOKENS } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { tou64 } from '@invariant-labs/sdk/src'
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const recipient = new PublicKey('9ceXFTqXzJMFDzf9s3fQn2UZDV9ihD8TYRMygGNmSL6G')

  // transferUsdcUsdt(recipient)
  transferUsdcSol(recipient)
}

const transferUsdcUsdt = async (recipient: PublicKey) => {
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const usdt = new Token(connection, new PublicKey(MOCK_TOKENS.USDT), TOKEN_PROGRAM_ID, wallet)

  const recipientUsdc = (await usdc.getAccountInfo(recipient)).address
  const recipientUsdt = (await usdt.getAccountInfo(recipient)).address

  const usdcAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USDC
  const usdtAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USDT

  await usdc.mintTo(recipientUsdc, MINTER, [], tou64(usdcAmount))
  await usdt.mintTo(recipientUsdt, MINTER, [], tou64(usdtAmount))
}
const transferUsdcSol = async (recipient: PublicKey) => {
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const sol = new Token(connection, new PublicKey(MOCK_TOKENS.SOL), TOKEN_PROGRAM_ID, wallet)

  const recipientUsdc = (await usdc.getAccountInfo(recipient)).address
  const recipientSol = (await sol.getAccountInfo(recipient)).address

  const usdcAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 USD
  const solAmount = new BN(10).pow(new BN(9)).muln(5) // 5 SOL

  await usdc.mintTo(recipientUsdc, MINTER, [], tou64(usdcAmount))
  await sol.mintTo(recipientSol, MINTER, [], tou64(solAmount))
}

main()
