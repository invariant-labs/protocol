import { LedgerWalletProvider } from './ledger'

export class WalletProviderFactory {
  // trunk-ignore(eslint/space-before-function-paren)
  static getProvider(args) {
    return new LedgerWalletProvider(args)
  }
}
