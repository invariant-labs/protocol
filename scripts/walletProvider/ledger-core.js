import { PublicKey } from '@solana/web3.js'
import { DERIVATION_PATH } from './localStorage'
const bs58 = require('bs58')

const INS_GET_PUBKEY = 0x05
const INS_SIGN_MESSAGE = 0x06

const P1_NON_CONFIRM = 0x00
const P1_CONFIRM = 0x01

const P2_EXTEND = 0x01
const P2_MORE = 0x02

const MAX_PAYLOAD = 255

const LEDGER_CLA = 0xe0

/*
 * Helper for chunked send of large payloads
 */
// trunk-ignore(eslint/space-before-function-paren)
async function solanaSend(transport, instruction, p1, payload) {
  let p2 = 0
  let payloadOffset = 0

  if (payload.length > MAX_PAYLOAD) {
    while (payload.length - payloadOffset > MAX_PAYLOAD) {
      const buf = payload.slice(payloadOffset, payloadOffset + MAX_PAYLOAD)
      payloadOffset += MAX_PAYLOAD
      console.log('send', (p2 | P2_MORE).toString(16), buf.length.toString(16), buf)
      const reply = await transport.send(LEDGER_CLA, instruction, p1, p2 | P2_MORE, buf)
      if (reply.length !== 2) {
        throw new Error('solana_send: Received unexpected reply payload', 'UnexpectedReplyPayload')
      }
      p2 |= P2_EXTEND
    }
  }

  const buf = payload.slice(payloadOffset)
  console.log('send', p2.toString(16), buf.length.toString(16), buf)
  const reply = await transport.send(LEDGER_CLA, instruction, p1, p2, buf)

  return reply.slice(0, reply.length - 2)
}

const BIP32_HARDENED_BIT = (1 << 31) >>> 0
// trunk-ignore(eslint/space-before-function-paren)
function _harden(n) {
  return (n | BIP32_HARDENED_BIT) >>> 0
}
// trunk-ignore(eslint/space-before-function-paren)
export function solanaDerivationPath(account, change, derivationPath) {
  const useAccount = account || 0
  const useChange = change || 0
  derivationPath = derivationPath || DERIVATION_PATH.bip44Change

  if (derivationPath === DERIVATION_PATH.bip44Root) {
    const length = 2
    const derivationPath = Buffer.alloc(1 + length * 4)
    let offset = 0
    offset = derivationPath.writeUInt8(length, offset)
    offset = derivationPath.writeUInt32BE(_harden(44), offset) // Using BIP44
    derivationPath.writeUInt32BE(_harden(501), offset) // Solana's BIP44 path
    return derivationPath
  } else if (derivationPath === DERIVATION_PATH.bip44) {
    const length = 3
    const derivationPath = Buffer.alloc(1 + length * 4)
    let offset = 0
    offset = derivationPath.writeUInt8(length, offset)
    offset = derivationPath.writeUInt32BE(_harden(44), offset) // Using BIP44
    offset = derivationPath.writeUInt32BE(_harden(501), offset) // Solana's BIP44 path
    derivationPath.writeUInt32BE(_harden(useAccount), offset)
    return derivationPath
  } else if (derivationPath === DERIVATION_PATH.bip44Change) {
    const length = 4
    const derivationPath = Buffer.alloc(1 + length * 4)
    let offset = 0
    offset = derivationPath.writeUInt8(length, offset)
    offset = derivationPath.writeUInt32BE(_harden(44), offset) // Using BIP44
    offset = derivationPath.writeUInt32BE(_harden(501), offset) // Solana's BIP44 path
    offset = derivationPath.writeUInt32BE(_harden(useAccount), offset)
    derivationPath.writeUInt32BE(_harden(useChange), offset)
    return derivationPath
  } else {
    throw new Error('Invalid derivation path')
  }
}
// trunk-ignore(eslint/space-before-function-paren)
async function solanaLedgerGetPubkey(transport, derivationPath) {
  return solanaSend(transport, INS_GET_PUBKEY, P1_NON_CONFIRM, derivationPath)
}
// trunk-ignore(eslint/space-before-function-paren)
export async function solanaLedgerSignTransaction(transport, derivationPath, transaction) {
  const msgBytes = transaction.serializeMessage()
  return solanaLedgerSignBytes(transport, derivationPath, msgBytes)
}
// trunk-ignore(eslint/space-before-function-paren)
export async function solanaLedgerSignBytes(transport, derivationPath, msgBytes) {
  const numPaths = Buffer.alloc(1)
  numPaths.writeUInt8(1)
  const payload = Buffer.concat([numPaths, derivationPath, msgBytes])

  return solanaSend(transport, INS_SIGN_MESSAGE, P1_CONFIRM, payload)
}
// trunk-ignore(eslint/space-before-function-paren)
export async function getPublicKey(transport, path) {
  let fromDerivationPath
  if (path) {
    fromDerivationPath = path
  } else {
    fromDerivationPath = solanaDerivationPath()
  }
  const fromPubkeyBytes = await solanaLedgerGetPubkey(transport, fromDerivationPath)
  const fromPubkeyString = bs58.encode(fromPubkeyBytes)

  return new PublicKey(fromPubkeyString)
}

// trunk-ignore(eslint/space-before-function-paren)
export async function solanaLedgerConfirmPublicKey(transport, derivationPath) {
  return await solanaSend(transport, INS_GET_PUBKEY, P1_CONFIRM, derivationPath)
}
