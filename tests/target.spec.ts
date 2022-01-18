import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken, createUserWithTokens } from './testUtils'
import { Market, Pair, tou64, DENOMINATOR, TICK_LIMIT, Network } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/src/market'

describe('target', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
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

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)
  })
  it('#create()', async () => {
    const createPoolVars: CreatePool = {
      pair,
      payer: admin,
      tokenX,
      tokenY
    }
    await market.createPool(createPoolVars)

    const createdPool = await market.getPool(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(pair.feeTier.fee))
    assert.equal(createdPool.tickSpacing, pair.feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex === 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length === TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v === 0))
  })

  it('#swap by target', async () => {
    // Deposit
    const upperTick = 30
    const createTickVars: CreateTick = {
      pair,
      index: upperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)

    const lowerTick = -30
    const createTickVars2: CreateTick = {
      pair,
      index: lowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)

    const mintAmount = new BN(10).pow(new BN(10))

    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )
    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

    const initPositionVars: InitPosition = {
      pair,
      owner: owner.publicKey,
      userTokenX: userAccountX,
      userTokenY: userAccountY,
      lowerTick,
      upperTick,
      liquidityDelta
    }
    await market.initPosition(initPositionVars, owner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    const swapper = Keypair.generate()
    await connection.requestAirdrop(swapper.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await tokenX.createAccount(swapper.publicKey)
    const accountY = await tokenY.createAccount(swapper.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reservesBefore = await market.getReserveBalances(pair, tokenX, tokenY)

    const swapVars: Swap = {
      pair,
      xToY: true,
      owner: swapper.publicKey,
      amount,
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: false
    }
    await market.swap(swapVars, swapper)

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

    assert.ok(amountX.eq(mintAmount.sub(amount).subn(9)))
    assert.ok(amountY.eq(amount))
    assert.ok(reserveXDelta.eq(amount.addn(9)))
    assert.ok(reserveYDelta.eq(amount))

    assert.equal(poolData.feeGrowthGlobalX.v.toString(), '6000000000000000000') // 0.6 % of amount - protocol fee
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenX.eqn(1))
    assert.ok(poolData.feeProtocolTokenY.eqn(0))
  })
})
