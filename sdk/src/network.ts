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
  USDC: '35P5P6ZGKUN6wqxrX4VdLRrGbzkrfvhyNs4iqk1vDxAx',
  USDT: 'CYPdUAp8KshzJ2a45kzgy3fr4UTiyrEGE998rA7wzFR6',
  SOL: '23AQ2kRxqT1fk47q6G8YcKrpx4VhWeUvKHuRijT61qSD'
}
