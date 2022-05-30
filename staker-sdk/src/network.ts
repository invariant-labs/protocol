export enum Network {
  LOCAL,
  DEV,
  MAIN
}

export const getStakerAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return 'MJ6WF1tpEJ7Gk8ULqejDJapRfqBwBEp1dH5QvAgYxu9'
    case Network.DEV:
      return 'GqzPhMxtHjXhePt1EDHTBv2SVYEehmwAVbLdtUfNGi9J'
    case Network.MAIN:
      return 'MJ6WF1tpEJ7Gk8ULqejDJapRfqBwBEp1dH5QvAgYxu9'
    default:
      throw new Error('Unknown network')
  }
}
