import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import {
  createToken,
  tou64,
  getTime,
  almostEqual,
  updatePositionAndCreateStake,
  createIncentive,
  updatePositionAndWithdraw
} from './utils'
import {
  createFeeTier,
  createPool,
  createPositionList,
  createState,
  createTick,
  createToken as createTkn,
  initPosition,
  swap,
  updateSecondsPerLiquidity
} from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromInteger, toDecimal } from '../sdk-staker/lib/utils'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { DECIMAL, fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { sleep } from '@invariant-labs/sdk'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  InitPosition,
  Swap,
  UpdateSecondsPerLiquidity
} from '@invariant-labs/sdk/src/market'
import { CreateIncentive, CreateStake, Withdraw } from '../sdk-staker/lib/staker'

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
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

  let staker: Staker
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
  let amm: PublicKey
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
    //create staker
    const [_mintAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [STAKER_SEED],
      program.programId
    )
    stakerAuthority = _mintAuthority
    nonce = _nonce
    staker = new Staker(connection, Network.LOCAL, provider.wallet, program.programId)

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(firstPositionOwner.publicKey, 1e9),
      await connection.requestAirdrop(secondPositionOwner.publicKey, 1e9),
      await connection.requestAirdrop(firstIncentiveAccount.publicKey, 1e9),
      await connection.requestAirdrop(secondIncentiveAccount.publicKey, 1e9),
      await connection.requestAirdrop(firstFounderAccount.publicKey, 1e9),
      await connection.requestAirdrop(secondFounderAccount.publicKey, 1e9)
    ])

    //create token
    firstIncentiveToken = await createToken({
      connection: connection,
      payer: wallet,
      mintAuthority: wallet.publicKey
    })

    //create taken acc for founder and staker
    firstFounderTokenAcc = await firstIncentiveToken.createAccount(firstFounderAccount.publicKey)
    secondFounderTokenAcc = await firstIncentiveToken.createAccount(secondFounderAccount.publicKey)
    firstIncentiveTokenAcc = await firstIncentiveToken.createAccount(stakerAuthority)
    secondIncentiveTokenAcc = await firstIncentiveToken.createAccount(stakerAuthority)
    firstOwnerTokenAcc = await firstIncentiveToken.createAccount(firstPositionOwner.publicKey)
    secondOwnerTokenAcc = await firstIncentiveToken.createAccount(secondPositionOwner.publicKey)

    //mint to founder acc
    amount = new anchor.BN(1000 * 1e12)
    await firstIncentiveToken.mintTo(firstFounderTokenAcc, wallet, [], tou64(amount))
    await firstIncentiveToken.mintTo(secondFounderTokenAcc, wallet, [], tou64(amount))

    //create amm and pool

    market = await Market.build(0, provider.wallet, connection, anchor.workspace.Amm.programId)

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

    await createState(market, admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await createFeeTier(market, createFeeTierVars, admin)

    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    const createPoolVars: CreatePool = {
      pair,
      payer: admin,
      protocolFee,
      tokenX,
      tokenY
    }
    await createPool(market, createPoolVars)

    pool = await pair.getAddress(anchor.workspace.Amm.programId)
    amm = anchor.workspace.Amm.programId

    //create tokens
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
      incentive: firstIncentiveAccount.publicKey,
      pool,
      founder: firstFounderAccount.publicKey,
      incentiveTokenAcc: firstIncentiveTokenAcc,
      founderTokenAcc: firstFounderTokenAcc,
      amm
    }
    await createIncentive(staker, createIncentiveVars, [firstFounderAccount, firstIncentiveAccount])

    const createIncentiveVars2: CreateIncentive = {
      reward: secondReward,
      startTime,
      endTime: endTimeSecond,
      incentive: secondIncentiveAccount.publicKey,
      pool,
      founder: secondFounderAccount.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      founderTokenAcc: secondFounderTokenAcc,
      amm
    }
    await createIncentive(staker, createIncentiveVars2, [
      secondFounderAccount,
      secondIncentiveAccount
    ])

    //create first position
    const createTickVars: CreateTick = {
      pair,
      index: firstUpperTick,
      payer: admin.publicKey
    }
    await createTick(market, createTickVars, admin)

    const createTickVars2: CreateTick = {
      pair,
      index: firstLowerTick,
      payer: admin.publicKey
    }
    await createTick(market, createTickVars2, admin)

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

    await createPositionList(market, firstPositionOwner.publicKey, firstPositionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: firstPositionOwner.publicKey,
      userTokenX: firstUserTokenXAccount,
      userTokenY: firstUserTokenYAccount,
      lowerTick: firstLowerTick,
      upperTick: firstUpperTick,
      liquidityDelta: fromInteger(1_000_000)
    }
    await initPosition(market, initPositionVars, firstPositionOwner)

    //create second position

    const createTickVars3: CreateTick = {
      pair,
      index: secondUpperTick,
      payer: admin.publicKey
    }
    await createTick(market, createTickVars3, admin)

    const createTickVars4: CreateTick = {
      pair,
      index: secondLowerTick,
      payer: admin.publicKey
    }
    await createTick(market, createTickVars4, admin)

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

    await createPositionList(market, secondPositionOwner.publicKey, secondPositionOwner)

    const initPositionVars2: InitPosition = {
      pair,
      owner: secondPositionOwner.publicKey,
      userTokenX: secondUserTokenXAccount,
      userTokenY: secondUserTokenYAccount,
      lowerTick: secondLowerTick,
      upperTick: secondUpperTick,
      liquidityDelta: fromInteger(2_000_000)
    }
    await initPosition(market, initPositionVars2, secondPositionOwner)

    let index = 0

    const { positionAddress: firstPosition } = await market.getPositionAddress(
      firstPositionOwner.publicKey,
      index
    )

    const { positionAddress: secondPosition } = await market.getPositionAddress(
      secondPositionOwner.publicKey,
      index
    )

    //create update instructions for positions
    const updateSecondsPerLiquidityVars: UpdateSecondsPerLiquidity = {
      pair,
      owner: firstPositionOwner.publicKey,
      lowerTickIndex: firstLowerTick,
      upperTickIndex: firstUpperTick,
      index
    }
    await updateSecondsPerLiquidity(market, updateSecondsPerLiquidityVars, firstPositionOwner)

    const updateSecondsPerLiquidityVars2: UpdateSecondsPerLiquidity = {
      pair,
      owner: secondPositionOwner.publicKey,
      lowerTickIndex: secondLowerTick,
      upperTickIndex: secondUpperTick,
      index
    }
    await updateSecondsPerLiquidity(market, updateSecondsPerLiquidityVars2, secondPositionOwner)

    let firstPositionStructBefore = await market.getPosition(firstPositionOwner.publicKey, index)
    const firstPositionId = firstPositionStructBefore.id

    let secondPositionStructBefore = await market.getPosition(secondPositionOwner.publicKey, index)
    const secondPositionId = secondPositionStructBefore.id

    //stake first position on first incentive, first case
    const createStakeVars: CreateStake = {
      pool,
      id: firstPositionId,
      index,
      position: firstPosition,
      incentive: firstIncentiveAccount.publicKey,
      owner: firstPositionOwner.publicKey,
      amm
    }
    await updatePositionAndCreateStake(
      market,
      staker,
      updateSecondsPerLiquidityVars,
      createStakeVars,
      [firstPositionOwner],
      connection
    )

    //stake second position on first incentive, second case
    const createStakeVars2: CreateStake = {
      pool,
      id: secondPositionId,
      index,
      position: secondPosition,
      incentive: firstIncentiveAccount.publicKey,
      owner: secondPositionOwner.publicKey,
      amm
    }
    await updatePositionAndCreateStake(
      market,
      staker,
      updateSecondsPerLiquidityVars2,
      createStakeVars2,
      [secondPositionOwner],
      connection
    )

    //stake first position on second incentive, third case
    const createStakeVars3: CreateStake = {
      pool,
      id: firstPositionId,
      index,
      position: firstPosition,
      incentive: secondIncentiveAccount.publicKey,
      owner: firstPositionOwner.publicKey,
      amm
    }
    await updatePositionAndCreateStake(
      market,
      staker,
      updateSecondsPerLiquidityVars,
      createStakeVars3,
      [firstPositionOwner],
      connection
    )

    //stake second position on second incentive, fourth case

    const createStakeVars4: CreateStake = {
      pool,
      id: secondPositionId,
      index,
      position: secondPosition,
      incentive: secondIncentiveAccount.publicKey,
      owner: secondPositionOwner.publicKey,
      amm
    }
    await updatePositionAndCreateStake(
      market,
      staker,
      updateSecondsPerLiquidityVars2,
      createStakeVars4,
      [secondPositionOwner],
      connection
    )

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
    await swap(market, swapVars, trader)

    await sleep(10000)

    //withdraw first case
    const withdrawVars: Withdraw = {
      incentive: firstIncentiveAccount.publicKey,
      pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAcc: firstIncentiveTokenAcc,
      ownerTokenAcc: firstOwnerTokenAcc,
      amm,
      index,
      nonce
    }
    await updatePositionAndWithdraw(
      market,
      staker,
      updateSecondsPerLiquidityVars,
      withdrawVars,
      [firstPositionOwner],
      connection
    )

    let balanceAfterFirst = (await firstIncentiveToken.getAccountInfo(firstOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterFirst, new BN('9333332000000'), epsilon))

    //withdraw second case

    const withdrawVars2: Withdraw = {
      incentive: firstIncentiveAccount.publicKey,
      pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAcc: firstIncentiveTokenAcc,
      ownerTokenAcc: secondOwnerTokenAcc,
      amm,
      index,
      nonce
    }
    await updatePositionAndWithdraw(
      market,
      staker,
      updateSecondsPerLiquidityVars2,
      withdrawVars2,
      [secondPositionOwner],
      connection
    )

    let balanceAfterSecond = (await firstIncentiveToken.getAccountInfo(secondOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterSecond, new BN('17333332000000'), epsilon))

    //withdraw third case
    const withdrawVars3: Withdraw = {
      incentive: secondIncentiveAccount.publicKey,
      pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      ownerTokenAcc: firstOwnerTokenAcc,
      amm,
      index,
      nonce
    }
    await updatePositionAndWithdraw(
      market,
      staker,
      updateSecondsPerLiquidityVars,
      withdrawVars3,
      [firstPositionOwner],
      connection
    )

    let balanceAfterThird = (await firstIncentiveToken.getAccountInfo(firstOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterThird, new BN('9337665333000'), epsilon))

    //withdraw fourth case
    const withdrawVars4: Withdraw = {
      incentive: secondIncentiveAccount.publicKey,
      pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      ownerTokenAcc: secondOwnerTokenAcc,
      amm,
      index,
      nonce
    }
    await updatePositionAndWithdraw(
      market,
      staker,
      updateSecondsPerLiquidityVars2,
      withdrawVars4,
      [secondPositionOwner],
      connection
    )

    let balanceAfterFourth = (await firstIncentiveToken.getAccountInfo(secondOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterFourth, new BN('17341998665999'), epsilon))
  })
})
