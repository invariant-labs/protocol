import { BN, Provider } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { MOCK_TOKENS } from '@invariant-labs/sdk/src/network'
import { MINTER } from './minter'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { tou64 } from '@invariant-labs/sdk/src/utils'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const recipient = new PublicKey('2tEidvr2FV19EvgQw8b53crdJJjdwHUKkwZA469Qu4EE')
  //const recipient = new PublicKey('SygPUczok5Wx8Xc1ujkzVXopb9KxtsVH7FPvu5TGRmX')

  //await mintUsdc(recipient)
  // await mintUsdh(recipient)
  // console.log(MINTER.publicKey.toString())
  await mintHbb(recipient)
}

const mintUsdh = async (recipient: PublicKey) => {
  const usdh = new Token(connection, new PublicKey(MOCK_TOKENS.USDH), TOKEN_PROGRAM_ID, wallet)

  const recipientUsdh = await usdh.createAccount(recipient)

  const usdhAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 usdh

  await usdh.mintTo(recipientUsdh, MINTER, [], tou64(usdhAmount))
}

const mintHbb = async (recipient: PublicKey) => {
  const hbb = new Token(connection, new PublicKey(MOCK_TOKENS.HBB), TOKEN_PROGRAM_ID, wallet)

  const recipientHbb = await hbb.createAccount(recipient)
  console.log(recipientHbb.toString())

  const hbbAmount = new BN(10).pow(new BN(6)).muln(10000) // 1000 hbb

  await hbb.mintTo(recipientHbb, MINTER, [], tou64(hbbAmount))
}

const mintUsdc = async (recipient: PublicKey) => {
  const usdc = new Token(connection, new PublicKey(MOCK_TOKENS.USDC), TOKEN_PROGRAM_ID, wallet)

  const recipientUsdc = await usdc.createAccount(recipient)
  console.log(recipientUsdc.toString())

  const hbbAmount = new BN(10).pow(new BN(6)).muln(1000) // 1000 usdc

  await usdc.mintTo(recipientUsdc, MINTER, [], tou64(hbbAmount))
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
