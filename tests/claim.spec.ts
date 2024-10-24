import * as anchor from '@coral-xyz/anchor'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import { Keypair, Transaction } from '@solana/web3.js'
import {
  Network,
  Market,
  Pair,
  LIQUIDITY_DENOMINATOR,
  INVARIANT_ERRORS,
  PRICE_DENOMINATOR,
  signAndSend,
  sleep
} from '@invariant-labs/sdk'
import { assertThrowsAsync, createToken, initMarket } from './testUtils'
import { assert } from 'chai'
import { fromFee, getBalance } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { ClaimFee, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { createAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token'

describe('claim', () => {
  const provider = AnchorProvider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)), // 0.6%
    tickSpacing: 10
  }
  let market: Market
  let pair: Pair

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
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

    pair = new Pair(tokens[0], tokens[1], feeTier)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#claim', async () => {
    const upperTick = 10
    const lowerTick = -20

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

    const swapper = Keypair.generate()
    await connection.requestAirdrop(swapper.publicKey, 1e9)
    await sleep(1000)
    const amount = new BN(1000)
    const accountX = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      swapper.publicKey
    )
    const accountY = await createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      swapper.publicKey
    )

    await mintTo(connection, mintAuthority, pair.tokenX, accountX, mintAuthority, amount)

    const poolDataBefore = await market.getPool(pair)
    const reservesBeforeSwap = await market.getReserveBalances(pair)

    const swapVars: Swap = {
      pair,
      owner: swapper.publicKey,
      xToY: true,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true
    }
    await market.swap(swapVars, swapper)

    await sleep(1000)

    const poolDataAfter = await market.getPool(pair)
    assert.ok(poolDataAfter.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.ok(poolDataAfter.currentTickIndex === lowerTick)
    assert.ok(poolDataAfter.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    const amountX = await getBalance(connection, accountX)
    const amountY = await getBalance(connection, accountY)
    const reservesAfterSwap = await market.getReserveBalances(pair)
    const reserveXDelta = reservesAfterSwap.x.sub(reservesBeforeSwap.x)
    const reserveYDelta = reservesBeforeSwap.y.sub(reservesAfterSwap.y)

    // fee tokens           0.006 * 1000 = 6
    // protocol fee tokens  ceil(6 * 0.01) = cei(0.06) = 1
    // pool fee tokens      6 - 1 = 5
    // fee growth global    5/1000000 = 5 * 10^-6
    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(amount.subn(7)))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(amount.subn(7)))
    assert.ok(poolDataAfter.feeGrowthGlobalX.v.eq(new BN('5000000000000000000')))
    assert.ok(poolDataAfter.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolDataAfter.feeProtocolTokenX.eqn(1))
    assert.ok(poolDataAfter.feeProtocolTokenY.eqn(0))

    // claim with incorrect ticks should failed
    const incorrectLowerTickIndex = initPositionVars.lowerTick - 50
    const incorrectUpperTickIndex = initPositionVars.upperTick + 50

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

    const { tickAddress: incorrectLowerTickAddress } = await market.getTickAddress(
      pair,
      incorrectLowerTickIndex
    )
    const { tickAddress: incorrectUpperTickAddress } = await market.getTickAddress(
      pair,
      incorrectUpperTickIndex
    )
    const { positionAddress } = await market.getPositionAddress(positionOwner.publicKey, 0)

    const incorrectClaimFeeIx = await market.program.methods
      .claimFee(0, incorrectLowerTickIndex, incorrectUpperTickIndex)
      .accountsPartial({
        state: market.stateAddress,
        pool: pair.getAddress(market.program.programId),
        position: positionAddress,
        lowerTick: incorrectLowerTickAddress,
        upperTick: incorrectUpperTickAddress,
        owner: positionOwner.publicKey,
        tokenX: pair.tokenX,
        tokenY: pair.tokenY,
        accountX: userTokenXAccount,
        accountY: userTokenYAccount,
        reserveX: poolDataAfter.tokenXReserve,
        reserveY: poolDataAfter.tokenYReserve,
        programAuthority: market.programAuthority,
        tokenXProgram: TOKEN_PROGRAM_ID,
        tokenYProgram: TOKEN_PROGRAM_ID
      })
      .instruction()
    const incorrectClaimFeeTx = new Transaction().add(incorrectClaimFeeIx)
    await assertThrowsAsync(
      signAndSend(incorrectClaimFeeTx, [positionOwner], market.connection),
      INVARIANT_ERRORS.WRONG_TICK
    )

    const reservesBeforeClaim = await market.getReserveBalances(pair)
    const userTokenXAccountBeforeClaim = await getBalance(connection, userTokenXAccount)
    const claimFeeVars: ClaimFee = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      index: 0
    }
    await market.claimFee(claimFeeVars, positionOwner)
    await sleep(1000)

    const userTokenXAccountAfterClaim = await getBalance(connection, userTokenXAccount)
    const positionAfterClaim = await market.getPosition(positionOwner.publicKey, 0)
    const reservesAfterClaim = await market.getReserveBalances(pair)
    const expectedTokensClaimed = 5

    assert.ok(reservesBeforeClaim.x.subn(expectedTokensClaimed).eq(reservesAfterClaim.x))
    assert.ok(positionAfterClaim.tokensOwedX.v.eqn(0))
    assert.ok(positionAfterClaim.feeGrowthInsideX.v.eq(poolDataAfter.feeGrowthGlobalX.v))
    assert.ok(
      userTokenXAccountAfterClaim.sub(userTokenXAccountBeforeClaim).eqn(expectedTokensClaimed)
    )
  })
})
