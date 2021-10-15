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
