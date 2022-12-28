import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Keypair, Transaction } from '@solana/web3.js'
import { Network, Market, Pair, LIQUIDITY_DENOMINATOR, INVARIANT_ERRORS } from '@invariant-labs/sdk'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { assertThrowsAsync, createToken, initMarket } from './testUtils'
import { assert } from 'chai'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { toDecimal, tou64 } from '@invariant-labs/sdk/src/utils'
import { ClaimFee, InitPosition, Swap } from '@invariant-labs/sdk/src/market'
import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { signAndSend } from '@invariant-labs/sdk'

describe('claim', () => {
  const provider = Provider.local()
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
  let tokenX: Token
  let tokenY: Token

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

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
  })

  it('#claim', async () => {
    const upperTick = 10
    const lowerTick = -20

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
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true
    }
    await market.swap(swapVars, swapper)

    const poolDataAfter = await market.getPool(pair)
    assert.ok(poolDataAfter.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.ok(poolDataAfter.currentTickIndex === lowerTick)
    assert.ok(poolDataAfter.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reservesAfterSwap = await market.getReserveBalances(pair, tokenX, tokenY)
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

    const incorrectClaimFeeIx = await market.program.instruction.claimFee(
      0,
      incorrectLowerTickIndex,
      incorrectUpperTickIndex,
      {
        accounts: {
          state: market.stateAddress,
          pool: await pair.getAddress(market.program.programId),
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
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    )
    const incorrectClaimFeeTx = new Transaction().add(incorrectClaimFeeIx)
    await assertThrowsAsync(
      signAndSend(incorrectClaimFeeTx, [positionOwner], market.connection),
      INVARIANT_ERRORS.WRONG_TICK
    )

    const reservesBeforeClaim = await market.getReserveBalances(pair, tokenX, tokenY)
    const userTokenXAccountBeforeClaim = (await tokenX.getAccountInfo(userTokenXAccount)).amount
    const claimFeeVars: ClaimFee = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      index: 0
    }
    await market.claimFee(claimFeeVars, positionOwner)

    const userTokenXAccountAfterClaim = (await tokenX.getAccountInfo(userTokenXAccount)).amount
    const positionAfterClaim = await market.getPosition(positionOwner.publicKey, 0)
    const reservesAfterClaim = await market.getReserveBalances(pair, tokenX, tokenY)
    const expectedTokensClaimed = 5

    assert.ok(reservesBeforeClaim.x.subn(expectedTokensClaimed).eq(reservesAfterClaim.x))
    assert.ok(positionAfterClaim.tokensOwedX.v.eqn(0))
    assert.ok(positionAfterClaim.feeGrowthInsideX.v.eq(poolDataAfter.feeGrowthGlobalX.v))
    assert.ok(
      userTokenXAccountAfterClaim.sub(userTokenXAccountBeforeClaim).eqn(expectedTokensClaimed)
    )
  })
})
