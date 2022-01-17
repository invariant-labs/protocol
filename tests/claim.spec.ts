import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { Network, Market, Pair, DENOMINATOR, TICK_LIMIT, tou64 } from '@invariant-labs/sdk'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  claimFee,
  createFeeTier,
  createPool,
  createPositionList,
  createState,
  createToken,
  initPosition,
  swap
} from './testUtils'
import { assert } from 'chai'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, Decimal } from '@invariant-labs/sdk/lib/market'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import {
  ClaimFee,
  CreateFeeTier,
  CreatePool,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/src/market'

describe('claim', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)), // 0.6%
    tickSpacing: 10
  }
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
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

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })
  it('#createState()', async () => {
    await createState(market, admin.publicKey, admin)
    const state = await market.getState()
    const { bump } = await market.getStateAddress()
    const { programAuthority, nonce } = await market.getProgramAuthority()

    assert.ok(state.admin.equals(admin.publicKey))
    assert.ok(state.authority.equals(programAuthority))
    assert.ok(state.nonce === nonce)
    assert.ok(state.bump === bump)
  })
  it('#createFeeTier()', async () => {
    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await createFeeTier(market, createFeeTierVars, admin)
  })
  it('#create()', async () => {
    const createPoolVars: CreatePool = {
      pair,
      payer: admin,
      protocolFee,
      tokenX,
      tokenY
    }
    await createPool(market, createPoolVars)
    const createdPool = await market.getPool(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex == 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v == 0))
  })
  it('#claim', async () => {
    const upperTick = 10
    const lowerTick = -20

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

    await createPositionList(market, positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta
    }
    await initPosition(market, initPositionVars, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))

    const swapper = Keypair.generate()
    await connection.requestAirdrop(swapper.publicKey, 1e9)

    const amount = new BN(1000)
    const accountX = await tokenX.createAccount(swapper.publicKey)
    const accountY = await tokenY.createAccount(swapper.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    const poolDataBefore = await market.getPool(pair)
    const reservesBeforeSwap = await market.getReserveBalances(pair, tokenX, tokenY)

    const swapVars: Swap = {
      pair,
      owner: swapper.publicKey,
      xToY: true,
      amount,
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true
    }
    await swap(market, swapVars, swapper)

    const poolDataAfter = await market.getPool(pair)
    assert.ok(poolDataAfter.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.ok(poolDataAfter.currentTickIndex == lowerTick)
    assert.ok(poolDataAfter.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reservesAfterSwap = await market.getReserveBalances(pair, tokenX, tokenY)
    const reserveXDelta = reservesAfterSwap.x.sub(reservesBeforeSwap.x)
    const reserveYDelta = reservesBeforeSwap.y.sub(reservesAfterSwap.y)

    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(amount.subn(7)))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(amount.subn(7)))
    assert.ok(poolDataAfter.feeGrowthGlobalX.v.eq(new BN('5000000000000000000')))
    assert.ok(poolDataAfter.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolDataAfter.feeProtocolTokenX.eqn(1))
    assert.ok(poolDataAfter.feeProtocolTokenY.eqn(0))

    const reservesBeforeClaim = await market.getReserveBalances(pair, tokenX, tokenY)
    const userTokenXAccountBeforeClaim = (await tokenX.getAccountInfo(userTokenXAccount)).amount
    const claimFeeVars: ClaimFee = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      index: 0
    }
    await claimFee(market, claimFeeVars, positionOwner)

    const userTokenXAccountAfterClaim = (await tokenX.getAccountInfo(userTokenXAccount)).amount
    const positionAfterClaim = await market.getPosition(positionOwner.publicKey, 0)
    const reservesAfterClaim = await market.getReserveBalances(pair, tokenX, tokenY)
    const expectedTokensClaimed = 5

    assert.ok(reservesBeforeClaim.x.subn(5).eq(reservesAfterClaim.x))
    assert.ok(positionAfterClaim.tokensOwedX.v.eqn(0))
    assert.ok(positionAfterClaim.feeGrowthInsideX.v.eq(poolDataAfter.feeGrowthGlobalX.v))
    assert.ok(
      userTokenXAccountAfterClaim.sub(userTokenXAccountBeforeClaim).eqn(expectedTokensClaimed)
    )
  })
})
