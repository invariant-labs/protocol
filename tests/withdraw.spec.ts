import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { assertThrowsAsync, createToken, initEverything } from './testUtils'
import { Market, Pair, tou64, LIQUIDITY_DENOMINATOR, Network } from '@invariant-labs/sdk'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { CreateTick, InitPosition, RemovePosition, Swap } from '@invariant-labs/sdk/src/market'
import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'

describe('withdraw', () => {
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
    await initEverything(market, [pair], admin)
  })

  it('#withdraw', async () => {
    // Deposit
    const upperTick = 10
    const createTickVars: CreateTick = {
      pair,
      index: upperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)

    const lowerTick = -20
    const createTickVars2: CreateTick = {
      pair,
      index: lowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    const mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reservesBefore = await market.getReserveBalances(pair, tokenX, tokenY)

    const swapVars: Swap = {
      pair,
      xToY: true,
      owner: owner.publicKey,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true
    }
    await market.swap(swapVars, owner)

    // Check pool
    const poolData = await market.getPool(pair)
    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.equal(poolData.currentTickIndex, lowerTick)
    assert.ok(poolData.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reservesAfter = await market.getReserveBalances(pair, tokenX, tokenY)
    const reserveXDelta = reservesAfter.x.sub(reservesBefore.x)
    const reserveYDelta = reservesBefore.y.sub(reservesAfter.y)

    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(amount.subn(7)))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(amount.subn(7)))

    assert.ok(poolData.feeGrowthGlobalX.v.eq(new BN('4000000000000000000')))
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenX.eqn(2))
    assert.ok(poolData.feeProtocolTokenY.eqn(0))

    // Remove position
    const reservesBeforeRemove = await market.getReserveBalances(pair, tokenX, tokenY)

    const removePositionVars: RemovePosition = {
      pair,
      owner: positionOwner.publicKey,
      index: 0,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount
    }
    await market.removePosition(removePositionVars, positionOwner)

    // Check position after remove
    const positionList = await market.getPositionList(positionOwner.publicKey)
    assert.equal(positionList.head, 0)

    // Check amounts tokens
    const reservesAfterRemove = await market.getReserveBalances(pair, tokenX, tokenY)
    const expectedWithdrawnX = new BN(1493)
    const expectedWithdrawnY = new BN(6)
    const expectedFeeX = new BN(4)

    assert.ok(
      reservesBeforeRemove.x.sub(reservesAfterRemove.x).eq(expectedWithdrawnX.add(expectedFeeX))
    )
    assert.ok(reservesBeforeRemove.y.sub(reservesAfterRemove.y).eq(expectedWithdrawnY))

    await assertThrowsAsync(market.getTick(pair, upperTick))
    await assertThrowsAsync(market.getTick(pair, lowerTick))

    assert.isFalse(await market.isInitialized(pair, lowerTick))
    assert.isFalse(await market.isInitialized(pair, upperTick))
  })
})
