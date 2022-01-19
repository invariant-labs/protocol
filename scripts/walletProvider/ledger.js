import TransportWebUsb from '@ledgerhq/hw-transport-node-hid'
import {
  getPublicKey,
  solanaDerivationPath,
  solanaLedgerSignBytes,
  solanaLedgerSignTransaction,
  solanaLedgerConfirmPublicKey
} from './ledger-core'
import { DERIVATION_PATH } from './localStorage'
import bs58 from 'bs58'

export class LedgerWalletProvider {
  // trunk-ignore(eslint/space-before-function-paren)
  constructor(args) {
    this.onDisconnect = (args && args.onDisconnect) || (() => {})
    this.derivationPath = args ? args.derivationPath : DERIVATION_PATH.bip44Change
    this.account = args ? args.account : undefined
    this.change = args ? args.change : undefined
    this.solanaDerivationPath = solanaDerivationPath(this.account, this.change, this.derivationPath)
  }

  init = async () => {
    this.transport = await TransportWebUsb.create()
    this.pubKey = await getPublicKey(this.transport, this.solanaDerivationPath)
    this.transport.on('disconnect', this.onDisconnect)
    this.listAddresses = async walletCount => {
      // TODO: read accounts from ledger
      return [this.pubKey]
    }
    return this
  }

  // trunk-ignore(eslint/space-before-function-paren)
  get publicKey() {
    return this.pubKey
  }

  signTransaction = async transaction => {
    const sigBytes = await solanaLedgerSignTransaction(
      this.transport,
      this.solanaDerivationPath,
      transaction
    )
    transaction.addSignature(this.publicKey, sigBytes)
    return transaction
  }

  createSignature = async message => {
    const sigBytes = await solanaLedgerSignBytes(this.transport, this.solanaDerivationPath, message)
    return bs58.encode(sigBytes)
  }

  confirmPublicKey = async () => {
    return await solanaLedgerConfirmPublicKey(this.transport, this.solanaDerivationPath)
  }
}
