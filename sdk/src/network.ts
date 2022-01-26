export enum Network {
  LOCAL,
  DEV
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return 'Ag59kszeH2E1NFAwkV1A4uiWrLR8Motfj4zcx2TZpy6v'
    case Network.DEV:
      return 'Ag59kszeH2E1NFAwkV1A4uiWrLR8Motfj4zcx2TZpy6v'
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
