import * as anchor from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import {
  Market,
  Pair,
  calculatePriceSqrt,
  LIQUIDITY_DENOMINATOR,
  Network,
  sleep
} from '@invariant-labs/sdk'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { createToken, eqDecimal, initMarket, assertThrowsAsync } from './testUtils'
import { fromFee } from '@invariant-labs/sdk/src/utils'
import { CreatePool, CreateTick, InitPosition } from '@invariant-labs/sdk/src/market'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { createAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { getBalance } from '@invariant-labs/sdk/lib/utils'

// TODO: fix
describe('position', () => {
  const provider = AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = { fee: fromFee(new BN(20)), tickSpacing: 4 }
  const MAX_TICK = 177_450 // for tickSpacing 4
  const MIN_TICK = -MAX_TICK
  let market: Market
  let pair: Pair

  let initTick: number
  let xOwnerAmount: BN
  let yOwnerAmount: BN
  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    // Request airdrops
    await Promise.all([
      connection.requestAirdrop(wallet.publicKey, 1e9),
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])
    // Create pair
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])
    pair = new Pair(tokens[0], tokens[1], feeTier)
    await sleep(1000)
  })

  it('#create() should fail because of token addresses', async () => {
    const spoofPair = new Pair(pair.tokenX, pair.tokenY, feeTier)
    spoofPair.tokenX = pair.tokenY

    const createPoolVars: CreatePool = {
      pair: spoofPair,
      payer: admin,
      initTick
    }
    await assertThrowsAsync(market.createPool(createPoolVars))
  })

  it('#init()', async () => {
    initTick = -23028
    await initMarket(market, [pair], admin, initTick)
  })

  it('#createPositionList()', async () => {
    await market.createPositionList(positionOwner.publicKey, positionOwner)

    // checks position list
    const positionList = await market.getPositionList(positionOwner.publicKey)
    assert.equal(positionList.head, 0)
  })
  describe('#initPosition above current tick', () => {
    // -22980
    // 0
    // x = 21549
    // y = 0
    // liquidity = 100
    const lowerTick = -22980
    const upperTick = 0

    it('#createTick(lower)', async () => {
      const createTickVars: CreateTick = {
        pair,
        index: lowerTick,
        payer: admin.publicKey
      }
      await market.createTick(createTickVars, admin)

      const expectedZeroDecimal = new BN(0)
      const tick = await market.getTick(pair, lowerTick)
      const { tickBump } = await market.getTickAddress(pair, lowerTick)
      assert.ok(tick.index === lowerTick)
      assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
      assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
      assert.ok(tick.sqrtPrice.v.eq(calculatePriceSqrt(lowerTick).v))
      assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
      assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
      assert.ok(tick.bump === tickBump)
    })
    it('#createTick(upperTick)', async () => {
      const createTickVars: CreateTick = {
        pair,
        index: upperTick,
        payer: admin.publicKey
      }
      await market.createTick(createTickVars, admin)

      const expectedZeroDecimal = new BN(0)
      const tick = await market.getTick(pair, upperTick)
      const { tickBump } = await market.getTickAddress(pair, upperTick)
      assert.ok(tick.index === upperTick)
      assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
      assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
      assert.ok(tick.sqrtPrice.v.eq(calculatePriceSqrt(upperTick).v))
      assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
      assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
      assert.ok(tick.bump === tickBump)
    })
    it('init position', async () => {
      console.log(pair.tokenX.toString(), pair.tokenY.toString())
      const userTokenXAccount = await createAssociatedTokenAccount(
        connection,
        positionOwner,
        pair.tokenX,
        positionOwner.publicKey
      )
      const userTokenYAccount = await createAssociatedTokenAccount(
        connection,
        positionOwner,
        pair.tokenY,
        positionOwner.publicKey
      )

      xOwnerAmount = new BN(1e10)
      yOwnerAmount = new BN(1e10)

      await mintTo(
        connection,
        mintAuthority,
        pair.tokenX,
        userTokenXAccount,
        mintAuthority,
        xOwnerAmount
      )
      await mintTo(
        connection,
        mintAuthority,
        pair.tokenY,
        userTokenYAccount,
        mintAuthority,
        yOwnerAmount
      )

      const liquidityDelta = { v: LIQUIDITY_DENOMINATOR.muln(10_000) }
      const positionIndex = 0

      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick,
        upperTick,
        liquidityDelta,
        knownPrice: calculatePriceSqrt(initTick),
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, positionOwner)

      // load state
      const positionState = await market.getPosition(positionOwner.publicKey, positionIndex)
      const poolState = await market.getPool(pair)
      const lowerTickState = await market.getTick(pair, lowerTick)
      const upperTickState = await market.getTick(pair, upperTick)
      const reserveBalances = await market.getReserveBalances(pair)
      const userTokenXBalance = await getBalance(connection, userTokenXAccount)
      const userTokenYBalance = await getBalance(connection, userTokenYAccount)

      const { positionBump } = market.getPositionAddress(positionOwner.publicKey, positionIndex)
      const expectedZeroDecimal = new BN(0)
      const expectedXIncrease = new BN(21549)
      const expectedYIncrease = new BN(0)

      // check ticks
      assert.ok(lowerTickState.index === lowerTick)
      assert.ok(lowerTickState.sign)
      assert.ok(eqDecimal(lowerTickState.liquidityGross, liquidityDelta))
      assert.ok(eqDecimal(lowerTickState.liquidityChange, liquidityDelta))

      assert.ok(upperTickState.index === upperTick)
      assert.ok(!upperTickState.sign)
      assert.ok(eqDecimal(upperTickState.liquidityGross, liquidityDelta))
      assert.ok(eqDecimal(upperTickState.liquidityChange, liquidityDelta))

      // check pool
      assert.ok(eqDecimal(poolState.liquidity, { v: new BN(0) }))
      assert.ok(poolState.currentTickIndex === initTick)

      // check position
      const poolAddress = await pair.getAddress(market.program.programId)
      assert.ok(positionState.owner.equals(positionOwner.publicKey))
      assert.ok(positionState.pool.equals(poolAddress))
      assert.ok(positionState.id.eqn(0))
      assert.ok(positionState.liquidity.v.eq(liquidityDelta.v))
      assert.ok(positionState.lowerTickIndex === lowerTick)
      assert.ok(positionState.upperTickIndex === upperTick)
      assert.ok(positionState.feeGrowthInsideX.v.eq(expectedZeroDecimal))
      assert.ok(positionState.feeGrowthInsideY.v.eq(expectedZeroDecimal))
      assert.ok(positionState.bump === positionBump)

      // checks position list
      const positionList = await market.getPositionList(positionOwner.publicKey)
      assert.equal(positionList.head, positionIndex + 1)

      // balance transfer
      assert.ok(reserveBalances.x.eq(expectedXIncrease))
      assert.ok(reserveBalances.y.eq(expectedYIncrease))
      assert.ok(userTokenXBalance.eq(xOwnerAmount.sub(expectedXIncrease)))
      assert.ok(userTokenYBalance.eq(yOwnerAmount.sub(expectedYIncrease)))

      xOwnerAmount = userTokenXBalance
      yOwnerAmount = userTokenYBalance
    })
  })
  describe('#initPosition within current tick', () => {
    // min + 10
    // max - 10
    // x = 317
    // y = 32
    // liquidity = 100
    const lowerTick = MIN_TICK + 10
    const upperTick = MAX_TICK - 10

    it('#createTick(lower)', async () => {
      const createTickVars: CreateTick = {
        index: lowerTick,
        pair,
        payer: admin.publicKey
      }
      await market.createTick(createTickVars, admin)

      const expectedZeroDecimal = new BN(0)
      const tick = await market.getTick(pair, lowerTick)
      const { tickBump } = market.getTickAddress(pair, lowerTick)
      assert.ok(tick.pool.equals(await pair.getAddress(market.program.programId)))
      assert.ok(tick.index === lowerTick)
      assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
      assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
      assert.ok(tick.sqrtPrice.v.eq(calculatePriceSqrt(lowerTick).v))
      assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
      assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
      assert.ok(tick.bump === tickBump)
    })
    it('#createTick(upperTick)', async () => {
      const createTickVars: CreateTick = {
        index: upperTick,
        pair,
        payer: admin.publicKey
      }
      await market.createTick(createTickVars, admin)

      const expectedZeroDecimal = new BN(0)
      const tick = await market.getTick(pair, upperTick)
      const { tickBump } = await market.getTickAddress(pair, upperTick)
      assert.ok(tick.pool.equals(await pair.getAddress(market.program.programId)))
      assert.ok(tick.index === upperTick)
      assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
      assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
      assert.ok(tick.sqrtPrice.v.eq(calculatePriceSqrt(upperTick).v))
      assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
      assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
      assert.ok(tick.bump === tickBump)
    })
    it('init position', async () => {
      console.log(pair.tokenX.toString(), pair.tokenY.toString())
      const userTokenXAccount = await createAssociatedTokenAccount(
        connection,
        positionOwner,
        pair.tokenX,
        positionOwner.publicKey
      )
      const userTokenYAccount = await createAssociatedTokenAccount(
        connection,
        positionOwner,
        pair.tokenY,
        positionOwner.publicKey
      )
      xOwnerAmount = new BN(1e10)
      yOwnerAmount = new BN(1e10)

      await mintTo(
        connection,
        mintAuthority,
        pair.tokenX,
        userTokenXAccount,
        mintAuthority,
        xOwnerAmount
      )
      await mintTo(
        connection,
        mintAuthority,
        pair.tokenY,
        userTokenYAccount,
        mintAuthority,
        yOwnerAmount
      )

      const liquidityDelta = { v: LIQUIDITY_DENOMINATOR.muln(100) }
      const positionIndex = 1
      const reserveBalancesBefore = await market.getReserveBalances(pair)

      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick,
        upperTick,
        liquidityDelta,
        knownPrice: calculatePriceSqrt(initTick),
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, positionOwner)

      // load state
      const positionState = await market.getPosition(positionOwner.publicKey, positionIndex)
      const poolState = await market.getPool(pair)
      const lowerTickState = await market.getTick(pair, lowerTick)
      const upperTickState = await market.getTick(pair, upperTick)
      const reserveBalancesAfter = await market.getReserveBalances(pair)
      const userTokenXBalance = await getBalance(connection, userTokenXAccount)
      const userTokenYBalance = await getBalance(connection, userTokenYAccount)
      const { positionBump } = await market.getPositionAddress(
        positionOwner.publicKey,
        positionIndex
      )
      const expectedZeroDecimal = new BN(0)
      const expectedXIncrease = new BN(317)
      const expectedYIncrease = new BN(32)

      // check ticks
      assert.ok(lowerTickState.index === lowerTick)
      assert.ok(lowerTickState.sign)
      assert.ok(eqDecimal(lowerTickState.liquidityGross, liquidityDelta))
      assert.ok(eqDecimal(lowerTickState.liquidityChange, liquidityDelta))

      assert.ok(upperTickState.index === upperTick)
      assert.ok(!upperTickState.sign)
      assert.ok(eqDecimal(upperTickState.liquidityGross, liquidityDelta))
      assert.ok(eqDecimal(upperTickState.liquidityChange, liquidityDelta))

      // check pool
      assert.ok(eqDecimal(poolState.liquidity, liquidityDelta))
      assert.ok(poolState.currentTickIndex === initTick)

      // check position
      const poolAddress = await pair.getAddress(market.program.programId)
      assert.ok(positionState.owner.equals(positionOwner.publicKey))
      assert.ok(positionState.pool.equals(poolAddress))
      assert.ok(positionState.id.eqn(1))
      assert.ok(positionState.liquidity.v.eq(liquidityDelta.v))
      assert.ok(positionState.lowerTickIndex === lowerTick)
      assert.ok(positionState.upperTickIndex === upperTick)
      assert.ok(positionState.feeGrowthInsideX.v.eq(expectedZeroDecimal))
      assert.ok(positionState.feeGrowthInsideY.v.eq(expectedZeroDecimal))
      assert.ok(positionState.bump === positionBump)

      // checks position list
      const positionList = await market.getPositionList(positionOwner.publicKey)
      assert.equal(positionList.head, positionIndex + 1)

      // balance transfer
      assert.ok(reserveBalancesAfter.x.eq(reserveBalancesBefore.x.add(expectedXIncrease)))
      assert.ok(reserveBalancesAfter.y.eq(reserveBalancesBefore.y.add(expectedYIncrease)))
      assert.ok(userTokenXBalance.eq(xOwnerAmount.sub(expectedXIncrease)))
      assert.ok(userTokenYBalance.eq(yOwnerAmount.sub(expectedYIncrease)))

      xOwnerAmount = userTokenXBalance
      yOwnerAmount = userTokenYBalance
    })
  })
  describe('#initPosition below current tick', () => {
    // 23040
    // -4608
    // x = 0
    // y = 2162
    // liquidity = 10000
    const lowerTick = -46080
    const upperTick = -23040

    it('#createTick(lower)', async () => {
      const createTickVars: CreateTick = {
        pair,
        index: lowerTick,
        payer: admin.publicKey
      }
      await market.createTick(createTickVars, admin)

      const expectedZeroDecimal = new BN(0)
      const tick = await market.getTick(pair, lowerTick)
      const { tickBump } = await market.getTickAddress(pair, lowerTick)
      assert.ok(tick.index === lowerTick)
      assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
      assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
      assert.ok(tick.sqrtPrice.v.eq(calculatePriceSqrt(lowerTick).v))
      assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
      assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
      assert.ok(tick.bump === tickBump)
    })
    it('#createTick(upperTick)', async () => {
      const createTickVars: CreateTick = {
        pair,
        index: upperTick,
        payer: admin.publicKey
      }
      await market.createTick(createTickVars, admin)

      const expectedZeroDecimal = new BN(0)
      const tick = await market.getTick(pair, upperTick)
      const { tickBump } = await market.getTickAddress(pair, upperTick)
      assert.ok(tick.index === upperTick)
      assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
      assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
      assert.ok(tick.sqrtPrice.v.eq(calculatePriceSqrt(upperTick).v))
      assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
      assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
      assert.ok(tick.bump === tickBump)
    })
    it('init position', async () => {
      console.log(pair.tokenX.toString(), pair.tokenY.toString())
      const userTokenXAccount = await createAssociatedTokenAccount(
        connection,
        positionOwner,
        pair.tokenX,
        positionOwner.publicKey
      )
      const userTokenYAccount = await createAssociatedTokenAccount(
        connection,
        positionOwner,
        pair.tokenY,
        positionOwner.publicKey
      )

      xOwnerAmount = new BN(1e10)
      yOwnerAmount = new BN(1e10)

      await mintTo(
        connection,
        mintAuthority,
        pair.tokenX,
        userTokenXAccount,
        mintAuthority,
        xOwnerAmount
      )
      await mintTo(
        connection,
        mintAuthority,
        pair.tokenY,
        userTokenYAccount,
        mintAuthority,
        yOwnerAmount
      )

      console.log('all done')

      const liquidityDelta = { v: LIQUIDITY_DENOMINATOR.muln(10_000) }
      const positionIndex = 2
      const reserveBalancesBefore = await market.getReserveBalances(pair)
      const poolStateBefore = await market.getPool(pair)

      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick,
        upperTick,
        liquidityDelta,
        knownPrice: calculatePriceSqrt(initTick),
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, positionOwner)

      // load state
      const positionState = await market.getPosition(positionOwner.publicKey, positionIndex)
      const poolStateAfter = await market.getPool(pair)
      const lowerTickState = await market.getTick(pair, lowerTick)
      const upperTickState = await market.getTick(pair, upperTick)
      const reserveBalancesAfter = await market.getReserveBalances(pair)
      const userTokenXBalance = await getBalance(connection, userTokenXAccount)
      const userTokenYBalance = await getBalance(connection, userTokenYAccount)

      const { positionBump } = await market.getPositionAddress(
        positionOwner.publicKey,
        positionIndex
      )
      const expectedZeroDecimal = new BN(0)
      const expectedXIncrease = new BN(0)
      const expectedYIncrease = new BN(2162)

      // check ticks
      assert.ok(lowerTickState.index === lowerTick)
      assert.ok(lowerTickState.sign)
      assert.ok(eqDecimal(lowerTickState.liquidityGross, liquidityDelta))
      assert.ok(eqDecimal(lowerTickState.liquidityChange, liquidityDelta))

      assert.ok(upperTickState.index === upperTick)
      assert.ok(!upperTickState.sign)
      assert.ok(eqDecimal(upperTickState.liquidityGross, liquidityDelta))
      assert.ok(eqDecimal(upperTickState.liquidityChange, liquidityDelta))

      // check pool
      assert.ok(eqDecimal(poolStateAfter.liquidity, poolStateBefore.liquidity))
      assert.ok(poolStateAfter.currentTickIndex === initTick)

      // check position
      const poolAddress = await pair.getAddress(market.program.programId)
      assert.ok(positionState.owner.equals(positionOwner.publicKey))
      assert.ok(positionState.pool.equals(poolAddress))
      assert.ok(positionState.id.eqn(2))
      assert.ok(positionState.liquidity.v.eq(liquidityDelta.v))
      assert.ok(positionState.lowerTickIndex === lowerTick)
      assert.ok(positionState.upperTickIndex === upperTick)
      assert.ok(positionState.feeGrowthInsideX.v.eq(expectedZeroDecimal))
      assert.ok(positionState.feeGrowthInsideY.v.eq(expectedZeroDecimal))
      assert.ok(positionState.bump === positionBump)

      // checks position list
      const positionList = await market.getPositionList(positionOwner.publicKey)
      assert.equal(positionList.head, positionIndex + 1)

      // balance transfer
      assert.ok(reserveBalancesAfter.x.eq(reserveBalancesBefore.x.add(expectedXIncrease)))
      assert.ok(reserveBalancesAfter.y.eq(reserveBalancesBefore.y.add(expectedYIncrease)))
      assert.ok(userTokenXBalance.eq(xOwnerAmount.sub(expectedXIncrease)))
      assert.ok(userTokenYBalance.eq(yOwnerAmount.sub(expectedYIncrease)))

      xOwnerAmount = userTokenXBalance
      yOwnerAmount = userTokenYBalance
    })
  })
})
