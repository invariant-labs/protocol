import * as anchor from '@project-serum/anchor'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import {
  Market,
  Pair,
  SEED,
  tou64,
  TICK_LIMIT,
  signAndSend,
  calculate_price_sqrt,
  fromInteger,
  Network
} from '@invariant-labs/sdk'
import { Provider, Program, BN } from '@project-serum/anchor'
import { Token, u64, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createToken, eqDecimal } from './testUtils'
import { MAX_TICK } from '@invariant-labs/sdk/lib/math'
import { MIN_TICK } from '@invariant-labs/sdk/lib/math'
import { assertThrowsAsync } from '@invariant-labs/sdk/src/utils'

describe('Position list', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  const market = new Market(
    Network.LOCAL,
    provider.wallet,
    connection,
    anchor.workspace.Amm.programId
  )
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let programAuthority: PublicKey
  let nonce: number
  let initTick: number
  let ticksIndexes: Array<number>
  let xOwnerAmount: u64
  let yOwnerAmount: u64
  let userTokenXAccount: PublicKey
  let userTokenYAccount: PublicKey

  before(async () => {
    const swaplineProgram = anchor.workspace.Amm as Program
    const [_programAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(SEED)],
      swaplineProgram.programId
    )
    nonce = _nonce
    programAuthority = _programAuthority
    // Request airdrops
    await Promise.all([
      await connection.requestAirdrop(wallet.publicKey, 1e9),
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(admin.publicKey, 1e9),
      await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])
    // Create pair
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    // user deposit
    userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)
  })
  it('Prepare pool', async () => {
    const fee = 600
    const tickSpacing = 3
    initTick = -23028

    await market.create({
      pair,
      signer: admin,
      initTick,
      fee,
      tickSpacing
    })
    await market.createPositionList(positionOwner)

    ticksIndexes = [-9780, -42, 0, 9, 276, 32343]
    Promise.all(
      ticksIndexes.map(async (tickIndex) => {
        const ix = await market.createTickInstruction(pair, tickIndex, wallet.publicKey)
        await signAndSend(new Transaction().add(ix), [wallet], connection)
      })
    )
  })
  it('Remove from empty list should failed', async () => {
    const ix = await market.removePositionInstruction(positionOwner.publicKey, 0)
    assertThrowsAsync(signAndSend(new Transaction().add(ix), [positionOwner], connection))
  })
  it('Add multiple position', async () => {
    xOwnerAmount = tou64(1e10)
    yOwnerAmount = tou64(1e10)

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[1],
        liquidityDelta: fromInteger(1)
      },
      positionOwner
    )
    // create position with the same tick should pass
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[1],
        liquidityDelta: fromInteger(1)
      },
      positionOwner
    )
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[2],
        liquidityDelta: fromInteger(1)
      },
      positionOwner
    )
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[1],
        upperTick: ticksIndexes[4],
        liquidityDelta: fromInteger(1)
      },
      positionOwner
    )
  })
  it('Remove middle position', async () => {
    const positionIndexToRemove = 2
    const positionListBefore = await market.getPositionList(positionOwner.publicKey)
    const positionsBefore = await market.getPositionsFromRange(
      positionOwner.publicKey,
      0,
      positionListBefore.head - 1
    )
    const lastPosition = positionsBefore[positionListBefore.head - 1]

    const ix = await market.removePositionInstruction(
      positionOwner.publicKey,
      positionIndexToRemove
    )
    await signAndSend(new Transaction().add(ix), [positionOwner], connection)

    const positionListAfter = await market.getPositionList(positionOwner.publicKey)
    const positionsAfter = await market.getPositionsFromRange(
      positionOwner.publicKey,
      0,
      positionListAfter.head - 1
    )

    // check position list head
    assert.ok(positionListBefore.head - 1 == positionListAfter.head)

    // last position should be at removed index
    const testedPosition = positionsAfter[positionIndexToRemove]
    assert.ok(lastPosition.pool.equals(testedPosition.pool))
    assert.ok(eqDecimal(lastPosition.liquidity, testedPosition.liquidity))
    assert.ok(lastPosition.lowerTickIndex === testedPosition.lowerTickIndex)
    assert.ok(lastPosition.upperTickIndex === testedPosition.upperTickIndex)
    assert.ok(eqDecimal(lastPosition.feeGrowthInsideX, testedPosition.feeGrowthInsideX))
    assert.ok(eqDecimal(lastPosition.feeGrowthInsideY, testedPosition.feeGrowthInsideY))
    assert.ok(eqDecimal(lastPosition.tokensOwedX, testedPosition.tokensOwedX))
    assert.ok(eqDecimal(lastPosition.tokensOwedY, testedPosition.tokensOwedY))
  })
  it('Add position in place of the removed one', async () => {
    const positionListBefore = await market.getPositionList(positionOwner.publicKey)
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[1],
        upperTick: ticksIndexes[2],
        liquidityDelta: fromInteger(1)
      },
      positionOwner
    )
    const positionListAfter = await market.getPositionList(positionOwner.publicKey)

    assert.equal(positionListBefore.head + 1, positionListAfter.head)
  })
  it('Remove last position', async () => {
    const lastPositionIndexBefore = (await market.getPositionList(positionOwner.publicKey)).head - 1
    const ix = await market.removePositionInstruction(
      positionOwner.publicKey,
      lastPositionIndexBefore
    )
    await signAndSend(new Transaction().add(ix), [positionOwner], connection)

    const lastPositionIndexAfter = (await market.getPositionList(positionOwner.publicKey)).head - 1
    assert.equal(lastPositionIndexBefore - 1, lastPositionIndexAfter)
  })
  it('Only owner can modify position list', async () => {
    const positionListBefore = await market.getPositionList(positionOwner.publicKey)
    const ix = await market.initPositionInstruction({
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: ticksIndexes[0],
      upperTick: ticksIndexes[3],
      liquidityDelta: fromInteger(1)
    })

    signAndSend(new Transaction().add(ix), [wallet], connection)

    const positionListAfter = await market.getPositionList(positionOwner.publicKey)
    assert.equal(positionListBefore.head, positionListAfter.head)
  })
  // it('remove all positions', async () => {
  // const positionListBefore = await market.getPositionList(positionOwner.publicKey)
  // console.log(`head: ${positionListBefore.head}`)
  // const ix = await market.removePositionInstruction(positionOwner.publicKey, 0)
  // await signAndSend(new Transaction().add(ix), [positionOwner], connection)

  // const ix2 = await market.removePositionInstruction(positionOwner.publicKey, 2)
  // await signAndSend(new Transaction().add(ix2), [positionOwner], connection)

  // const ix1 = await market.removePositionInstruction(positionOwner.publicKey, 1)
  // await signAndSend(new Transaction().add(ix1), [positionOwner], connection)

  // const ix0 = await market.removePositionInstruction(positionOwner.publicKey, 0)
  // await signAndSend(new Transaction().add(ix0), [positionOwner], connection)

  // for (let i = positionListBefore.head - 1; i > 0; i--) {
  //   console.log(i)
  //   // const ix = await market.removePositionInstruction(positionOwner.publicKey, i)
  //   // await signAndSend(new Transaction().add(ix), [positionOwner], connection)
  // }
  // })
  // describe('#initPosition above current tick', async () => {
  //   it('init position', async () => {
  //     const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
  //     const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

  //     xOwnerAmount = tou64(1e10)
  //     yOwnerAmount = tou64(1e10)

  //     await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
  //     await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

  //     const liquidityDelta = fromInteger(10_000)
  //     const positionIndex = 0

  //     await market.initPosition(
  //       {
  //         pair,
  //         owner: positionOwner.publicKey,
  //         userTokenX: userTokenXAccount,
  //         userTokenY: userTokenYAccount,
  //         index: positionIndex,
  //         lowerTick,
  //         upperTick,
  //         liquidityDelta
  //       },
  //       positionOwner
  //     )

  //     // load state
  //     const positionState = await market.getPosition(positionOwner.publicKey, positionIndex)
  //     const poolState = await market.get(pair)
  //     const lowerTickState = await market.getTick(pair, lowerTick)
  //     const upperTickState = await market.getTick(pair, upperTick)
  //     const reserveBalances = await market.getReserveBalances(pair, wallet)
  //     const userTokenXBalance = (await tokenX.getAccountInfo(userTokenXAccount)).amount
  //     const userTokenYBalance = (await tokenY.getAccountInfo(userTokenYAccount)).amount

  //     const { positionBump } = await market.getPositionAddress(
  //       positionOwner.publicKey,
  //       positionIndex
  //     )
  //     const expectedZeroDecimal = new BN(0)
  //     const expectedXIncrease = new BN(21549)
  //     const expectedYIncrease = new BN(0)

  //     // check ticks
  //     assert.ok(lowerTickState.index === lowerTick)
  //     assert.ok(lowerTickState.sign === true)
  //     assert.ok(eqDecimal(lowerTickState.liquidityGross, liquidityDelta))
  //     assert.ok(eqDecimal(lowerTickState.liquidityChange, liquidityDelta))

  //     assert.ok(upperTickState.index === upperTick)
  //     assert.ok(upperTickState.sign === false)
  //     assert.ok(eqDecimal(upperTickState.liquidityGross, liquidityDelta))
  //     assert.ok(eqDecimal(upperTickState.liquidityChange, liquidityDelta))

  //     // check pool
  //     assert.ok(eqDecimal(poolState.liquidity, { v: new BN(0) }))
  //     assert.ok(poolState.currentTickIndex === initTick)

  //     // check position
  //     const poolAddress = await pair.getAddress(market.program.programId)
  //     assert.ok(positionState.owner.equals(positionOwner.publicKey))
  //     assert.ok(positionState.pool.equals(poolAddress))
  //     assert.ok(positionState.liquidity.v.eq(liquidityDelta.v))
  //     assert.ok(positionState.lowerTickIndex == lowerTick)
  //     assert.ok(positionState.upperTickIndex == upperTick)
  //     assert.ok(positionState.feeGrowthInsideX.v.eq(expectedZeroDecimal))
  //     assert.ok(positionState.feeGrowthInsideY.v.eq(expectedZeroDecimal))
  //     assert.ok(positionState.bump == positionBump)

  //     // checks position list
  //     const positionList = await market.getPositionList(positionOwner.publicKey)
  //     assert.equal(positionList.head, positionIndex + 1)

  //     // balance transfer
  //     assert.ok(reserveBalances.x.eq(expectedXIncrease))
  //     assert.ok(reserveBalances.y.eq(expectedYIncrease))
  //     assert.ok(userTokenXBalance.eq(xOwnerAmount.sub(expectedXIncrease)))
  //     assert.ok(userTokenYBalance.eq(yOwnerAmount.sub(expectedYIncrease)))

  //     xOwnerAmount = userTokenXBalance
  //     yOwnerAmount = userTokenYBalance
  //   })
  // })
  // describe('#initPosition within current tick', async () => {
  //   // min + 10
  //   // max - 10
  //   // x = 317
  //   // y = 32
  //   // liquidity = 100
  //   const lowerTick = MIN_TICK + 10
  //   const upperTick = MAX_TICK - 10

  //   it('#createTick(lower)', async () => {
  //     const ix = await market.createTickInstruction(pair, lowerTick, wallet.publicKey)
  //     await signAndSend(new Transaction().add(ix), [wallet], connection)

  //     const expectedZeroDecimal = new BN(0)
  //     const tick = await market.getTick(pair, lowerTick)
  //     const { tickBump } = await market.getTickAddress(pair, lowerTick)
  //     assert.ok(tick.index == lowerTick)
  //     assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.sqrtPrice.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.bump == tickBump)
  //   })
  //   it('#createTick(upperTick)', async () => {
  //     const ix = await market.createTickInstruction(pair, upperTick, wallet.publicKey)
  //     await signAndSend(new Transaction().add(ix), [wallet], connection)

  //     const expectedZeroDecimal = new BN(0)
  //     const tick = await market.getTick(pair, upperTick)
  //     const { tickBump } = await market.getTickAddress(pair, upperTick)
  //     assert.ok(tick.index == upperTick)
  //     assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.sqrtPrice.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.bump == tickBump)
  //   })
  //   it('init position', async () => {
  //     const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
  //     const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

  //     xOwnerAmount = tou64(1e10)
  //     yOwnerAmount = tou64(1e10)
  //     await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
  //     await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

  //     const liquidityDelta = fromInteger(100)
  //     const positionIndex = 1
  //     const reserveBalancesBefore = await market.getReserveBalances(pair, wallet)

  //     await market.initPosition(
  //       {
  //         pair,
  //         owner: positionOwner.publicKey,
  //         userTokenX: userTokenXAccount,
  //         userTokenY: userTokenYAccount,
  //         index: positionIndex,
  //         lowerTick,
  //         upperTick,
  //         liquidityDelta
  //       },
  //       positionOwner
  //     )

  //     // load state
  //     const positionState = await market.getPosition(positionOwner.publicKey, positionIndex)
  //     const poolState = await market.get(pair)
  //     const lowerTickState = await market.getTick(pair, lowerTick)
  //     const upperTickState = await market.getTick(pair, upperTick)
  //     const reserveBalancesAfter = await market.getReserveBalances(pair, wallet)
  //     const userTokenXBalance = (await tokenX.getAccountInfo(userTokenXAccount)).amount
  //     const userTokenYBalance = (await tokenY.getAccountInfo(userTokenYAccount)).amount

  //     const { positionBump } = await market.getPositionAddress(
  //       positionOwner.publicKey,
  //       positionIndex
  //     )
  //     const expectedZeroDecimal = new BN(0)
  //     const expectedXIncrease = new BN(317)
  //     const expectedYIncrease = new BN(32)

  //     // check ticks
  //     assert.ok(lowerTickState.index === lowerTick)
  //     assert.ok(lowerTickState.sign === true)
  //     assert.ok(eqDecimal(lowerTickState.liquidityGross, liquidityDelta))
  //     assert.ok(eqDecimal(lowerTickState.liquidityChange, liquidityDelta))

  //     assert.ok(upperTickState.index === upperTick)
  //     assert.ok(upperTickState.sign === false)
  //     assert.ok(eqDecimal(upperTickState.liquidityGross, liquidityDelta))
  //     assert.ok(eqDecimal(upperTickState.liquidityChange, liquidityDelta))

  //     // check pool
  //     assert.ok(eqDecimal(poolState.liquidity, liquidityDelta))
  //     assert.ok(poolState.currentTickIndex === initTick)

  //     // check position
  //     const poolAddress = await pair.getAddress(market.program.programId)
  //     assert.ok(positionState.owner.equals(positionOwner.publicKey))
  //     assert.ok(positionState.pool.equals(poolAddress))
  //     assert.ok(positionState.liquidity.v.eq(liquidityDelta.v))
  //     assert.ok(positionState.lowerTickIndex == lowerTick)
  //     assert.ok(positionState.upperTickIndex == upperTick)
  //     assert.ok(positionState.feeGrowthInsideX.v.eq(expectedZeroDecimal))
  //     assert.ok(positionState.feeGrowthInsideY.v.eq(expectedZeroDecimal))
  //     assert.ok(positionState.bump == positionBump)

  //     // checks position list
  //     const positionList = await market.getPositionList(positionOwner.publicKey)
  //     assert.equal(positionList.head, positionIndex + 1)

  //     // balance transfer
  //     assert.ok(reserveBalancesAfter.x.eq(reserveBalancesBefore.x.add(expectedXIncrease)))
  //     assert.ok(reserveBalancesAfter.y.eq(reserveBalancesBefore.y.add(expectedYIncrease)))
  //     assert.ok(userTokenXBalance.eq(xOwnerAmount.sub(expectedXIncrease)))
  //     assert.ok(userTokenYBalance.eq(yOwnerAmount.sub(expectedYIncrease)))

  //     xOwnerAmount = userTokenXBalance
  //     yOwnerAmount = userTokenYBalance
  //   })
  // })
  // describe('#initPosition below current tick', async () => {
  //   // 23040
  //   // -4608
  //   // x = 0
  //   // y = 2162
  //   // liquidity = 10000
  //   const lowerTick = -46080
  //   const upperTick = -23040

  //   it('#createTick(lower)', async () => {
  //     const ix = await market.createTickInstruction(pair, lowerTick, wallet.publicKey)
  //     await signAndSend(new Transaction().add(ix), [wallet], connection)

  //     const expectedZeroDecimal = new BN(0)
  //     const tick = await market.getTick(pair, lowerTick)
  //     const { tickBump } = await market.getTickAddress(pair, lowerTick)
  //     assert.ok(tick.index == lowerTick)
  //     assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.sqrtPrice.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.bump == tickBump)
  //   })
  //   it('#createTick(upperTick)', async () => {
  //     const ix = await market.createTickInstruction(pair, upperTick, wallet.publicKey)
  //     await signAndSend(new Transaction().add(ix), [wallet], connection)

  //     const expectedZeroDecimal = new BN(0)
  //     const tick = await market.getTick(pair, upperTick)
  //     const { tickBump } = await market.getTickAddress(pair, upperTick)
  //     assert.ok(tick.index == upperTick)
  //     assert.ok(tick.liquidityChange.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.liquidityGross.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.sqrtPrice.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideX.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.feeGrowthOutsideY.v.eq(expectedZeroDecimal))
  //     assert.ok(tick.bump == tickBump)
  //   })
  //   it('init position', async () => {
  //     const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
  //     const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

  //     xOwnerAmount = tou64(1e10)
  //     yOwnerAmount = tou64(1e10)
  //     await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
  //     await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

  //     const liquidityDelta = fromInteger(10_000)
  //     const positionIndex = 2
  //     const reserveBalancesBefore = await market.getReserveBalances(pair, wallet)
  //     const poolStateBefore = await market.get(pair)

  //     await market.initPosition(
  //       {
  //         pair,
  //         owner: positionOwner.publicKey,
  //         userTokenX: userTokenXAccount,
  //         userTokenY: userTokenYAccount,
  //         index: positionIndex,
  //         lowerTick,
  //         upperTick,
  //         liquidityDelta
  //       },
  //       positionOwner
  //     )

  //     // load state
  //     const positionState = await market.getPosition(positionOwner.publicKey, positionIndex)
  //     const poolStateAfter = await market.get(pair)
  //     const lowerTickState = await market.getTick(pair, lowerTick)
  //     const upperTickState = await market.getTick(pair, upperTick)
  //     const reserveBalancesAfter = await market.getReserveBalances(pair, wallet)
  //     const userTokenXBalance = (await tokenX.getAccountInfo(userTokenXAccount)).amount
  //     const userTokenYBalance = (await tokenY.getAccountInfo(userTokenYAccount)).amount

  //     const { positionBump } = await market.getPositionAddress(
  //       positionOwner.publicKey,
  //       positionIndex
  //     )
  //     const expectedZeroDecimal = new BN(0)
  //     const expectedXIncrease = new BN(0)
  //     const expectedYIncrease = new BN(2162)

  //     // check ticks
  //     assert.ok(lowerTickState.index === lowerTick)
  //     assert.ok(lowerTickState.sign === true)
  //     assert.ok(eqDecimal(lowerTickState.liquidityGross, liquidityDelta))
  //     assert.ok(eqDecimal(lowerTickState.liquidityChange, liquidityDelta))

  //     assert.ok(upperTickState.index === upperTick)
  //     assert.ok(upperTickState.sign === false)
  //     assert.ok(eqDecimal(upperTickState.liquidityGross, liquidityDelta))
  //     assert.ok(eqDecimal(upperTickState.liquidityChange, liquidityDelta))

  //     // check pool
  //     assert.ok(eqDecimal(poolStateAfter.liquidity, poolStateBefore.liquidity))
  //     assert.ok(poolStateAfter.currentTickIndex === initTick)

  //     // check position
  //     const poolAddress = await pair.getAddress(market.program.programId)
  //     assert.ok(positionState.owner.equals(positionOwner.publicKey))
  //     assert.ok(positionState.pool.equals(poolAddress))
  //     assert.ok(positionState.liquidity.v.eq(liquidityDelta.v))
  //     assert.ok(positionState.lowerTickIndex == lowerTick)
  //     assert.ok(positionState.upperTickIndex == upperTick)
  //     assert.ok(positionState.feeGrowthInsideX.v.eq(expectedZeroDecimal))
  //     assert.ok(positionState.feeGrowthInsideY.v.eq(expectedZeroDecimal))
  //     assert.ok(positionState.bump == positionBump)

  //     // checks position list
  //     const positionList = await market.getPositionList(positionOwner.publicKey)
  //     assert.equal(positionList.head, positionIndex + 1)

  //     // balance transfer
  //     assert.ok(reserveBalancesAfter.x.eq(reserveBalancesBefore.x.add(expectedXIncrease)))
  //     assert.ok(reserveBalancesAfter.y.eq(reserveBalancesBefore.y.add(expectedYIncrease)))
  //     assert.ok(userTokenXBalance.eq(xOwnerAmount.sub(expectedXIncrease)))
  //     assert.ok(userTokenYBalance.eq(yOwnerAmount.sub(expectedYIncrease)))

  //     // before - after
  //     // x/y user balance
  //     // x/y reserve balance

  //     // await pool.withdraw(
  //     //   {
  //     //     owner: positionOwner,
  //     //     userTokenX: userTokenXAccount,
  //     //     userTokenY: userTokenYAccount,
  //     //     lowerTick,
  //     //     upperTick,
  //     //     liquidityDelta
  //     //   },
  //     //   positionOwner
  //     // )

  //     // const poolDataAfter = await pool.get()
  //     // assert.ok(poolDataAfter.liquidity.v.eqn(0))

  //     console.log(userTokenXBalance.toString(), userTokenYBalance.toString())
  //     xOwnerAmount = userTokenXBalance
  //     yOwnerAmount = userTokenYBalance
  // })
  // })
})
