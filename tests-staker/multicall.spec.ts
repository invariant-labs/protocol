import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair, sleep, PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { Network } from '../staker-sdk/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { createToken, getTime, signAndSend, almostEqual } from './testUtils'
import { createToken as createTkn, initMarket } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromInteger, toDecimal } from '../staker-sdk/lib/utils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { InitPosition, Swap, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { CreateIncentive, CreateStake, Withdraw, Decimal, Staker } from '../staker-sdk/src/staker'
import { assert } from 'chai'
import { tou64 } from '@invariant-labs/sdk/src/utils'

describe('Multicall test', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const firstIncentiveAccount = Keypair.generate()
  const firstPositionOwner = Keypair.generate()
  const secondIncentiveAccount = Keypair.generate()
  const secondPositionOwner = Keypair.generate()
  const firstFounderAccount = Keypair.generate()
  const secondFounderAccount = Keypair.generate()
  const admin = Keypair.generate()
  const firstUpperTick = 20
  const firstLowerTick = -40
  const secondUpperTick = 10
  const secondLowerTick = -30
  const epsilon = new BN(20)
  let staker: Staker
  let market: Market
  let pair: Pair
  let firstFounderTokenAccount: PublicKey
  let secondFounderTokenAccount: PublicKey
  let firstIncentiveTokenAccount: Keypair
  let secondIncentiveTokenAccount: Keypair
  let firstOwnerTokenAccount: PublicKey
  let secondOwnerTokenAccount: PublicKey
  let pool: PublicKey
  let invariant: PublicKey
  let nonce: number
  let tokenX: Token
  let tokenY: Token
  let incentiveToken: Token
  let amount: BN

  before(async () => {
    // create staker

    staker = await Staker.build(Network.LOCAL, provider.wallet, connection)

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(firstPositionOwner.publicKey, 1e9),
      connection.requestAirdrop(secondPositionOwner.publicKey, 1e9),
      connection.requestAirdrop(firstIncentiveAccount.publicKey, 1e9),
      connection.requestAirdrop(secondIncentiveAccount.publicKey, 1e9),
      connection.requestAirdrop(firstFounderAccount.publicKey, 1e9),
      connection.requestAirdrop(secondFounderAccount.publicKey, 1e9)
    ])

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)

    // create taken acc for founder and staker
    firstFounderTokenAccount = await incentiveToken.createAccount(firstFounderAccount.publicKey)
    secondFounderTokenAccount = await incentiveToken.createAccount(secondFounderAccount.publicKey)
    firstIncentiveTokenAccount = Keypair.generate()
    secondIncentiveTokenAccount = Keypair.generate()
    firstOwnerTokenAccount = await incentiveToken.createAccount(firstPositionOwner.publicKey)
    secondOwnerTokenAccount = await incentiveToken.createAccount(secondPositionOwner.publicKey)

    // mint to founder acc
    amount = new anchor.BN(1000 * 1e12)
    await incentiveToken.mintTo(firstFounderTokenAccount, wallet, [], tou64(amount))
    await incentiveToken.mintTo(secondFounderTokenAccount, wallet, [], tou64(amount))

    // create invariant and pool

    market = await Market.build(
      0,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
    invariant = anchor.workspace.Invariant.programId
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
  })

  it('Multicall', async () => {
    const currentTime = getTime()
    const startTime = { v: currentTime.add(new BN(0)) }
    const firstReward: Decimal = { v: new BN(100000) }
    const endTimeFirst = { v: currentTime.add(new BN(1000)) }
    const secondReward: Decimal = { v: new BN(200000) }
    const endTimeSecond = { v: currentTime.add(new BN(2000)) }

    const createIncentiveVars: CreateIncentive = {
      reward: firstReward,
      startTime,
      endTime: endTimeFirst,
      pool,
      founder: firstFounderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: firstFounderTokenAccount,
      invariant
    }
    const firstIncentiveTx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        firstIncentiveAccount.publicKey,
        firstIncentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      firstIncentiveTx,
      [
        firstFounderAccount,
        firstIncentiveAccount,
        firstIncentiveTokenAccount,
        firstIncentiveTokenAccount
      ],
      staker.connection
    )

    const createIncentiveVars2: CreateIncentive = {
      reward: secondReward,
      startTime,
      endTime: endTimeSecond,
      pool,
      founder: secondFounderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: secondFounderTokenAccount,
      invariant
    }
    const secondIncentiveTx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars2,
        secondIncentiveAccount.publicKey,
        secondIncentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      secondIncentiveTx,
      [
        secondFounderAccount,
        secondIncentiveAccount,
        secondIncentiveTokenAccount,
        secondIncentiveTokenAccount
      ],
      staker.connection
    )
    // create first position

    const firstUserTokenXAccount = await tokenX.createAccount(firstPositionOwner.publicKey)
    const firstUserTokenYAccount = await tokenY.createAccount(firstPositionOwner.publicKey)
    let mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(
      firstUserTokenXAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      mintAmount
    )
    await tokenY.mintTo(
      firstUserTokenYAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      mintAmount
    )
    await market.createPositionList(firstPositionOwner.publicKey, firstPositionOwner)
    const initPositionVars: InitPosition = {
      pair,
      owner: firstPositionOwner.publicKey,
      userTokenX: firstUserTokenXAccount,
      userTokenY: firstUserTokenYAccount,
      lowerTick: firstLowerTick,
      upperTick: firstUpperTick,
      liquidityDelta: fromInteger(1_000_000),
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, firstPositionOwner)
    // create second position

    const secondUserTokenXAccount = await tokenX.createAccount(secondPositionOwner.publicKey)
    const secondUserTokenYAccount = await tokenY.createAccount(secondPositionOwner.publicKey)
    mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(
      secondUserTokenXAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      mintAmount
    )
    await tokenY.mintTo(
      secondUserTokenYAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      mintAmount
    )
    await market.createPositionList(secondPositionOwner.publicKey, secondPositionOwner)
    const initPositionVars2: InitPosition = {
      pair,
      owner: secondPositionOwner.publicKey,
      userTokenX: secondUserTokenXAccount,
      userTokenY: secondUserTokenYAccount,
      lowerTick: secondLowerTick,
      upperTick: secondUpperTick,
      liquidityDelta: fromInteger(3_000_000),
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars2, secondPositionOwner)
    const index = 0
    const { positionAddress: firstPosition } = await market.getPositionAddress(
      firstPositionOwner.publicKey,
      index
    )
    const { positionAddress: secondPosition } = await market.getPositionAddress(
      secondPositionOwner.publicKey,
      index
    )

    // create update instructions for positions
    const firstUpdate: UpdateSecondsPerLiquidity = {
      pair,
      owner: firstPositionOwner.publicKey,
      lowerTickIndex: firstLowerTick,
      upperTickIndex: firstUpperTick,
      index
    }
    const firstUpdateIx = await market.updateSecondsPerLiquidityInstruction(firstUpdate)
    const secondUpdate: UpdateSecondsPerLiquidity = {
      pair,
      owner: secondPositionOwner.publicKey,
      lowerTickIndex: secondLowerTick,
      upperTickIndex: secondUpperTick,
      index
    }
    const secondUpdateIx = await market.updateSecondsPerLiquidityInstruction(secondUpdate)

    const firstPositionStructBefore = await market.getPosition(firstPositionOwner.publicKey, index)
    const firstPositionId = firstPositionStructBefore.id
    const secondPositionStructBefore = await market.getPosition(
      secondPositionOwner.publicKey,
      index
    )
    const secondPositionId = secondPositionStructBefore.id

    // stake first position on first incentive, first case
    const firstCreateStake: CreateStake = {
      pool,
      id: firstPositionId,
      index,
      position: firstPosition,
      incentive: firstIncentiveAccount.publicKey,
      owner: firstPositionOwner.publicKey,
      signer: firstPositionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const firstStakeIx = await staker.createStakeIx(firstCreateStake)
    const firstTx = new Transaction().add(firstUpdateIx).add(firstStakeIx)
    await signAndSend(firstTx, [firstPositionOwner], staker.connection)

    // stake second position on first incentive, second case
    const secondCreateStake: CreateStake = {
      pool,
      id: secondPositionId,
      index,
      position: secondPosition,
      incentive: firstIncentiveAccount.publicKey,
      owner: secondPositionOwner.publicKey,
      signer: secondPositionOwner.publicKey,
      invariant
    }

    const secondStakeIx = await staker.createStakeIx(secondCreateStake)
    const secondTx = new Transaction().add(secondUpdateIx).add(secondStakeIx)
    await signAndSend(secondTx, [secondPositionOwner], staker.connection)

    // stake first position on second incentive, third case
    const thirdCreateStake: CreateStake = {
      pool,
      id: firstPositionId,
      index,
      position: firstPosition,
      incentive: secondIncentiveAccount.publicKey,
      owner: firstPositionOwner.publicKey,
      signer: firstPositionOwner.publicKey,
      invariant
    }

    const thirdStakeIx = await staker.createStakeIx(thirdCreateStake)
    const thirdTx = new Transaction().add(firstUpdateIx).add(thirdStakeIx)
    await signAndSend(thirdTx, [firstPositionOwner], staker.connection)

    // stake second position on second incentive, fourth case
    const fourthCreateStake: CreateStake = {
      pool,
      id: secondPositionId,
      index,
      position: secondPosition,
      incentive: secondIncentiveAccount.publicKey,
      owner: secondPositionOwner.publicKey,
      signer: secondPositionOwner.publicKey,
      invariant
    }

    const fourthStakeIx = await staker.createStakeIx(fourthCreateStake)
    const fourthTx = new Transaction().add(secondUpdateIx).add(fourthStakeIx)
    await signAndSend(fourthTx, [secondPositionOwner], staker.connection)

    // swap
    const trader = Keypair.generate()
    await connection.requestAirdrop(trader.publicKey, 1e9)
    const amount = new BN(1000)
    const accountX = await tokenX.createAccount(trader.publicKey)
    const accountY = await tokenY.createAccount(trader.publicKey)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))
    // Swap
    const poolDataBefore = await market.getPool(pair)
    const swapVars: Swap = {
      pair,
      xToY: true,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    }
    await market.swap(swapVars, trader)

    await sleep(20000)
    // withdraw first case
    const firstWithdraw: Withdraw = {
      incentive: firstIncentiveAccount.publicKey,
      pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAccount: firstIncentiveTokenAccount.publicKey,
      ownerTokenAcc: firstOwnerTokenAccount,
      index
    }

    const firstWithdrawIx = await staker.withdrawIx(firstWithdraw)
    const firstWithdrawTx = new Transaction().add(firstUpdateIx).add(firstWithdrawIx)
    await signAndSend(firstWithdrawTx, [firstPositionOwner], staker.connection)

    const balanceAfterFirst = (await incentiveToken.getAccountInfo(firstOwnerTokenAccount)).amount
    assert.ok(almostEqual(balanceAfterFirst, new BN('500'), epsilon))

    // withdraw second case
    const secondWithdraw: Withdraw = {
      incentive: firstIncentiveAccount.publicKey,
      pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAccount: firstIncentiveTokenAccount.publicKey,
      ownerTokenAcc: secondOwnerTokenAccount,
      index
    }

    const secondWithdrawIx = await staker.withdrawIx(secondWithdraw)
    const secondWithdrawTx = new Transaction().add(secondUpdateIx).add(secondWithdrawIx)
    await signAndSend(secondWithdrawTx, [secondPositionOwner], staker.connection)

    const balanceAfterSecond = (await incentiveToken.getAccountInfo(secondOwnerTokenAccount)).amount
    assert.ok(almostEqual(balanceAfterSecond, new BN('1500'), epsilon))
    // withdraw third case
    const thirdWithdraw: Withdraw = {
      incentive: secondIncentiveAccount.publicKey,
      pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAccount: secondIncentiveTokenAccount.publicKey,
      ownerTokenAcc: firstOwnerTokenAccount,
      index
    }

    const thirdWithdrawIx = await staker.withdrawIx(thirdWithdraw)
    const thirdWithdrawTx = new Transaction().add(firstUpdateIx).add(thirdWithdrawIx)
    await signAndSend(thirdWithdrawTx, [firstPositionOwner], staker.connection)

    const balanceAfterThird = (await incentiveToken.getAccountInfo(firstOwnerTokenAccount)).amount
    assert.ok(almostEqual(balanceAfterThird, new BN('1000'), epsilon))
    // withdraw fourth case
    const fourthWithdraw: Withdraw = {
      incentive: secondIncentiveAccount.publicKey,
      pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAccount: secondIncentiveTokenAccount.publicKey,
      ownerTokenAcc: secondOwnerTokenAccount,
      index
    }

    const fourthWithdrawIx = await staker.withdrawIx(fourthWithdraw)
    const fourthWithdrawTx = new Transaction().add(secondUpdateIx).add(fourthWithdrawIx)
    await signAndSend(fourthWithdrawTx, [secondPositionOwner], staker.connection)

    const balanceAfterFourth = (await incentiveToken.getAccountInfo(secondOwnerTokenAccount)).amount
    assert.ok(almostEqual(balanceAfterFourth, new BN('3000'), epsilon))
  })
})
