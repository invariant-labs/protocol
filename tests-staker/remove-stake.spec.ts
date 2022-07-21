import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair, DENOMINATOR, sleep } from '@invariant-labs/sdk'
import { Network } from '../staker-sdk/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { CreateIncentive, CreateStake, Decimal, Staker } from '../staker-sdk/src/staker'
import { eqDecimal, createToken, signAndSend } from './testUtils'
import { createToken as createTkn } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import {
  CreateFeeTier,
  CreatePool,
  InitPosition,
  UpdateSecondsPerLiquidity
} from '@invariant-labs/sdk/src/market'
import { tou64 } from '@invariant-labs/sdk/src/utils'

// To run this test you have change WEEK to 3 sec in staker program

describe('Remove Stake tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const incentiveAccount = Keypair.generate()
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
  let amount: BN
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    // create staker
    staker = await Staker.build(Network.LOCAL, provider.wallet, connection)

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(positionOwner.publicKey, 1e9),
      await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    ])

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()

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
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool
    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)

    const createPoolVars: CreatePool = {
      pair,
      payer: admin
    }
    await market.createPool(createPoolVars)

    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
    invariant = anchor.workspace.Invariant.programId
  })

  it('Remove', async () => {
    // create incentive
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(5)) }

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

    const tx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        incentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      tx,
      [founderAccount, incentiveAccount, incentiveTokenAccount],
      staker.connection
    )

    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 10
    const lowerTick = -20

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
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
      slippage: { v: new BN(0) },
      knownPrice: (await market.getPool(pair)).sqrtPrice,
      liquidityDelta
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

    // create stake
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      signer: positionOwner.publicKey,
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
      signer: positionOwner.publicKey,
      invariant
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const stakeTx = new Transaction().add(updateIx).add(stakeIx)

    await signAndSend(stakeTx, [positionOwner], staker.connection)

    const stake = await staker.getStake(incentiveAccount.publicKey, poolAddress, positionId)
    const positionStructAfter = await market.getPosition(positionOwner.publicKey, index)
    const liquidity: Decimal = { v: new BN(liquidityDelta.v) }

    assert.ok(stake.position.equals(position))
    assert.ok(stake.incentive.equals(incentiveAccount.publicKey))
    assert.ok(
      eqDecimal(stake.secondsPerLiquidityInitial, positionStructAfter.secondsPerLiquidityInside)
    )
    assert.ok(eqDecimal(stake.liquidity, liquidity))

    const incentiveBefore = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(incentiveBefore.numOfStakes.eq(new BN('1')))

    await sleep(10000)
    const [userStakeAddress] = await staker.getUserStakeAddressAndBump(
      incentiveAccount.publicKey,
      pool,
      positionId
    )

    const removeIx = await staker.removeStakeIx(
      userStakeAddress,
      incentiveAccount.publicKey,
      founderAccount.publicKey
    )
    const removeTx = new Transaction().add(removeIx)
    await signAndSend(removeTx, [founderAccount], staker.connection)

    const incentiveAfter = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(incentiveAfter.numOfStakes.eq(new BN('0')))
  })
})
