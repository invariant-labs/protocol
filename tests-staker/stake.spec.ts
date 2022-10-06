import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import {
  Market,
  Pair,
  DENOMINATOR,
  PRICE_DENOMINATOR,
  calculatePriceSqrt
} from '@invariant-labs/sdk'
import { Network } from '../staker-sdk/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal, Staker, CreateStake, CreateIncentive } from '../staker-sdk/src/staker'
import { createToken, signAndSend, eqDecimal, assertThrowsAsync } from './testUtils'
import { createToken as createTkn, initMarket } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromFee, FEE_TIERS } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { InitPosition, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { STAKER_ERRORS } from '../staker-sdk/src/utils'
import { tou64 } from '@invariant-labs/sdk/src/utils'

describe('Stake tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const incentiveAccount = Keypair.generate()
  const secondIncentiveAccount = Keypair.generate()
  const founderAccount = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  let staker: Staker
  let market: Market
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAccount: PublicKey
  let incentiveTokenAccount: Keypair
  let secondIncentiveTokenAccount: Keypair
  let amount: BN
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let userTokenXAccount: PublicKey
  let userTokenYAccount: PublicKey

  before(async () => {
    // create staker

    staker = await Staker.build(Network.LOCAL, provider.wallet, connection)

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9),
      connection.requestAirdrop(incentiveAccount.publicKey, 10e9),
      connection.requestAirdrop(secondIncentiveAccount.publicKey, 1e9)
    ])

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()
    secondIncentiveTokenAccount = Keypair.generate()

    // mint to founder acc
    amount = new anchor.BN(100 * 1e6)
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

  it('Stake', async () => {
    // create incentive
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(31_000_000)) }

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
    const lowerTick = -20

    userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

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

    const stake = await staker.getStake(incentiveAccount.publicKey, poolAddress, positionId)
    const positionStructAfter = await market.getPosition(positionOwner.publicKey, index)
    const liquidity: Decimal = { v: new BN(liquidityDelta.v) }

    assert.ok(stake.incentive.equals(incentiveAccount.publicKey))
    assert.ok(
      eqDecimal(stake.secondsPerLiquidityInitial, positionStructAfter.secondsPerLiquidityInside)
    )
    assert.ok(eqDecimal(stake.liquidity, liquidity))
  })
  it('Pass position from other pool to incentive should fail', async () => {
    const feeTier = FEE_TIERS[0]
    const lowerTick = -10
    const upperTick = 10
    const secondPair = new Pair(tokenX.publicKey, tokenY.publicKey, feeTier)
    await market.createFeeTier(
      {
        feeTier: feeTier,
        admin: admin.publicKey
      },
      admin
    )
    await market.createPool({
      pair: secondPair,
      payer: positionOwner
    })

    const newPositionIndex = (await market.getPositionList(positionOwner.publicKey)).head

    await market.initPosition(
      {
        pair: secondPair,
        knownPrice: calculatePriceSqrt(0),
        liquidityDelta: { v: new BN(1) },
        lowerTick,
        upperTick,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        slippage: { v: DENOMINATOR },
        owner: positionOwner.publicKey
      },
      positionOwner
    )

    const { positionAddress } = await market.getPositionAddress(
      positionOwner.publicKey,
      newPositionIndex
    )
    const position = await market.getPosition(positionOwner.publicKey, newPositionIndex)

    const [poolAddress] = await secondPair.getAddressAndBump(anchor.workspace.Invariant.programId)
    const update: UpdateSecondsPerLiquidity = {
      pair: secondPair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index: newPositionIndex
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: position.id,
      index: newPositionIndex,
      position: positionAddress,
      incentive: incentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)

    await assertThrowsAsync(
      signAndSend(tx, [positionOwner], staker.connection),
      STAKER_ERRORS.DIFFERENT_INCENTIVE_POOL
    )
  })
  it('Stake', async () => {
    // create incentive
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(31_000_000)) }

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
        secondIncentiveAccount.publicKey,
        secondIncentiveTokenAccount.publicKey
      )
    )
    await signAndSend(
      createTx,
      [founderAccount, secondIncentiveAccount, secondIncentiveTokenAccount],
      staker.connection
    )

    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 10
    const lowerTick = -20

    userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

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
    const positionStructBefore = await market.getPosition(positionOwner.publicKey, index)
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    // stake
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      signer: admin.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: positionId,
      index,
      position,
      incentive: secondIncentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      signer: admin.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)

    await signAndSend(tx, [admin], staker.connection)

    const stake = await staker.getStake(secondIncentiveAccount.publicKey, poolAddress, positionId)
    const positionStructAfter = await market.getPosition(positionOwner.publicKey, index)
    const liquidity: Decimal = { v: new BN(liquidityDelta.v) }

    assert.ok(stake.incentive.equals(secondIncentiveAccount.publicKey))
    assert.ok(
      eqDecimal(stake.secondsPerLiquidityInitial, positionStructAfter.secondsPerLiquidityInside)
    )
    assert.ok(eqDecimal(stake.liquidity, liquidity))
  })
})
