import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
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
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)
  const usdt = new Token(connection, new PublicKey(MOCK_TOKENS.USDT), TOKEN_PROGRAM_ID, wallet)
  const recipient = new PublicKey('6pkdfGhTFx25UPsFHG5P1uBhEPuDhuCdxhDrGB5bP8P5')
  const recipientUsdc = await usdc.createAccount(recipient)
  const recipientUsdt = await usdt.createAccount(recipient)
  const amount = tou64(1000 * 10 ** 6)

  await usdc.mintTo(recipientUsdc, MINTER, [], amount)
  await usdt.mintTo(recipientUsdt, MINTER, [], amount)
}
main()
