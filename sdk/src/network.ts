import { PublicKey } from '@solana/web3.js'
import { Pair } from '.'

export enum Network {
  LOCAL,
  DEV
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return 'FPr3fREovDnqMfubJTrJAFwopvJB8grXj1o3gkmSyzmw'
    case Network.DEV:
      return '5TwbVzTeNzJmkpav9SyxLSs1wmsBoUYoM3L97tbMRFnE'
    default:
      throw new Error('Unknown network')
  }
}

export const MOCK_TOKENS = {
  USDC: '5ihkgQGjKvWvmMtywTgLdwokZ6hqFv5AgxSyYoCNufQW',
  USDT: '4cZv7KgYNgmr3NZSDhT5bhXGGttXKTndqyXeeC1cB6Xm',
  SOL: 'BJVjNqQzM1fywLWzzKbQEZ2Jsx9AVyhSLWzko3yF68PH'
}
