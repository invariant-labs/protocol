import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { assertThrowsAsync, createToken, initMarket } from './testUtils'
import {
  Market,
  Pair,
  LIQUIDITY_DENOMINATOR,
  Network,
  signAndSend,
  INVARIANT_ERRORS,
  sleep
} from '@invariant-labs/sdk'
import { fromFee, getBalance, toDecimal } from '@invariant-labs/sdk/lib/utils'
import { Decimal, FeeTier, RemovePosition } from '@invariant-labs/sdk/lib/market'
import { CreateTick, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { createAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token'

describe('withdraw', () => {
  const provider = AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const upperTick = 10
  const lowerTick = -20
  let userTokenXAccount: PublicKey
  let userTokenYAccount: PublicKey
  let liquidityDelta: Decimal
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  let positionOwner: Keypair
  let market: Market
  let pair: Pair

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

    pair = new Pair(tokens[0], tokens[1], feeTier)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })
  it('#create position', async () => {
    // Deposit
    const createTickVars: CreateTick = {
      pair,
      index: upperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)

    const createTickVars2: CreateTick = {
      pair,
      index: lowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)
    positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    await sleep(400)
    userTokenXAccount = await createAssociatedTokenAccount(
      connection,
      positionOwner,
      pair.tokenX,
      positionOwner.publicKey
    )
    userTokenYAccount = await createAssociatedTokenAccount(
      connection,
      positionOwner,
      pair.tokenY,
      positionOwner.publicKey
    )

    const mintAmount = new BN(10).pow(new BN(10))
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenX,
      userTokenXAccount,
      mintAuthority,
      mintAmount
    )
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenY,
      userTokenYAccount,
      mintAuthority,
      mintAmount
    )

    liquidityDelta = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      slippage: { v: new BN(0) },
      liquidityDelta
    }
    await market.initPosition(initPositionVars, positionOwner)

    assert.ok((await market.getPool(pair)).liquidity.v.eq(liquidityDelta.v))
  })
  it('#withdraw with incorrect ticks should failed', async () => {
    const removedPositionIndex = 0
    const position = await market.getPosition(positionOwner.publicKey, removedPositionIndex)
    const pool = await market.getPool(pair)
    const { positionListAddress } = market.getPositionListAddress(positionOwner.publicKey)
    const { positionAddress: removedPositionAddress } = await market.getPositionAddress(
      positionOwner.publicKey,
      removedPositionIndex
    )
    const { positionAddress: lastPositionAddress } = await market.getPositionAddress(
      positionOwner.publicKey,
      removedPositionIndex + 1
    )

    const incorrectLowerTickIndex = position.lowerTickIndex - 50
    const incorrectUpperTickIndex = position.upperTickIndex + 50

    // create incorrect tick indexes
    await market.createTick(
      {
        index: incorrectLowerTickIndex,
        pair,
        payer: positionOwner.publicKey
      },
      positionOwner
    )
    await market.createTick(
      {
        index: incorrectUpperTickIndex,
        pair,
        payer: positionOwner.publicKey
      },
      positionOwner
    )

    // add liquidity between incorrect tick to increase funds that hypothetically may be stolen
    const initPositionVars: InitPosition = {
      knownPrice: pool.sqrtPrice,
      lowerTick: incorrectLowerTickIndex,
      upperTick: incorrectUpperTickIndex,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      owner: positionOwner.publicKey,
      liquidityDelta: { v: liquidityDelta.v.muln(1_000_000) },
      pair: pair,
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    const { tickAddress: incorrectLowerTickAddress } = await market.getTickAddress(
      pair,
      incorrectLowerTickIndex
    )
    const { tickAddress: incorrectUpperTickAddress } = await market.getTickAddress(
      pair,
      incorrectUpperTickIndex
    )

    // remove position ix with incorrect ticks
    const removePositionIx = await market.program.methods
      .removePosition(removedPositionIndex, incorrectLowerTickIndex, incorrectUpperTickIndex)
      .accountsPartial({
        state: market.getStateAddress().address,
        payer: positionOwner.publicKey,
        owner: positionOwner.publicKey,
        removedPosition: removedPositionAddress,
        positionList: positionListAddress,
        lastPosition: lastPositionAddress,
        pool: pair.getAddress(market.program.programId),
        tickmap: pool.tickmap,
        lowerTick: incorrectLowerTickAddress,
        upperTick: incorrectUpperTickAddress,
        tokenX: pair.tokenX,
        tokenY: pair.tokenY,
        accountX: userTokenXAccount,
        accountY: userTokenYAccount,
        reserveX: pool.tokenXReserve,
        reserveY: pool.tokenYReserve,
        programAuthority: market.programAuthority,
        tokenXProgram: TOKEN_PROGRAM_ID,
        tokenYProgram: TOKEN_PROGRAM_ID
      })
      .instruction()

    const removePositionTx = new Transaction().add(removePositionIx)
    await assertThrowsAsync(
      signAndSend(removePositionTx, [positionOwner], market.connection),
      INVARIANT_ERRORS.WRONG_TICK
    )
  })
  it('#withdraw', async () => {
    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      owner.publicKey
    )
    const accountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      owner.publicKey
    )

    await mintTo(connection, mintAuthority, pair.tokenX, accountX, mintAuthority, amount)

    // Swap
    const poolDataBefore = await market.getPool(pair)
    const reservesBefore = await market.getReserveBalances(pair)

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
    await sleep(1000)

    // Check pool
    const poolData = await market.getPool(pair)
    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.equal(poolData.currentTickIndex, -10)
    assert.ok(poolData.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const amountX = await getBalance(connection, accountX)
    const amountY = await getBalance(connection, accountY)
    const reservesAfter = await market.getReserveBalances(pair)
    const reserveXDelta = reservesAfter.x.sub(reservesBefore.x)
    const reserveYDelta = reservesBefore.y.sub(reservesAfter.y)

    // fee tokens           0.006 * 1000 = 6
    // protocol fee tokens  ceil(6 * 0.01) = cei(0.06) = 1
    // pool fee tokens      6 - 1 = 5
    // fee growth global    5/1000001000000000000 ~ 4.9999950000049 * 10^-18
    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(amount.subn(7)))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(amount.subn(7)))

    assert.ok(poolData.feeGrowthGlobalX.v.eq(new BN('4999995000004')))
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenX.eqn(1))
    assert.ok(poolData.feeProtocolTokenY.eqn(0))

    // Remove position
    const reservesBeforeRemove = await market.getReserveBalances(pair)

    const removePositionVars: RemovePosition = {
      pair,
      owner: positionOwner.publicKey,
      index: 0,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount
    }
    await market.removePosition(removePositionVars, positionOwner)
    await sleep(1000)

    // Check position after remove
    const positionList = await market.getPositionList(positionOwner.publicKey)
    assert.equal(positionList.head, 1)

    // Check amounts tokens
    const reservesAfterRemove = await market.getReserveBalances(pair)
    const expectedWithdrawnX = new BN(499)
    const expectedWithdrawnY = new BN(999)
    const expectedFeeX = new BN(0)

    assert.ok(
      reservesBeforeRemove.x.sub(reservesAfterRemove.x).eq(expectedWithdrawnX.add(expectedFeeX))
    )
    assert.ok(reservesBeforeRemove.y.sub(reservesAfterRemove.y).eq(expectedWithdrawnY))

    // validate ticks
    await assertThrowsAsync(market.getTick(pair, upperTick))
    await assertThrowsAsync(market.getTick(pair, lowerTick))

    assert.isFalse(await market.isInitialized(pair, lowerTick))
    assert.isFalse(await market.isInitialized(pair, upperTick))
  })
})
