import { Provider, workspace } from '@project-serum/anchor'
import { PublicKey, Transaction, Keypair, clusterApiUrl } from '@solana/web3.js'
import { Pair, Market, Network, sleep } from '@invariant-labs/sdk'

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})
const TOKEN_X = new PublicKey('35P5P6ZGKUN6wqxrX4VdLRrGbzkrfvhyNs4iqk1vDxAx')
const TOKEN_Y = new PublicKey('CYPdUAp8KshzJ2a45kzgy3fr4UTiyrEGE998rA7wzFR6')

const connection = provider.connection
const pair = new Pair(TOKEN_X, TOKEN_Y)
const market = new Market(Network.DEV, provider.wallet, connection)

// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const main = async () => {
  const fee = 40
  const tickSpacing = 10
  const initTick = -101932

  await market.create({
    pair,
    signer: wallet,
    initTick,
    fee,
    tickSpacing
  })
  console.log('Created pool')

  await sleep(2000)

  while (true) {
    try {
      console.log(await market.get(pair))
      break
    } catch (error) {
      console.error(error)
    }
  }
}
main()
