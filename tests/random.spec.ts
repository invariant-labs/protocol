import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair, Transaction } from '@solana/web3.js'
import { createTokensAndPool, createUserWithTokens } from './testUtils'
import { Market, DENOMINATOR, Network, signAndSend } from '@invariant-labs/sdk'
import { fromFee, toDecimal } from '@invariant-labs/sdk/src/utils'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { Pair } from '@invariant-labs/sdk/src'
import { beforeEach } from 'mocha'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { FEE_TIERS } from '@invariant-labs/sdk/lib/utils'

describe('limits', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let market: Market
  let tokenX: Token
  let tokenY: Token
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
    await market.createState(wallet, protocolFee)
  })

  beforeEach(async () => {
    const result = await createTokensAndPool(market, connection, wallet, 0, feeTier)
    pair = result.pair
    mintAuthority = result.mintAuthority

    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
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

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta: { v: liquidityDelta }
      },
      owner
    )

    const amount = new BN(1e9)

    const priceBefore = (await market.get(pair)).sqrtPrice.v
    let prevFee = (await market.get(pair)).feeGrowthGlobalX.v

    const chunk = 200
    const repeats = Infinity

    for (let i = 0; i < repeats; i++) {
      const swaps = new Array(chunk).fill(0).map(async (_, i) => {
        const oneWayTx = market.swapTransaction({
          pair,
          XtoY: true,
          amount,
          knownPrice,
          slippage: toDecimal(5000 + i, 5),
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: true,
          owner: owner.publicKey
        })

        const otherWayTx = market.swapTransaction({
          pair,
          XtoY: false,
          amount: amount.subn(6),
          knownPrice,
          slippage: toDecimal(5000 + i, 5),
          accountX: userAccountX,
          accountY: userAccountY,
          byAmountIn: false,
          owner: owner.publicKey
        })

        // commented out until 1.9 hits
        // const ixs = await Promise.all([oneWayTx, otherWayTx])
        // await signAndSend(new Transaction().add(ixs[0]).add(ixs[1]), [owner], connection)

        await signAndSend(new Transaction().add(await oneWayTx), [owner], connection)
        await signAndSend(new Transaction().add(await otherWayTx), [owner], connection)
      })

      await Promise.all(swaps)

      const poolAfter = await market.get(pair)
      const priceAfter = poolAfter.sqrtPrice.v

      if (i % 100 === 0) {
        console.log(`${i} swaps done`)
        console.log(`price: ${priceAfter.toString()}`)
        console.log(`fee: ${prevFee.mul(DENOMINATOR)}`)
        console.log(`fee delta: ${prevFee.sub(poolAfter.feeGrowthGlobalX.v).toString()}`)
      }

      prevFee = poolAfter.feeGrowthGlobalX.v
    }
  })
})
