export enum Network {
  LOCAL,
  DEV
}

export const getStakerAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return '3o9gZuZia2fM8Uau6JGGAxY7ZoUQAieCosG9Ln3fYw1u'
    case Network.DEV:
      return '3o9gZuZia2fM8Uau6JGGAxY7ZoUQAieCosG9Ln3fYw1u'
    default:
      throw new Error('Unknown network')
  }
}
