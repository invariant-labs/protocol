import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, initMarket } from './testUtils'
import { Market, Pair, LIQUIDITY_DENOMINATOR, Network } from '@invariant-labs/sdk/src'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { computeUnitsInstruction, signAndSend } from '@invariant-labs/sdk'

describe('Max tick crosses', () => {
  //const provider = Provider.local(undefined, { skipPreflight: true })
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  let market: Market
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    // Request airdrops
    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#swap() max crosses', async () => {
    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN(10000000).mul(LIQUIDITY_DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    for (let i = -200; i < 20; i += 10) {
      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: i,
        upperTick: i + 10,
        liquidityDelta,
        knownPrice: (await market.getPool(pair)).sqrtPrice,
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, positionOwner)
    }

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

    const amount = new BN(95000)
    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    // Swap
    const poolDataBefore = await market.getPool(pair)

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 0),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey
    }

    const swapTx = await market.swapTransaction(swapVars)
    await signAndSend(swapTx, [owner], connection)

    // Check crosses
    const poolData = await market.getPool(pair)
    const crosses = Math.abs((poolData.currentTickIndex - poolDataBefore.currentTickIndex) / 10)
    assert.equal(crosses, 19)
  })
})
