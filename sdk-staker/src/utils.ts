import { BN, Provider } from '@project-serum/anchor'
import {
  ConfirmOptions,
  Connection,
  Keypair,
  sendAndConfirmRawTransaction,
  Transaction
} from '@solana/web3.js'

export const DECIMAL = 12
export const DENOMINATOR = new BN(10).pow(new BN(DECIMAL))

// hex code must be at the end of message
export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xa4',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers'
}
export interface Decimal {
  v: BN
}

export const toDecimal = (x: number, decimals: number = 0): Decimal => {
  return { v: DENOMINATOR.muln(x).div(new BN(10).pow(new BN(decimals))) }
}

export const STAKER_SEED = Buffer.from('staker')

export const fromInteger = (integer: number): { v: BN } => {
  return { v: new BN(integer).mul(DENOMINATOR) }
}

export const signAndSend = async (
  tx: Transaction,
  signers: Keypair[],
  connection: Connection,
  opts?: ConfirmOptions
) => {
  tx.setSigners(...signers.map(s => s.publicKey))
  const blockhash = await connection.getRecentBlockhash(
    opts?.commitment || Provider.defaultOptions().commitment
  )
  tx.recentBlockhash = blockhash.blockhash
  tx.partialSign(...signers)
  const rawTx = tx.serialize()
  return await sendAndConfirmRawTransaction(connection, rawTx)
}
