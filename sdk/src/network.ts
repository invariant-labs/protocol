export enum Network {
  LOCAL,
  DEV
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return 'FPr3fREovDnqMfubJTrJAFwopvJB8grXj1o3gkmSyzmw'
    case Network.DEV:
      return 'Asx8HEFtysawo1r7NF9SqdtBawW2bnf1DY1bCVLvcbWW'
    default:
      throw new Error('Unknown network')
  }
}

export const MOCK_TOKENS = {
  USDC: '5ihkgQGjKvWvmMtywTgLdwokZ6hqFv5AgxSyYoCNufQW',
  USDT: '4cZv7KgYNgmr3NZSDhT5bhXGGttXKTndqyXeeC1cB6Xm',
  SOL: 'BJVjNqQzM1fywLWzzKbQEZ2Jsx9AVyhSLWzko3yF68PH'
}
