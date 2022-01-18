import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { createTokensAndPool, createUserWithTokens } from './testUtils'
import { Market, DENOMINATOR, Network, sleep } from '@invariant-labs/sdk'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { Decimal, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { Pair } from '@invariant-labs/sdk/src'
import { beforeEach } from 'mocha'
import { FEE_TIERS } from '@invariant-labs/sdk/lib/utils'

describe('limits', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const admin = Keypair.generate()
  let market: Market
  let pair: Pair
  let mintAuthority: Keypair
  const knownPrice: Decimal = { v: new BN(DENOMINATOR) }
  const feeTier = FEE_TIERS[0]

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )
    await connection.requestAirdrop(admin.publicKey, 1e10)
    await sleep(500)
    await market.createState(admin.publicKey, admin)
  })

  beforeEach(async () => {
    const result = await createTokensAndPool(market, connection, wallet, 0, feeTier)
    pair = result.pair
    mintAuthority = result.mintAuthority
  })

  it('many swaps', async () => {
    const mintAmount = new BN(2).pow(new BN(64)).subn(1)
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    const lowerTick = -10000
    const upperTick = 10000
    const liquidityDelta = DENOMINATOR.mul(new BN(10).pow(new BN(18)))

    const initPositionVars: InitPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta: { v: liquidityDelta }
    }
    await market.initPosition(initPositionVars, owner)

    const amount = new BN(1e9)

    let prevFee = (await market.getPool(pair)).feeGrowthGlobalX.v

    const chunk = 200
    const repeats = Infinity

    for (let i = 0; i < repeats; i++) {
      const swaps = new Array(chunk).fill(0).map(async (_, i) => {
        const swapVars: Swap = {
          pair,
          xToY: true,
          amount,
          knownPrice,
          slippage: toDecimal(5000 + i, 5),
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: true,
          owner: owner.publicKey
        }
        await market.swap(swapVars, owner)

        const swapVars2: Swap = {
          pair,
          xToY: false,
          amount: amount.subn(6),
          knownPrice,
          slippage: toDecimal(5000 + i, 5),
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: false,
          owner: owner.publicKey
        }
        await market.swap(swapVars2, owner)

        // commented out until 1.9 hits
        // const ixs = await Promise.all([oneWayTx, otherWayTx])
        // await signAndSend(new Transaction().add(ixs[0]).add(ixs[1]), [owner], connection)
      })

      await Promise.all(swaps)

      const poolAfter = await market.getPool(pair)
      const priceAfter = poolAfter.sqrtPrice.v

      if (i % 100 === 0) {
        console.log(`${i} swaps done`)
        console.log(`price: ${priceAfter.toString()}`)
        console.log(`fee: ${prevFee.mul(DENOMINATOR).toString()}`)
        console.log(`fee delta: ${prevFee.sub(poolAfter.feeGrowthGlobalX.v).toString()}`)
      }

      prevFee = poolAfter.feeGrowthGlobalX.v
    }
  })
})
