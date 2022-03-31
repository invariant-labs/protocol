/* eslint-disable @typescript-eslint/naming-convention */
import { MOCK_TOKENS } from '@invariant-labs/sdk'
import { DECIMAL } from '@invariant-labs/sdk/lib/utils'
import { BN } from '@project-serum/anchor'
import { TokenListProvider } from '@solana/spl-token-registry'
import axios, { AxiosResponse } from 'axios'

export interface SnapshotValueData {
  tokenBNFromBeginning: string
  usdValue24: number
}

export interface PoolSnapshotV1 {
  timestamp: number
  volumeX: string
  volumeY: string
  liquidityX: string
  liquidityY: string
  feeX: string
  feeY: string
}

export interface PoolSnapshot {
  timestamp: number
  volumeX: SnapshotValueData
  volumeY: SnapshotValueData
  liquidityX: SnapshotValueData
  liquidityY: SnapshotValueData
  feeX: SnapshotValueData
  feeY: SnapshotValueData
}

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

export const printBN = (amount: BN, decimals: number): string => {
  const balanceString = amount.toString()
  if (balanceString.length <= decimals) {
    return '0.' + '0'.repeat(decimals - balanceString.length) + balanceString
  } else {
    return (
      balanceString.substring(0, balanceString.length - decimals) +
      '.' +
      balanceString.substring(balanceString.length - decimals)
    )
  }
}

export const printBNtoBN = (amount: string, decimals: number): BN => {
  const balanceString = amount.split('.')
  if (balanceString.length !== 2) {
    return new BN(balanceString[0] + '0'.repeat(decimals))
  }
  if (balanceString[1].length <= decimals) {
    return new BN(
      balanceString[0] + balanceString[1] + '0'.repeat(decimals - balanceString[1].length)
    )
  }
  return new BN(0)
}

const idsToAppend = ['lido-staked-sol']

export interface TokenData {
  coingeckoId?: string
  decimals: number
}

export const getTokensData = async (): Promise<Record<string, TokenData>> => {
  const tokens = await new TokenListProvider().resolve()

  const tokenList = tokens
    .filterByClusterSlug('mainnet-beta')
    .getList()
    .filter(token => token.chainId === 101)

  const tokensObj: Record<string, TokenData> = {}

  tokenList.forEach(token => {
    tokensObj[token.address.toString()] = {
      decimals: token.decimals,
      coingeckoId: token.extensions?.coingeckoId
    }
  })

  return tokensObj
}

export const getTokensPrices = async (idsList: string[]): Promise<Record<string, number>> => {
  const ids: string[] = [...idsList, ...idsToAppend]

  const prices = await getCoingeckoPricesData(ids)

  const snaps = {}

  prices.forEach(({ id, current_price }) => {
    snaps[id] = current_price ?? 0
  })

  return snaps
}

export const getUsdValue24 = (total: BN, decimals: number, price: number, lastTotal: BN) => {
  const bnPrice = printBNtoBN(price.toFixed(DECIMAL), DECIMAL)

  return +printBN(
    total
      .sub(lastTotal)
      .mul(bnPrice)
      .div(new BN(10 ** DECIMAL)),
    decimals
  )
}

export const devnetTokensData = {
  [MOCK_TOKENS.USDC]: {
    decimals: 6,
    coingeckoId: 'usd-coin'
  },
  [MOCK_TOKENS.USDT]: {
    decimals: 6,
    coingeckoId: 'thether'
  },
  [MOCK_TOKENS.SOL]: {
    decimals: 9,
    coingeckoId: 'solana'
  },
  [MOCK_TOKENS.MSOL]: {
    decimals: 9,
    coingeckoId: 'msol'
  },
  [MOCK_TOKENS.BTC]: {
    decimals: 6,
    coingeckoId: 'bitcoin'
  },
  [MOCK_TOKENS.REN_DOGE]: {
    decimals: 8,
    coingeckoId: 'rendoge'
  }
}
