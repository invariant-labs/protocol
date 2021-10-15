// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

import { Provider } from '@project-serum/anchor'

const provider = Provider.local('https://api.testnet.solana.com', {
  // preflightCommitment: 'max',
  skipPreflight: true
})

const main = async function () {
  // Add your deploy script here.
}
main()
