import { Market, Network } from '@invariant-labs/sdk/src'
import { AnchorProvider } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { getLedgerWallet, signAndSendLedger } from '../walletProvider/wallet'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = AnchorProvider.local('https://api.mainnet-beta.solana.com', {
  skipPreflight: true
})

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.MAIN, provider.wallet, connection)
  const recipient = new PublicKey('')

  const ledgerWallet = await getLedgerWallet()
  const ledgerPubkey = ledgerWallet.publicKey as PublicKey
  console.log(`ledger public key: ${ledgerPubkey.toString()}`)

  const position = await market.getPosition(ledgerPubkey, 0)
  const positionList = await market.getPositionList(ledgerPubkey)
  console.log(position)
  console.log(positionList)

  const tx = await market.transferPositionOwnershipTransaction({
    index: 0,
    owner: ledgerPubkey,
    recipient: recipient
  })
  await signAndSendLedger(tx, connection, ledgerWallet)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
