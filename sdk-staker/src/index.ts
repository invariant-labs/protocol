import { BN } from '@project-serum/anchor'
import { Staker } from './staker'
import { Network } from './network'

import { PublicKey, Transaction } from '@solana/web3.js'
export interface IWallet {
  signTransaction(tx: Transaction): Promise<Transaction>
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>
  publicKey: PublicKey
}
export { BN, Network, Staker }
