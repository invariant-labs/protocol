export enum Network {
  LOCAL,
  DEV
}

export const getMarketAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return 'FFtYJgUdvZwJkjx4YCTV61ik8rUY3HAp4dMzNkvV76Nx'
    case Network.DEV:
      return 'FFtYJgUdvZwJkjx4YCTV61ik8rUY3HAp4dMzNkvV76Nx'
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
