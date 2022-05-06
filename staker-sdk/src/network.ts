export enum Network {
  LOCAL,
  DEV
}

export const getStakerAddress = (network: Network) => {
  switch (network) {
    case Network.LOCAL:
      return 'GqzPhMxtHjXhePt1EDHTBv2SVYEehmwAVbLdtUfNGi9J'
    case Network.DEV:
      return 'GqzPhMxtHjXhePt1EDHTBv2SVYEehmwAVbLdtUfNGi9J'
    default:
      throw new Error('Unknown network')
  }
}
