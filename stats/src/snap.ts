import { Network, Market, Pair, getMarketAddress } from '@invariant-labs/sdk'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl, PublicKey } from '@solana/web3.js'
import fs from 'fs'
import DEVNET_DATA from '../data/devnet.json'
import MAINNET_DATA from '../data/mainnet.json'

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()

export interface PoolSnapshot {
  timestamp: number
  volumeX: string
  volumeY: string
  liquidityX: string
  liquidityY: string
  feeX: string
  feeY: string
}

export const createSnapshotForNetwork = async (network: Network) => {
  let provider: Provider
  let fileName: string
  let snaps: Record<string, PoolSnapshot[]>

  switch (network) {
    case Network.MAIN:
      provider = Provider.local('https://solana-api.projectserum.com')
      fileName = './data/mainnet.json'
      snaps = MAINNET_DATA
      break
    case Network.DEV:
    default:
      provider = Provider.local(clusterApiUrl('devnet'))
      fileName = './data/devnet.json'
      snaps = DEVNET_DATA
  }

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

      const { volumeX, volumeY } = await market.getVolume(pair)

      const { liquidityX, liquidityY } = await market.getPairLiquidityValues(pair)

      const { feeX, feeY } = await market.getGlobalFee(pair)

      return {
        address: address.toString(),
        stats: {
          volumeX: volumeX.toString(),
          volumeY: volumeY.toString(),
          liquidityX: liquidityX.toString(),
          liquidityY: liquidityY.toString(),
          feeX: feeX.toString(),
          feeY: feeY.toString()
        }
      }
    })
  )

  const now = Date.now()
  const timestamp =
    Math.floor(now / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24) + 1000 * 60 * 60 * 12

  poolsData.forEach(({ address, stats }) => {
    if (!snaps[address]) {
      snaps[address] = []
    }

    snaps[address].push({
      timestamp,
      ...stats
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
    console.log('Devnet snapshot done!')
  },
  err => {
    console.log(err)
  }
)

createSnapshotForNetwork(Network.MAIN).then(
  () => {
    console.log('Mainnet snapshot done!')
  },
  err => {
    console.log(err)
  }
)
