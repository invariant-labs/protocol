import { Market } from './market'
import { SEED, tou64, DENOMINATOR, signAndSend, sleep } from './utils'
import { TICK_LIMIT, calculate_price_sqrt, fromInteger, MAX_TICK, MIN_TICK } from './math'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Pair } from './pair'
import { getMarketAddress, Network, MOCK_TOKENS } from './network'
import { FEE_TIERS } from './constants'

export {
  Market,
  Pair,
  Network,
  getMarketAddress,
  signAndSend,
  sleep,
  calculate_price_sqrt,
  fromInteger,
  tou64,
  SEED,
  DENOMINATOR,
  TICK_LIMIT,
  MAX_TICK,
  MIN_TICK,
  MOCK_TOKENS,
  FEE_TIERS
}
export interface IWallet {
  signTransaction(tx: Transaction): Promise<Transaction>
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>
  publicKey: PublicKey
}
