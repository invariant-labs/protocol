import { Network, Market, Pair } from '@invariant-labs/sdk'
import * as anchor from '@project-serum/anchor'
import { Provider } from '@project-serum/anchor'
import { clusterApiUrl } from '@solana/web3.js'
import fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()

export const createSnapshotForNetwork = async (network: Network) => {
  let provider: Provider
  let fileName: string

  switch (network) {
    case Network.DEV:
    default:
      provider = Provider.local(clusterApiUrl('devnet'))
      fileName = './data/devnetStats.json'
  }

  const connection = provider.connection

  const market = await Market.build(
    network,
    provider.wallet,
    connection,
    anchor.workspace.Invariant.programId
  )

  const allPools = await market.getAllPools()

  const poolData = await Promise.all(
    allPools.map(async pool => {
      const pair = new Pair(pool.tokenX, pool.tokenY, { fee: pool.fee.v })
      const address = await pair.getAddress(market.program.programId)

      const { volumeX, volumeY } = await market.getVolume(pair)

      const liquidity = await market.getWholeLiquidity(pair)

      return {
        address: address.toString(),
        stats: {
          volumeX,
          volumeY,
          liquidity
        }
      }
    })
  )

  fs.readFile(fileName, (err, data) => {
    if (err) {
      throw err
    }

    const snaps = JSON.parse(data.toString())

    const timestamp = Date.now()

    poolData.forEach(({ address, stats }) => {
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
