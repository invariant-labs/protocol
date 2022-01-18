export enum Network {
  LOCAL,
  DEV
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return '5W8cgQkGhjniKuVikNyVq6Nh5mWVzHawRnXkWhL7risj'
    case Network.DEV:
      return '5W8cgQkGhjniKuVikNyVq6Nh5mWVzHawRnXkWhL7risj'
    default:
      throw new Error('Unknown network')
  }
}

export const MOCK_TOKENS = {
  USDC: '5ihkgQGjKvWvmMtywTgLdwokZ6hqFv5AgxSyYoCNufQW',
  USDT: '4cZv7KgYNgmr3NZSDhT5bhXGGttXKTndqyXeeC1cB6Xm',
  SOL: 'BJVjNqQzM1fywLWzzKbQEZ2Jsx9AVyhSLWzko3yF68PH',
  ANA: '8L61yauG9GSZBfeFwvcECjWoeTDnk1xuDYU7rksT92pp',
  MSOL: '4r8WDEvBntEr3dT69p7ua1rsaWcpTSHnKpY5JugDkcPQ',
  WSOL: 'So11111111111111111111111111111111111111112'
}
