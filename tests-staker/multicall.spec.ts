import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair, DENOMINATOR, sleep } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal, LiquidityMining } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { createToken, tou64, getTime, almostEqual, signAndSend } from './testUtils'
import { createToken as createTkn } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromInteger, toDecimal } from '../sdk-staker/lib/utils'
import { DECIMAL, fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  InitPosition,
  Swap,
  UpdateSecondsPerLiquidity
} from '@invariant-labs/sdk/src/market'
import { CreateIncentive, CreateStake, Withdraw } from '../sdk-staker/src/staker'

describe('Multicall test', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
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

  let staker: LiquidityMining
  let market: Market
  let pair: Pair
  let stakerAuthority: PublicKey
  let firstFounderTokenAcc: PublicKey
  let secondFounderTokenAcc: PublicKey
  let firstIncentiveTokenAcc: PublicKey
  let secondIncentiveTokenAcc: PublicKey
  let firstOwnerTokenAcc: PublicKey
  let secondOwnerTokenAcc: PublicKey
  let pool: PublicKey
  let invariant: PublicKey
  let nonce: number
  let tokenX: Token
  let tokenY: Token
  let firstIncentiveToken: Token
  let amount: BN
  const firstUpperTick = 20
  const firstLowerTick = -40
  const secondUpperTick = 10
  const secondLowerTick = -30
  const epsilon = new BN(10).pow(new BN(DECIMAL)).mul(new BN(2))

  before(async () => {
    // create staker
    const [_mintAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [STAKER_SEED],
      anchor.workspace.Staker.programId
    )
    stakerAuthority = _mintAuthority
    nonce = _nonce
    staker = new LiquidityMining(
      connection,
      Network.LOCAL,
      provider.wallet,
      anchor.workspace.Staker.programId
    )

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(firstPositionOwner.publicKey, 1e9),
      await connection.requestAirdrop(secondPositionOwner.publicKey, 1e9),
      await connection.requestAirdrop(firstIncentiveAccount.publicKey, 1e9),
      await connection.requestAirdrop(secondIncentiveAccount.publicKey, 1e9),
      await connection.requestAirdrop(firstFounderAccount.publicKey, 1e9),
      await connection.requestAirdrop(secondFounderAccount.publicKey, 1e9)
    ])

    // create token
    firstIncentiveToken = await createToken(connection, wallet, wallet)

    // create taken acc for founder and staker
    firstFounderTokenAcc = await firstIncentiveToken.createAccount(firstFounderAccount.publicKey)
    secondFounderTokenAcc = await firstIncentiveToken.createAccount(secondFounderAccount.publicKey)
    firstIncentiveTokenAcc = await firstIncentiveToken.createAccount(stakerAuthority)
    secondIncentiveTokenAcc = await firstIncentiveToken.createAccount(stakerAuthority)
    firstOwnerTokenAcc = await firstIncentiveToken.createAccount(firstPositionOwner.publicKey)
    secondOwnerTokenAcc = await firstIncentiveToken.createAccount(secondPositionOwner.publicKey)

    // mint to founder acc
    amount = new anchor.BN(1000 * 1e12)
    await firstIncentiveToken.mintTo(firstFounderTokenAcc, wallet, [], tou64(amount))
    await firstIncentiveToken.mintTo(secondFounderTokenAcc, wallet, [], tou64(amount))

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
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)

    await market.createState(admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)

    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    const createPoolVars: CreatePool = {
      pair,
      payer: admin
    }
    await market.createPool(createPoolVars)

    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
    invariant = anchor.workspace.Invariant.programId
  })
  it('Multicall', async () => {
    const currentTime = getTime()
    const startTime = currentTime.add(new BN(0))
    const firstReward: Decimal = { v: new BN(200).mul(DENOMINATOR) }
    const endTimeFirst = currentTime.add(new BN(100))
    const secondReward: Decimal = { v: new BN(100).mul(DENOMINATOR) }
    const endTimeSecond = currentTime.add(new BN(100000))
    const createIncentiveVars: CreateIncentive = {
      reward: firstReward,
      startTime,
      endTime: endTimeFirst,
      pool,
      founder: firstFounderAccount.publicKey,
      incentiveTokenAcc: firstIncentiveTokenAcc,
      founderTokenAcc: firstFounderTokenAcc,
      invariant
    }
    const firstIncentiveTx = new Transaction().add(
      await staker.createIncentiveIx(createIncentiveVars, firstIncentiveAccount.publicKey)
    )

    await signAndSend(
      firstIncentiveTx,
      [firstFounderAccount, firstIncentiveAccount],
      staker.connection
    )

    const createIncentiveVars2: CreateIncentive = {
      reward: secondReward,
      startTime,
      endTime: endTimeSecond,
      pool,
      founder: secondFounderAccount.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      founderTokenAcc: secondFounderTokenAcc,
      invariant
    }
    const secondIncentiveTx = new Transaction().add(
      await staker.createIncentiveIx(createIncentiveVars2, secondIncentiveAccount.publicKey)
    )

    await signAndSend(
      secondIncentiveTx,
      [secondFounderAccount, secondIncentiveAccount],
      staker.connection
    )
    // create first position
    const createTickVars: CreateTick = {
      pair,
      index: firstUpperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)
    const createTickVars2: CreateTick = {
      pair,
      index: firstLowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)
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
      liquidityDelta: fromInteger(1_000_000)
    }
    await market.initPosition(initPositionVars, firstPositionOwner)
    // create second position
    const createTickVars3: CreateTick = {
      pair,
      index: secondUpperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars3, admin)
    const createTickVars4: CreateTick = {
      pair,
      index: secondLowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars4, admin)
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
      liquidityDelta: fromInteger(2_000_000)
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
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    }
    await market.swap(swapVars, trader)
    await sleep(10000)
    // withdraw first case
    const firstWithdraw: Withdraw = {
      incentive: firstIncentiveAccount.publicKey,
      pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAcc: firstIncentiveTokenAcc,
      ownerTokenAcc: firstOwnerTokenAcc,
      invariant,
      index,
      nonce
    }

    const firstWithdrawIx = await staker.withdrawIx(firstWithdraw)
    const firstWithdrawTx = new Transaction().add(firstUpdateIx).add(firstWithdrawIx)
    await signAndSend(firstWithdrawTx, [firstPositionOwner], staker.connection)

    const balanceAfterFirst = (await firstIncentiveToken.getAccountInfo(firstOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterFirst, new BN('9333332000000'), epsilon))

    // withdraw second case
    const secondWithdraw: Withdraw = {
      incentive: firstIncentiveAccount.publicKey,
      pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAcc: firstIncentiveTokenAcc,
      ownerTokenAcc: secondOwnerTokenAcc,
      invariant,
      index,
      nonce
    }

    const secondWithdrawIx = await staker.withdrawIx(secondWithdraw)
    const secondWithdrawTx = new Transaction().add(secondUpdateIx).add(secondWithdrawIx)
    await signAndSend(secondWithdrawTx, [secondPositionOwner], staker.connection)

    const balanceAfterSecond = (await firstIncentiveToken.getAccountInfo(secondOwnerTokenAcc))
      .amount
    assert.ok(almostEqual(balanceAfterSecond, new BN('17333332000000'), epsilon))
    // withdraw third case
    const thirdWithdraw: Withdraw = {
      incentive: secondIncentiveAccount.publicKey,
      pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      ownerTokenAcc: firstOwnerTokenAcc,
      invariant,
      index,
      nonce
    }

    const thirdWithdrawIx = await staker.withdrawIx(thirdWithdraw)
    const thirdWithdrawTx = new Transaction().add(firstUpdateIx).add(thirdWithdrawIx)
    await signAndSend(thirdWithdrawTx, [firstPositionOwner], staker.connection)

    const balanceAfterThird = (await firstIncentiveToken.getAccountInfo(firstOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterThird, new BN('9337665333000'), epsilon))
    // withdraw fourth case
    const fourthWithdraw: Withdraw = {
      incentive: secondIncentiveAccount.publicKey,
      pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      ownerTokenAcc: secondOwnerTokenAcc,
      invariant,
      index,
      nonce
    }

    const fourthWithdrawIx = await staker.withdrawIx(fourthWithdraw)
    const fourthWithdrawTx = new Transaction().add(secondUpdateIx).add(fourthWithdrawIx)
    await signAndSend(fourthWithdrawTx, [secondPositionOwner], staker.connection)

    const balanceAfterFourth = (await firstIncentiveToken.getAccountInfo(secondOwnerTokenAcc))
      .amount
    assert.ok(almostEqual(balanceAfterFourth, new BN('17341998665999'), epsilon))
  })
})
