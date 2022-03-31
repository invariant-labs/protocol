import { getMarketAddress, Market, Network, Pair } from '@invariant-labs/sdk'
import { PoolStructure } from '@invariant-labs/sdk/lib/market'
import { BN, Provider } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
import fs from 'fs'
import DEVNET_DATA from '../data/devnet.json'
import MAINNET_DATA from '../data/mainnet.json'
import PRICES_DATA from '../data/prices.json'
import {
  devnetTokensData,
  getTokensData,
  getUsdValue24,
  PoolSnapshot,
  PoolSnapshotV1,
  TokenData
} from './utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()

export const createSnapshotForNetwork = async (network: Network) => {
  let provider: Provider
  let fileName: string
  let snapsV1: Record<string, PoolSnapshotV1[]>
  let tokensData: Record<string, TokenData>

  switch (network) {
    case Network.MAIN:
      provider = Provider.local(
        'https://solana--mainnet.datahub.figment.io/apikey/182e93d87a1f1d335c9d74d6c7371388'
      )
      fileName = './data/v2/mainnet.json'
      snapsV1 = MAINNET_DATA
      tokensData = await getTokensData()
      break
    case Network.DEV:
    default:
      provider = Provider.local(
        'https://solana--devnet.datahub.figment.io/apikey/182e93d87a1f1d335c9d74d6c7371388'
      )
      fileName = './data/v2/devnet.json'
      snapsV1 = DEVNET_DATA
      tokensData = devnetTokensData
  }

  const connection = provider.connection

  const market = await Market.build(
    network,
    provider.wallet,
    connection,
    new PublicKey(getMarketAddress(network))
  )

  const snaps: Record<string, PoolSnapshot[]> = {}

  const allPools = await market.getAllPools()

  const poolsObject: Record<string, PoolStructure> = {}

  await Promise.all(
    allPools.map(async pool => {
      const pair = new Pair(pool.tokenX, pool.tokenY, { fee: pool.fee.v })
      const address = await pair.getAddress(market.program.programId)

      poolsObject[address.toString()] = pool
    })
  )

  Object.entries(snapsV1).forEach(([address, poolSnaps]) => {
    const tokenXData = tokensData?.[poolsObject[address].tokenX.toString()] ?? {
      decimals: 0
    }
    const tokenYData = tokensData?.[poolsObject[address].tokenY.toString()] ?? {
      decimals: 0
    }

    snaps[address] = poolSnaps.map((snap, index) => {
      const timestamp = snap.timestamp.toString()

      const tokenXPrice = tokenXData.coingeckoId
        ? PRICES_DATA?.[tokenXData.coingeckoId]?.[timestamp] ?? 0
        : 0
      const tokenYPrice = tokenYData.coingeckoId
        ? PRICES_DATA?.[tokenYData.coingeckoId]?.[timestamp] ?? 0
        : 0

      return {
        timestamp: snap.timestamp,
        volumeX: {
          tokenBNFromBeginning: snap.volumeX,
          usdValue24: getUsdValue24(
            new BN(snap.volumeX),
            tokenXData.decimals,
            tokenXPrice,
            index > 0 ? new BN(poolSnaps[index - 1].volumeX) : new BN(0)
          )
        },
        volumeY: {
          tokenBNFromBeginning: snap.volumeY,
          usdValue24: getUsdValue24(
            new BN(snap.volumeY),
            tokenYData.decimals,
            tokenYPrice,
            index > 0 ? new BN(poolSnaps[index - 1].volumeY) : new BN(0)
          )
        },
        liquidityX: {
          tokenBNFromBeginning: snap.liquidityX,
          usdValue24: getUsdValue24(
            new BN(snap.liquidityX),
            tokenXData.decimals,
            tokenXPrice,
            new BN(0)
          )
        },
        liquidityY: {
          tokenBNFromBeginning: snap.liquidityY,
          usdValue24: getUsdValue24(
            new BN(snap.liquidityY),
            tokenYData.decimals,
            tokenYPrice,
            new BN(0)
          )
        },
        feeX: {
          tokenBNFromBeginning: snap.feeX,
          usdValue24: getUsdValue24(
            new BN(snap.feeX),
            tokenXData.decimals,
            tokenXPrice,
            index > 0 ? new BN(poolSnaps[index - 1].feeX) : new BN(0)
          )
        },
        feeY: {
          tokenBNFromBeginning: snap.feeY,
          usdValue24: getUsdValue24(
            new BN(snap.feeY),
            tokenYData.decimals,
            tokenYPrice,
            index > 0 ? new BN(poolSnaps[index - 1].feeY) : new BN(0)
          )
        }
      }
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
