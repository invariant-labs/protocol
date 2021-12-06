import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { createToken, tou64, getTime, almostEqual } from './utils'
import { createToken as createTkn } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { signAndSend, fromInteger, toDecimal } from '../sdk-staker/lib/utils'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { DECIMAL, fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, PoolStructure } from '@invariant-labs/sdk/lib/market'
import { sleep } from '@invariant-labs/sdk'

describe('Multicall test', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let staker: Staker
  let market: Market
  let pair: Pair
  const mintAuthority = Keypair.generate()
  const firstIncentiveAccount = Keypair.generate()
  const firstPositionOwner = Keypair.generate()
  const secondIncentiveAccount = Keypair.generate()
  const secondPositionOwner = Keypair.generate()
  const firstFounderAccount = Keypair.generate()
  const secondFounderAccount = Keypair.generate()
  const admin = Keypair.generate()
  let stakerAuthority: PublicKey
  let firstFounderTokenAcc: PublicKey
  let secondFounderTokenAcc: PublicKey
  let fisrtIncentiveTokenAcc: PublicKey
  let secondIncentiveTokenAcc: PublicKey
  let firstOwnerTokenAcc: PublicKey
  let secondOwnerTokenAcc: PublicKey
  let pool: PublicKey
  let amm: PublicKey
  let nonce: number
  let tokenX: Token
  let tokenY: Token
  let firstIncentiveToken: Token
  let secondIncentiveToken: Token
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

    secondIncentiveToken = await createToken({
      connection: connection,
      payer: wallet,
      mintAuthority: wallet.publicKey
    })

    //create taken acc for founder and staker
    firstFounderTokenAcc = await firstIncentiveToken.createAccount(firstFounderAccount.publicKey)
    secondFounderTokenAcc = await firstIncentiveToken.createAccount(secondFounderAccount.publicKey)
    fisrtIncentiveTokenAcc = await firstIncentiveToken.createAccount(stakerAuthority)
    secondIncentiveTokenAcc = await firstIncentiveToken.createAccount(stakerAuthority)
    firstOwnerTokenAcc = await firstIncentiveToken.createAccount(firstPositionOwner.publicKey)
    secondOwnerTokenAcc = await firstIncentiveToken.createAccount(secondPositionOwner.publicKey)

    //mint to founder acc
    amount = new anchor.BN(1000 * 1e12)
    await firstIncentiveToken.mintTo(firstFounderTokenAcc, wallet, [], tou64(amount))
    await firstIncentiveToken.mintTo(secondFounderTokenAcc, wallet, [], tou64(amount))

    //create amm and pool

    market = new Market(0, provider.wallet, connection, anchor.workspace.Amm.programId)

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool
    const fee = 600
    const tickSpacing = 10

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    await market.createState(admin, protocolFee)
    await market.build()
    await market.createFeeTier(feeTier, admin)
    await market.create({
      pair,
      signer: admin
    })
    pool = await pair.getAddress(anchor.workspace.Amm.programId)
    amm = anchor.workspace.Amm.programId

    //create tokens
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })
  it('Multicall', async () => {
    const currenTime = getTime()
    const startTime = currenTime.add(new BN(0))
    const firstReward: Decimal = { v: new BN(200).mul(DENOMINATOR) }
    const endTimeFirst = currenTime.add(new BN(100))
    const secondReward: Decimal = { v: new BN(100).mul(DENOMINATOR) }
    const endTimeSecond = currenTime.add(new BN(100000))

    const ixFirstIncentive = await staker.createIncentiveInstruction({
      reward: firstReward,
      startTime,
      endTime: endTimeFirst,
      incentive: firstIncentiveAccount,
      pool: pool,
      founder: firstFounderAccount,
      incentiveTokenAcc: fisrtIncentiveTokenAcc,
      founderTokenAcc: firstFounderTokenAcc,
      amm: amm
    })
    await signAndSend(
      new Transaction().add(ixFirstIncentive),
      [firstIncentiveAccount, firstFounderAccount],
      connection
    )

    const ixSecondIncentive = await staker.createIncentiveInstruction({
      reward: secondReward,
      startTime,
      endTime: endTimeSecond,
      incentive: secondIncentiveAccount,
      pool: pool,
      founder: secondFounderAccount,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      founderTokenAcc: secondFounderTokenAcc,
      amm: amm
    })
    await signAndSend(
      new Transaction().add(ixSecondIncentive),
      [secondIncentiveAccount, secondFounderAccount],
      connection
    )

    //create first position

    await market.createTick(pair, firstUpperTick, wallet)
    await market.createTick(pair, firstLowerTick, wallet)

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

    await market.createPositionList(firstPositionOwner)
    await market.initPosition(
      {
        pair,
        owner: firstPositionOwner.publicKey,
        userTokenX: firstUserTokenXAccount,
        userTokenY: firstUserTokenYAccount,
        lowerTick: firstLowerTick,
        upperTick: firstUpperTick,
        liquidityDelta: fromInteger(1_000_000)
      },
      firstPositionOwner
    )

    //create second position

    await market.createTick(pair, secondUpperTick, wallet)
    await market.createTick(pair, secondLowerTick, wallet)

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

    await market.createPositionList(secondPositionOwner)
    await market.initPosition(
      {
        pair,
        owner: secondPositionOwner.publicKey,
        userTokenX: secondUserTokenXAccount,
        userTokenY: secondUserTokenYAccount,
        lowerTick: secondLowerTick,
        upperTick: secondUpperTick,
        liquidityDelta: fromInteger(2_000_000)
      },
      secondPositionOwner
    )
    let index = 0

    const { positionAddress: firstPosition, positionBump: firstBump } =
      await market.getPositionAddress(firstPositionOwner.publicKey, index)

    const { positionAddress: secondPosition, positionBump: secondBump } =
      await market.getPositionAddress(secondPositionOwner.publicKey, index)

    //create update instructions for positions
    const ixUpdateFirstPosition = await market.updateSecondsPerLiquidityInstruction({
      pair: pair,
      owner: firstPositionOwner.publicKey,
      lowerTickIndex: firstLowerTick,
      upperTickIndex: firstUpperTick,
      index
    })

    const ixUpdateSecondPosition = await market.updateSecondsPerLiquidityInstruction({
      pair: pair,
      owner: secondPositionOwner.publicKey,
      lowerTickIndex: secondLowerTick,
      upperTickIndex: secondUpperTick,
      index
    })

    await signAndSend(
      new Transaction().add(ixUpdateFirstPosition).add(ixUpdateSecondPosition),
      [firstPositionOwner, secondPositionOwner],
      connection
    )

    let firstPositionStructBefore = await market.getPosition(firstPositionOwner.publicKey, index)
    const firstPositionId = firstPositionStructBefore.id

    let secondPositionStructBefore = await market.getPosition(secondPositionOwner.publicKey, index)
    const secondPositionId = secondPositionStructBefore.id

    //stake first position on first incentive, fisrt case

    const ixStakeFisrt = await staker.stakeInstruction({
      pool: pool,
      id: firstPositionId,
      index: index,
      position: firstPosition,
      incentive: firstIncentiveAccount.publicKey,
      owner: firstPositionOwner.publicKey,
      amm: amm
    })
    await signAndSend(
      new Transaction().add(ixUpdateFirstPosition).add(ixStakeFisrt),
      [firstPositionOwner],
      connection
    )

    //stake second position on first incentive, second case

    const ixStakeSecond = await staker.stakeInstruction({
      pool: pool,
      id: secondPositionId,
      index: index,
      position: secondPosition,
      incentive: firstIncentiveAccount.publicKey,
      owner: secondPositionOwner.publicKey,
      amm: amm
    })
    await signAndSend(
      new Transaction().add(ixUpdateSecondPosition).add(ixStakeSecond),
      [secondPositionOwner],
      connection
    )

    //stake first position on second incentive, third case

    const ixStakeThird = await staker.stakeInstruction({
      pool: pool,
      id: firstPositionId,
      index: index,
      position: firstPosition,
      incentive: secondIncentiveAccount.publicKey,
      owner: firstPositionOwner.publicKey,
      amm: amm
    })
    await signAndSend(
      new Transaction().add(ixUpdateFirstPosition).add(ixStakeThird),
      [firstPositionOwner],
      connection
    )

    //stake second position on second incentive, fourth case

    const ixStakeFourth = await staker.stakeInstruction({
      pool: pool,
      id: secondPositionId,
      index: index,
      position: secondPosition,
      incentive: secondIncentiveAccount.publicKey,
      owner: secondPositionOwner.publicKey,
      amm: amm
    })
    await signAndSend(
      new Transaction().add(ixUpdateSecondPosition).add(ixStakeFourth),
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

    const targetPrice = DENOMINATOR.muln(100).divn(110)

    // Swap
    const poolDataBefore = await market.get(pair)

    const tx = await market.swapTransaction({
      pair,
      XtoY: true,
      amount,
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    })
    await signAndSend(tx, [trader], connection)

    await sleep(10000)
    //withdraw first case

    const ixWithdrawFirstCase = await staker.withdrawInstruction({
      incentive: firstIncentiveAccount.publicKey,
      pool: pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAcc: fisrtIncentiveTokenAcc,
      ownerTokenAcc: firstOwnerTokenAcc,
      amm: amm,
      index: index,
      nonce: nonce
    })
    await signAndSend(
      new Transaction().add(ixUpdateFirstPosition).add(ixWithdrawFirstCase),
      [firstPositionOwner],
      connection
    )

    let balanceAfterFirst = (await firstIncentiveToken.getAccountInfo(firstOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterFirst, new BN('9333332000000'), epsilon))

    //withdraw second case

    const ixWithdrawSecondCase = await staker.withdrawInstruction({
      incentive: firstIncentiveAccount.publicKey,
      pool: pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAcc: fisrtIncentiveTokenAcc,
      ownerTokenAcc: secondOwnerTokenAcc,
      amm: amm,
      index: index,
      nonce: nonce
    })
    await signAndSend(
      new Transaction().add(ixUpdateSecondPosition).add(ixWithdrawSecondCase),
      [secondPositionOwner],
      connection
    )

    let balanceAfterSecond = (await firstIncentiveToken.getAccountInfo(secondOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterSecond, new BN('17333332000000'), epsilon))

    //withdraw third case

    const ixWithdrawthirdCase = await staker.withdrawInstruction({
      incentive: secondIncentiveAccount.publicKey,
      pool: pool,
      id: firstPositionId,
      position: firstPosition,
      owner: firstPositionOwner.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      ownerTokenAcc: firstOwnerTokenAcc,
      amm: amm,
      index: index,
      nonce: nonce
    })
    await signAndSend(
      new Transaction().add(ixUpdateFirstPosition).add(ixWithdrawthirdCase),
      [firstPositionOwner],
      connection
    )

    let balanceAfterThird = (await firstIncentiveToken.getAccountInfo(firstOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterThird, new BN('9337665333000'), epsilon))

    //withdraw fourth case

    const ixWithdrawFourthCase = await staker.withdrawInstruction({
      incentive: secondIncentiveAccount.publicKey,
      pool: pool,
      id: secondPositionId,
      position: secondPosition,
      owner: secondPositionOwner.publicKey,
      incentiveTokenAcc: secondIncentiveTokenAcc,
      ownerTokenAcc: secondOwnerTokenAcc,
      amm: amm,
      index: index,
      nonce: nonce
    })
    await signAndSend(
      new Transaction().add(ixUpdateSecondPosition).add(ixWithdrawFourthCase),
      [secondPositionOwner],
      connection
    )

    let balanceAfterFourth = (await firstIncentiveToken.getAccountInfo(secondOwnerTokenAcc)).amount
    assert.ok(almostEqual(balanceAfterFourth, new BN('17341998665999'), epsilon))
  })
})
