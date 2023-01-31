import { Network } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { Market } from '@invariant-labs/sdk/src/market'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { BN } from '../../staker-sdk/lib'
import { LedgerWalletProvider } from '../walletProvider/ledger'
import { getLedgerWallet, signAndSendLedger } from '../walletProvider/wallet'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local('FILL ME', {
  skipPreflight: true
})
const connection = provider.connection

// const createStandardFeeTiers = async (market: Market, ledgerWallet: LedgerWalletProvider) => {
//   for (const feeTier of FEE_TIERS) {
//     const createFeeTierVars: CreateFeeTier = {
//       feeTier: feeTier,
//       admin: ledgerWallet.publicKey
//     }
//     const createFeeTierTx = await market.createFeeTierTransaction(createFeeTierVars)
//     await signAndSendLedger(createFeeTierTx, connection, ledgerWallet)
//   }
// }

const createFeeTier = async (
  market: Market,
  feeTier: FeeTier,
  ledgerWallet: LedgerWalletProvider
) => {
  const createFeeTierTx = await market.createFeeTierTransaction({
    feeTier: feeTier,
    admin: ledgerWallet.publicKey
  })
  await signAndSendLedger(createFeeTierTx, connection, ledgerWallet)
}

// const createLowestFeeTier = async (market: Market, ledgerWallet: LedgerWalletProvider) => {
//   await createFeeTier(market, { fee: fromFee(new BN(1)), tickSpacing: 1 }, ledgerWallet)
// }

const main = async () => {
  const ledgerWallet = await getLedgerWallet()
  console.log(`ledger public key: ${ledgerWallet.publicKey}`)
  const market = await Market.build(Network.MAIN, provider.wallet, connection)
  await createFeeTier(market, { fee: fromFee(new BN(5000)), tickSpacing: 5 }, ledgerWallet)
  await createFeeTier(market, { fee: fromFee(new BN(10000)), tickSpacing: 5 }, ledgerWallet)
  await createFeeTier(market, { fee: fromFee(new BN(50000)), tickSpacing: 5 }, ledgerWallet)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
