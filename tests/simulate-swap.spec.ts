import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import {
  Market,
  Pair,
  tou64,
  DENOMINATOR,
  signAndSend,
  TICK_LIMIT,
  Network,
  calculatePriceSqrt
} from '@invariant-labs/sdk'
import { FeeTier, Decimal, CreateFeeTier, CreatePool, CreateTick, InitPosition, Swap } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { createFeeTier, createPool, createPositionList, createState, createTick, createToken, initPosition, swap } from './testUtils'
//TODO add to tests
describe('swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) } // 10%
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
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await createState(market, admin.publicKey, admin)

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
    assert.ok(createdPool.currentTickIndex === 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v == 0))
  })
  it('#swap()', async () => {
    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    const mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    await createPositionList(market, positionOwner.publicKey, positionOwner)

    const liquidityDelta = { v: new BN(2000000).mul(DENOMINATOR) }
    for (let i = -200; i < 200; i += 10) {
      const initPositionVars: InitPosition = {
        pair,
          owner: positionOwner.publicKey,
          userTokenX: userTokenXAccount,
          userTokenY: userTokenYAccount,
          lowerTick: i,
          upperTick: i + 10,
          liquidityDelta: liquidityDelta
      }
      await initPosition(market, initPositionVars, positionOwner)
    }
    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)

    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(new BN(10000)))

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reserveXBefore = (await tokenX.getAccountInfo(poolDataBefore.tokenXReserve)).amount
    const reserveYBefore = (await tokenY.getAccountInfo(poolDataBefore.tokenYReserve)).amount

    //make swap into right to move price from tick 0
    const swapVars: Swap = {
      pair,
      xToY: false,
      amount: new BN(500),
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(2, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey,
    }
    await swap(market, swapVars, owner)

    //make swap bigger than cross tick
    const swapVars2: Swap = {
      pair,
      xToY: true,
      amount: new BN(3000),
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(2, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: owner.publicKey,
    }
    await swap(market, swapVars2, owner)

    // Check pool
    const poolData = await market.getPool(pair)

    // Check amounts and fees
    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reserveXAfter = (await tokenX.getAccountInfo(poolData.tokenXReserve)).amount
    const reserveYAfter = (await tokenY.getAccountInfo(poolData.tokenYReserve)).amount
    const reserveXDelta = reserveXAfter.sub(reserveXBefore)
    const reserveYDelta = reserveYBefore.sub(reserveYAfter)

    console.log(amountX.toString())
    assert.ok(amountX.eqn(7496))
    console.log(amountY.toString())
    //assert.ok(amountY.eqn(12477))
    assert.ok(reserveXDelta.eqn(2504))
    //assert.ok(reserveYDelta.eqn(2477))

    assert.ok(poolData.feeGrowthGlobalX.v.eqn(8099936)) // 0.6 % of amount - protocol fee
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(1350000))
    assert.ok(poolData.feeProtocolTokenX.eq(new BN(1799986631284)))
    assert.ok(poolData.feeProtocolTokenY.eq(new BN(300000000000)))
  })
})
