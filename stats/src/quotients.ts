import { Network, Market, Pair, getMarketAddress } from '@invariant-labs/sdk'
import { Provider } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
import fs from 'fs'
import DEVNET_QUOTIENTS from '../data/quotients_devnet.json'
import MAINNET_QUOTIENTS from '../data/quotients_mainnet.json'
import {
  devnetTokensData,
  getTokensData,
  getTokensPrices,
  QuotientSnapshot,
  TokenData
} from './utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()

export const createSnapshotForNetwork = async (network: Network) => {
  let provider: Provider
  let fileName: string
  let snaps: Record<string, QuotientSnapshot[]>
  let tokensData: Record<string, TokenData>

  switch (network) {
    case Network.MAIN:
      provider = Provider.local('https://ssc-dao.genesysgo.net')
      fileName = './data/quotients_mainnet.json'
      snaps = MAINNET_QUOTIENTS as Record<string, QuotientSnapshot[]>
      tokensData = await getTokensData()
      break
    case Network.DEV:
    default:
      provider = Provider.local('https://api.devnet.solana.com')
      fileName = './data/quotients_devnet.json'
      snaps = DEVNET_QUOTIENTS as Record<string, QuotientSnapshot[]>
      tokensData = devnetTokensData
  }

  const idsList: string[] = []

  Object.values(tokensData).forEach(token => {
    if (typeof token?.coingeckoId !== 'undefined') {
      idsList.push(token.coingeckoId)
    }
  })

  const coingeckoPrices = await getTokensPrices(idsList)

  const connection = provider.connection

  const market = await Market.build(
    network,
    provider.wallet,
    connection,
    new PublicKey(getMarketAddress(network))
  )

  const allPools = await market.getAllPools()

  const poolsData = await Promise.all(
    allPools.map(async pool => {
      const pair = new Pair(pool.tokenX, pool.tokenY, { fee: pool.fee.v })
      const address = await pair.getAddress(market.program.programId)
      const tokenXData = tokensData?.[pool.tokenX.toString()] ?? {
        decimals: 0
      }
      const tokenYData = tokensData?.[pool.tokenY.toString()] ?? {
        decimals: 0
      }
      const tokenXPrice = tokenXData.coingeckoId ? coingeckoPrices[tokenXData.coingeckoId] ?? 0 : 0
      const tokenYPrice = tokenYData.coingeckoId ? coingeckoPrices[tokenYData.coingeckoId] ?? 0 : 0

      const quotient = tokenXPrice / tokenYPrice

      return {
        address: address.toString(),
        quotient: isNaN(+JSON.stringify(quotient)) ? 0 : quotient ?? 0
      }
    })
  )

  const now = Date.now()
  const timestamp =
    Math.floor(now / (1000 * 60 * 60)) * (1000 * 60 * 60)

  poolsData.forEach(({ address, quotient }) => {
    if (!snaps[address]) {
      snaps[address] = []
    }

    snaps[address].push({
      timestamp,
      quotient
    })
  })

  fs.writeFile(fileName, JSON.stringify(snaps), err => {
    if (err) {
      throw err
    }
  })
}

createSnapshotForNetwork(Network.DEV).then(
  () => {
    console.log('Devnet quotients snapshot done!')
  },
  err => {
    console.log(err)
  }
)

createSnapshotForNetwork(Network.MAIN).then(
  () => {
    console.log('Mainnet quotients snapshot done!')
  },
  err => {
    console.log(err)
  }
)
