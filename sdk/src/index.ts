import { Market } from './market'
import { SEED, tou64, DENOMINATOR, signAndSend, sleep } from './utils'
import { TICK_LIMIT, calculate_price_sqrt, fromInteger, MAX_TICK, MIN_TICK } from './math'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Pair } from './pair'
import { getMarketAddress, Network, USDC_USDT, SOL_USDC } from './network'

export {
  Market,
  Pair,
  Network,
  getMarketAddress,
  signAndSend,
  sleep,
  calculate_price_sqrt,
  fromInteger,
  SEED,
  tou64,
  DENOMINATOR,
  TICK_LIMIT,
  MAX_TICK,
  MIN_TICK,
  USDC_USDT,
  SOL_USDC
}
export interface IWallet {
  signTransaction(tx: Transaction): Promise<Transaction>
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>
  publicKey: PublicKey
}
