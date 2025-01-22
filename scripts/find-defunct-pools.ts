import { Provider } from '@project-serum/anchor'
import { Network } from '@invariant-labs/sdk/src/network'
import { Market } from '@invariant-labs/sdk/src'
import { Decimal, PoolStructure } from '@invariant-labs/sdk/lib/market'
import { DECIMAL } from '@invariant-labs/sdk/lib/utils'
import { DENOMINATOR } from '@invariant-labs/sdk'

require('dotenv').config()
console.log(process.cwd())

const provider = Provider.local(
  'https://mainnet.helius-rpc.com/?api-key=ef843b40-9876-4a02-a181-a1e6d3e61b4c'
)

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.MAIN, provider.wallet, connection)

  const allPools = await market.getAllPools()
  const allTickmaps = Object.fromEntries(
    (await market.program.account.tickmap.all()).map(x => [x.publicKey, x.account.bitmap])
  )

  const emptyPools: PoolStructure[] = []

  for (const poolState of allPools) {
    const tickmap: number[] = allTickmaps[poolState.tickmap.toString()]

    const empty = !tickmap.some((tick: number) => tick !== 0)
    if (empty) {
      emptyPools.push(poolState)
      console.log(
        poolState.tokenX.toString(),
        poolState.tokenY.toString(),
        formatFee(poolState.fee),
        poolState.tickSpacing.toString()
      )
    }
  }

  console.log(emptyPools.length)
  console.log(allPools.length)
}

main()

export const formatFee = (fee: Decimal) => {
  const feeB = BigInt(fee.v.toString())
  const feeDenominator = BigInt(DENOMINATOR)
  let afterDot = (feeB % feeDenominator).toString()
  return (feeB / feeDenominator).toString() + '.' + '0'.repeat(DECIMAL - afterDot.length) + afterDot
}
