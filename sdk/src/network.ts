export enum Network {
  LOCAL,
  DEV,
  MAIN
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return '48XDC18nH5FLq8kKfE6MJK2hcPFD7xsJQc4dSAgQWNAi'
    case Network.DEV:
      return '48XDC18nH5FLq8kKfE6MJK2hcPFD7xsJQc4dSAgQWNAi'
    case Network.MAIN:
      return '48XDC18nH5FLq8kKfE6MJK2hcPFD7xsJQc4dSAgQWNAi'
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
  BTC: '4gGKgUYvGkCT62Cu1zfPspuR7VPNPYrigXFmF9KTPji8',
  REN_DOGE: 'ArjgPxuQgaGXU16XSdBPDsCit7nxjAKR5Gvtvb2oFZUZ'
}

export const MAINNET_TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  UST: '9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i',
  UXD: '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT',
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', //wormhole
  WSOL: 'So11111111111111111111111111111111111111112',
  BTC: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E' //sollet
}
