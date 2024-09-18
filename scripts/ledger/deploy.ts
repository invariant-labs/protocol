import { Network } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { CreateFeeTier, Market } from '@invariant-labs/sdk/src/market'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Provider } from '@coral-xyz/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import { BN } from '../../staker-sdk/lib'
import { LedgerWalletProvider } from '../walletProvider/ledger'
import { getLedgerWallet, signAndSendLedger } from '../walletProvider/wallet'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const connection = provider.connection

const createStandardFeeTiers = async (market: Market, ledgerWallet: LedgerWalletProvider) => {
  for (const feeTier of FEE_TIERS) {
    const createFeeTierVars: CreateFeeTier = {
      feeTier: feeTier,
      admin: ledgerWallet.publicKey
    }
    const createFeeTierTx = await market.createFeeTierTransaction(createFeeTierVars)
    await signAndSendLedger(createFeeTierTx, connection, ledgerWallet)
  }
}

const createLowestFeeTier = async (market: Market, ledgerWallet: LedgerWalletProvider) => {
  const feeTier: FeeTier = { fee: fromFee(new BN(1)), tickSpacing: 1 }
  const createFeeTierTx = await market.createFeeTierTransaction({
    feeTier: feeTier,
    admin: ledgerWallet.publicKey
  })
  await signAndSendLedger(createFeeTierTx, connection, ledgerWallet)
}

const main = async () => {
  const ledgerWallet = await getLedgerWallet()
  console.log(`ledger public key: ${ledgerWallet.publicKey}`)
  const market = await Market.build(Network.MAIN, provider.wallet, connection)
  await createLowestFeeTier(market, ledgerWallet)

  // const createStateTx = await market.createStateTransaction(ledgerWallet.publicKey)
  // await signAndSendLedger(createStateTx, connection, ledgerWallet)
  // await createStandardFeeTiers(market, ledgerWallet)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
