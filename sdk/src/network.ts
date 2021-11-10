import { BN } from '@project-serum/anchor'
import { FeeTier } from './market'
import { feeToTickSpacing, fromFee } from './utils'

export enum Network {
  LOCAL,
  DEV
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return 'FPr3fREovDnqMfubJTrJAFwopvJB8grXj1o3gkmSyzmw'
    case Network.DEV:
      return 'Mu6q1PtrKAKkFWZhe6vXz21U4fkQD9L5hnKCGP7FUQM'
    default:
      throw new Error('Unknown network')
  }
}

export const FEE_TIERS: Array<FeeTier> = [
  fromFee(new BN(20)), // 0.02% -> 4
  fromFee(new BN(40)), // 0.04% -> 8
  fromFee(new BN(100)), // 0.1% -> 20
  fromFee(new BN(300)), // 0.3% -> 60
  fromFee(new BN(1000)) // 1%   -> 200
].map((fee) => {
  return {
    fee,
    feeTier: feeToTickSpacing(fee)
  }
})

export const MOCK_TOKENS = {
  USDC: '5ihkgQGjKvWvmMtywTgLdwokZ6hqFv5AgxSyYoCNufQW',
  USDT: '4cZv7KgYNgmr3NZSDhT5bhXGGttXKTndqyXeeC1cB6Xm',
  SOL: 'BJVjNqQzM1fywLWzzKbQEZ2Jsx9AVyhSLWzko3yF68PH'
}
