import { BN, Provider } from '@project-serum/anchor'
import { u64 } from '@solana/spl-token'
import {
  ConfirmOptions,
  Connection,
  Keypair,
  sendAndConfirmRawTransaction,
  Transaction
} from '@solana/web3.js'

// hex code must be at the end of message
export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xa4',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers'
}
export enum ERRORS_EXCHANGE {}
export const STAKER_SEED = 'staker'

export const signAndSend = async (
  tx: Transaction,
  signers: Array<Keypair>,
  connection: Connection,
  opts?: ConfirmOptions
) => {
  tx.setSigners(...signers.map((s) => s.publicKey))
  const blockhash = await connection.getRecentBlockhash(
    opts?.commitment || Provider.defaultOptions().commitment
  )
  tx.recentBlockhash = blockhash.blockhash
  tx.partialSign(...signers)
  const rawTx = tx.serialize()
  return await sendAndConfirmRawTransaction(connection, rawTx, opts || Provider.defaultOptions())
}
