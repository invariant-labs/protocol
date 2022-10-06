import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair, DENOMINATOR, sleep, PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { Network } from '../staker-sdk/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { createToken, getTime, signAndSend, almostEqual } from './testUtils'
import { createToken as createTkn, initMarket } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { STAKER_ERRORS, toDecimal } from '../staker-sdk/lib/utils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, RemovePosition } from '@invariant-labs/sdk/lib/market'
import { InitPosition, Swap, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { CreateIncentive, CreateStake, Withdraw, Decimal, Staker } from '../staker-sdk/src/staker'
import { assert } from 'chai'
import { tou64 } from '@invariant-labs/sdk/src/utils'
import { assertThrowsAsync } from '@invariant-labs/sdk/lib/utils'
import { ERRORS } from '@invariant-labs/sdk/lib/utils'

describe('Withdraw tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const incentiveAccount = Keypair.generate()
  const secondsIncentiveAccount = Keypair.generate()
  const thirdIncentiveAccount = Keypair.generate()
  const fourthIncentiveAccount = Keypair.generate()
  const fifthIncentiveAccount = Keypair.generate()
  const positionOwner = Keypair.generate()
  const founderAccount = Keypair.generate()
  const admin = Keypair.generate()
  const epsilon = new BN(100)
  let staker: Staker
  let market: Market
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAccount: PublicKey
  let incentiveTokenAccount: Keypair
  let ownerTokenAcc: PublicKey
  let amount: BN
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    // create staker

    staker = await Staker.build(Network.LOCAL, provider.wallet, connection)

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9),
      connection.requestAirdrop(incentiveAccount.publicKey, 10e9),
      connection.requestAirdrop(secondsIncentiveAccount.publicKey, 10e9),
      connection.requestAirdrop(thirdIncentiveAccount.publicKey, 10e9),
      connection.requestAirdrop(fourthIncentiveAccount.publicKey, 10e9),
      connection.requestAirdrop(fifthIncentiveAccount.publicKey, 10e9)
    ])

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()
    ownerTokenAcc = await incentiveToken.createAccount(positionOwner.publicKey)

    // mint to founder acc
    amount = new anchor.BN(5000 * 1e12)
    await incentiveToken.mintTo(founderTokenAccount, wallet, [], tou64(amount))

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

    // create tokens
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
  })

  it('Withdraw - basic case', async () => {
    // create incentive

    const currentTime = getTime()
    const reward: Decimal = { v: new BN(1000) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(20)) }

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: founderTokenAccount,
      invariant
    }
    const createTx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        incentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      createTx,
      [founderAccount, incentiveAccount, incentiveTokenAccount],
      staker.connection
    )
    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 10
    const lowerTick = -30

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(2000000).mul(DENOMINATOR) }

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

    const index = 0

    const { positionAddress: position } = await market.getPositionAddress(
      positionOwner.publicKey,
      index
    )
    // wait for some seconds per liquidity
    await sleep(10000)

    const positionStructBefore = await market.getPosition(positionOwner.publicKey, index)
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    // stake
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: positionId,
      index,
      position,
      incentive: incentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)

    await signAndSend(tx, [positionOwner], staker.connection)

    // Create owner
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

    await sleep(10000)

    // withdraw
    const withdraw: Withdraw = {
      incentive: incentiveAccount.publicKey,
      pool: poolAddress,
      id: positionId,
      position,
      owner: positionOwner.publicKey,
      incentiveTokenAccount: incentiveTokenAccount.publicKey,
      ownerTokenAcc: ownerTokenAcc,
      index
    }

    const withdrawIx = await staker.withdrawIx(withdraw)
    const withdrawTx = new Transaction().add(updateIx).add(withdrawIx)
    await signAndSend(withdrawTx, [positionOwner], staker.connection)

    // should be around half of reward
    const balanceAfter = (await incentiveToken.getAccountInfo(ownerTokenAcc)).amount
    assert.ok(almostEqual(new BN(balanceAfter), new BN('500'), epsilon))
  })
  it('Withdraw - remove position', async () => {
    const founderAccount = Keypair.generate()
    const positionOwner = Keypair.generate()

    await Promise.all([
      connection.requestAirdrop(founderAccount.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()
    ownerTokenAcc = await incentiveToken.createAccount(positionOwner.publicKey)

    // mint to founder acc
    await incentiveToken.mintTo(founderTokenAccount, wallet, [], tou64(new anchor.BN(5000 * 1e12)))

    // create incentive

    const currentTime = getTime()
    const reward: Decimal = { v: new BN(1000) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(20)) }

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: founderTokenAccount,
      invariant
    }
    const createTx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        secondsIncentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      createTx,
      [founderAccount, secondsIncentiveAccount, incentiveTokenAccount],
      staker.connection
    )
    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 10
    const lowerTick = -30

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(2000000).mul(DENOMINATOR) }

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
      slippage: toDecimal(1, 3)
    }
    await market.initPosition(initPositionVars, positionOwner)

    const index = 0

    const { positionAddress: position } = await market.getPositionAddress(
      positionOwner.publicKey,
      index
    )
    // wait for some seconds per liquidity
    await sleep(10000)

    const positionStructBefore = await market.getPosition(positionOwner.publicKey, index)
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    // stake
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: positionId,
      index,
      position,
      incentive: secondsIncentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)

    await signAndSend(tx, [positionOwner], staker.connection)

    // Create owner
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

    await sleep(10000)

    // Remove position
    const removePositionVars: RemovePosition = {
      pair,
      owner: positionOwner.publicKey,
      index: 0,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount
    }
    await market.removePosition(removePositionVars, positionOwner)

    // withdraw
    const withdraw: Withdraw = {
      incentive: secondsIncentiveAccount.publicKey,
      pool: poolAddress,
      id: positionId,
      position,
      owner: positionOwner.publicKey,
      incentiveTokenAccount: incentiveTokenAccount.publicKey,
      ownerTokenAcc: ownerTokenAcc,
      index
    }

    const withdrawIx = await staker.withdrawIx(withdraw)
    const withdrawTx = new Transaction().add(updateIx).add(withdrawIx)

    await assertThrowsAsync(
      signAndSend(withdrawTx, [positionOwner], staker.connection),
      ERRORS.ACCOUNT_OWNED_BY_WRONG_PROGRAM
    )
  })
  it('Withdraw - move position index', async () => {
    const founderAccount = Keypair.generate()
    const positionOwner = Keypair.generate()

    await Promise.all([
      connection.requestAirdrop(founderAccount.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()
    ownerTokenAcc = await incentiveToken.createAccount(positionOwner.publicKey)

    // mint to founder acc
    await incentiveToken.mintTo(founderTokenAccount, wallet, [], tou64(new anchor.BN(5000 * 1e12)))

    // create incentive

    const currentTime = getTime()
    const reward: Decimal = { v: new BN(1000) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(200)) }

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: founderTokenAccount,
      invariant
    }
    const createTx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        thirdIncentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      createTx,
      [founderAccount, thirdIncentiveAccount, incentiveTokenAccount],
      staker.connection
    )
    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 20
    const lowerTick = -40

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(2000000).mul(DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    // create first position
    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: -30,
      upperTick: 10,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: toDecimal(1, 3)
    }
    await market.initPosition(initPositionVars, positionOwner)

    // create second position
    const initPositionVars2: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: toDecimal(1, 3)
    }
    await market.initPosition(initPositionVars2, positionOwner)

    const firstPositionIndex = 0
    const secondPositionIndex = 1

    const { positionAddress: position } = await market.getPositionAddress(
      positionOwner.publicKey,
      secondPositionIndex
    )

    // wait for some seconds per liquidity
    await sleep(10000)

    const positionStructBefore = await market.getPosition(
      positionOwner.publicKey,
      secondPositionIndex
    )
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    // stake
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index: secondPositionIndex
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: positionId,
      index: secondPositionIndex,
      position,
      incentive: thirdIncentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)

    await signAndSend(tx, [positionOwner], staker.connection)

    // Create owner
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

    await sleep(10000)

    // Remove first position
    const removePositionVars: RemovePosition = {
      pair,
      owner: positionOwner.publicKey,
      index: firstPositionIndex,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount
    }
    await market.removePosition(removePositionVars, positionOwner)

    // get second position data, now it should be at index 0
    const { positionAddress: secondPositionAddress } = await market.getPositionAddress(
      positionOwner.publicKey,
      0
    )

    const secondPosition = await market.getPosition(positionOwner.publicKey, 0)

    // withdraw
    const withdraw: Withdraw = {
      incentive: thirdIncentiveAccount.publicKey,
      pool: poolAddress,
      id: secondPosition.id,
      position: secondPositionAddress,
      owner: positionOwner.publicKey,
      incentiveTokenAccount: incentiveTokenAccount.publicKey,
      ownerTokenAcc: ownerTokenAcc,
      index: firstPositionIndex
    }

    // update after
    const updateAfter: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      signer: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index: firstPositionIndex
    }
    const updateAfterIx = await market.updateSecondsPerLiquidityInstruction(updateAfter)

    const withdrawIx = await staker.withdrawIx(withdraw)
    const withdrawTx = new Transaction().add(updateAfterIx).add(withdrawIx)
    await signAndSend(withdrawTx, [positionOwner], staker.connection)
  })
  it('Withdraw - by other account', async () => {
    const founderAccount = Keypair.generate()
    const positionOwner = Keypair.generate()

    await Promise.all([
      connection.requestAirdrop(founderAccount.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()
    ownerTokenAcc = await incentiveToken.createAccount(positionOwner.publicKey)

    // mint to founder acc
    await incentiveToken.mintTo(founderTokenAccount, wallet, [], tou64(new anchor.BN(5000 * 1e12)))

    // create incentive

    const currentTime = getTime()
    const reward: Decimal = { v: new BN(1000) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(200)) }

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: founderTokenAccount,
      invariant
    }
    const createTx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        fourthIncentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      createTx,
      [founderAccount, fourthIncentiveAccount, incentiveTokenAccount],
      staker.connection
    )
    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 20
    const lowerTick = -40

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(2000000).mul(DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    // create first position
    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick: -30,
      upperTick: 10,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: toDecimal(1, 3)
    }
    await market.initPosition(initPositionVars, positionOwner)

    // create second position
    const initPositionVars2: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: toDecimal(1, 3)
    }
    await market.initPosition(initPositionVars2, positionOwner)

    const firstPositionIndex = 0
    const secondPositionIndex = 1

    const { positionAddress: position } = await market.getPositionAddress(
      positionOwner.publicKey,
      secondPositionIndex
    )

    // wait for some seconds per liquidity
    await sleep(10000)

    const positionStructBefore = await market.getPosition(
      positionOwner.publicKey,
      secondPositionIndex
    )
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    // stake
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index: secondPositionIndex
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: positionId,
      index: secondPositionIndex,
      position,
      incentive: fourthIncentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)

    await signAndSend(tx, [positionOwner], staker.connection)

    // Create owner
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

    await sleep(10000)

    // Remove first position
    const removePositionVars: RemovePosition = {
      pair,
      owner: positionOwner.publicKey,
      index: firstPositionIndex,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount
    }
    await market.removePosition(removePositionVars, positionOwner)

    // get second position data, now it should be at index 0
    const { positionAddress: secondPositionAddress } = await market.getPositionAddress(
      positionOwner.publicKey,
      0
    )

    const secondPosition = await market.getPosition(positionOwner.publicKey, 0)

    // withdraw
    const withdraw: Withdraw = {
      incentive: fourthIncentiveAccount.publicKey,
      pool: poolAddress,
      id: secondPosition.id,
      position: secondPositionAddress,
      owner: positionOwner.publicKey,
      incentiveTokenAccount: incentiveTokenAccount.publicKey,
      ownerTokenAcc: ownerTokenAcc,
      index: firstPositionIndex
    }

    // update after
    const updateAfter: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      signer: founderAccount.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index: firstPositionIndex
    }
    const updateAfterIx = await market.updateSecondsPerLiquidityInstruction(updateAfter)

    const withdrawIx = await staker.withdrawIx(withdraw)
    const withdrawTx = new Transaction().add(updateAfterIx).add(withdrawIx)
    await signAndSend(withdrawTx, [founderAccount], staker.connection)
  })
})
