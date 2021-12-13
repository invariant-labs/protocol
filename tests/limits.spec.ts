import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import {
  assertThrowsAsync,
  createPoolWithLiquidity,
  createTokensAndPool,
  createUserWithTokens
} from './testUtils'
import { Market, DENOMINATOR, Network } from '@invariant-labs/sdk'
import { fromFee } from '@invariant-labs/sdk/src/utils'
import { Decimal } from '@invariant-labs/sdk/src/market'
import { Pair } from '@invariant-labs/sdk/src'
import { getLiquidityByX } from '@invariant-labs/sdk/src/math'

describe('limits', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  let market: Market
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

  let knownPrice: Decimal
  let expectedPrice: BN
  let pair: Pair
  let mintAuthority: Keypair

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )
    await market.createState(wallet, protocolFee)

    const result = await createTokensAndPool(market, connection, wallet)
    pair = result.pair
    mintAuthority = result.mintAuthority
  })

  it('big deposit', async () => {
    const mintAmount = new BN(2).pow(new BN(64)).sub(new BN(1))
    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )

    market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick: -10,
        upperTick: 10,
        liquidityDelta: getLiquidityByX(mintAmount, -10, 10, { v: DENOMINATOR }, false).liquidity
      },
      owner
    )
  })
})
