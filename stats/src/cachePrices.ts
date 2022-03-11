import { TokenListProvider } from '@solana/spl-token-registry'
import axios, { AxiosResponse } from 'axios'
import fs from 'fs'
import PRICES_DATA from '../data/prices.json'

export interface CoingeckoApiPriceData {
  id: string
  current_price: number
}

export const getCoingeckoPricesData = async (ids: string[]): Promise<CoingeckoApiPriceData[]> => {
  const requests: Array<Promise<AxiosResponse<CoingeckoApiPriceData[]>>> = []
  for (let i = 0; i < ids.length; i += 250) {
    const idsSlice = ids.slice(i, i + 250)
    const idsList = idsSlice.reduce((acc, id, index) => acc + id + (index < 249 ? ',' : ''), '')
    requests.push(
      axios.get<CoingeckoApiPriceData[]>(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsList}&per_page=250`
      )
    )
  }

  return await Promise.all(requests).then(responses =>
    responses.map(res => res.data).reduce((acc, data) => [...acc, ...data], [])
  )
}

export const createSnapshotOfPrices = async () => {
  const ids: string[] = await new TokenListProvider().resolve().then(tokens => {
    const tokenList = tokens
      .filterByClusterSlug('mainnet-beta')
      .getList()
      .filter(token => token.chainId === 101)

    const idsList: string[] = []

    tokenList.forEach(token => {
      if (typeof token?.extensions?.coingeckoId !== 'undefined') {
        idsList.push(token.extensions.coingeckoId)
      }
    })

    return [...new Set(idsList)]
  })

  const prices = await getCoingeckoPricesData(ids)

  const snaps = PRICES_DATA

  const now = Date.now()
  const timestamp =
    Math.floor(now / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24) + 1000 * 60 * 60 * 12

  // eslint-disable-next-line @typescript-eslint/naming-convention
  prices.forEach(({ id, current_price }) => {
    if (!snaps[id]) {
      snaps[id] = {}
    }

    snaps[id][timestamp] = current_price ?? 0
  })

  fs.writeFile('./data/prices.json', JSON.stringify(snaps), err => {
    if (err) {
      throw err
    }
  })
}

createSnapshotOfPrices().then(
  () => {
    console.log('Prices snapshot done!')
  },
  err => {
    console.log(err)
  }
)
