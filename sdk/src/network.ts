export enum Network {
  LOCAL,
  DEV
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return '6jtEY7kz17tLjKCNTybJBz8GbXSjwAiV5Ufjqsiyauys'
    case Network.DEV:
      return '6jtEY7kz17tLjKCNTybJBz8GbXSjwAiV5Ufjqsiyauys'
    default:
      throw new Error('Unknown network')
  }
}

export const MOCK_TOKENS = {
  USDC: '5ihkgQGjKvWvmMtywTgLdwokZ6hqFv5AgxSyYoCNufQW',
  USDT: '4cZv7KgYNgmr3NZSDhT5bhXGGttXKTndqyXeeC1cB6Xm',
  SOL: 'BJVjNqQzM1fywLWzzKbQEZ2Jsx9AVyhSLWzko3yF68PH',
  MSOL: '4r8WDEvBntEr3dT69p7ua1rsaWcpTSHnKpY5JugDkcPQ',
  WSOL: 'So11111111111111111111111111111111111111112',
  BTC: '5yxSBhEoneFbEoJfbFrv99UDehno7oBHp6LC2ewL4JGA',
  REN_DOGE: '2tahrixCUKPRNnbmfcbKUWP8sgnT2ZzknkLP4qfrpcTM'
}
