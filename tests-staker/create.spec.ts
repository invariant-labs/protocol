import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { CreateIncentive, Decimal, Staker } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import {
  eqDecimal,
  createToken,
  tou64,
  assertThrowsAsync,
  ERRORS_STAKER,
  signAndSend
} from './testUtils'
import { createToken as createTkn, initEverything } from '../tests/testUtils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token } from '@solana/spl-token'
import { Network } from '../sdk-staker/lib'

describe('Create incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const founderAccount = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  let stakerAuthority: PublicKey
  let staker: Staker
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAcc: PublicKey
  let incentiveTokenAcc: PublicKey
  let amount: BN
  let pair: Pair

  before(async () => {
    // create staker instance
    const [_mintAuthority] = await anchor.web3.PublicKey.findProgramAddress(
      [STAKER_SEED],
      anchor.workspace.Staker.programId
    )
    stakerAuthority = _mintAuthority
    staker = await Staker.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Staker.programId
    )

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    // create taken acc for founder and staker
    founderTokenAcc = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAcc = await incentiveToken.createAccount(stakerAuthority)

    // mint to founder acc
    amount = new anchor.BN(100 * 1e6)
    await incentiveToken.mintTo(founderTokenAcc, wallet, [], tou64(amount))

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
    invariant = anchor.workspace.Invariant.programId
  })

  it('#init()', async () => {
    await initEverything(market, [pair], admin)
    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
  })

  it('Create incentive ', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime = currentTime.add(new BN(0))
    const endTime = currentTime.add(new BN(31_000_000))
    const totalSecondsClaimed: Decimal = { v: new BN(0) }

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      invariant
    }

    const tx = new Transaction().add(
      await staker.createIncentiveIx(createIncentiveVars, incentiveAccount.publicKey)
    )
    await signAndSend(tx, [founderAccount, incentiveAccount], staker.connection)

    const createdIncentive = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(eqDecimal(createdIncentive.totalRewardUnclaimed, reward))
    assert.ok(eqDecimal(createdIncentive.totalSecondsClaimed, totalSecondsClaimed))
    assert.ok(createdIncentive.startTime.eq(startTime))
    assert.ok(createdIncentive.endTime.eq(endTime))
    assert.ok(createdIncentive.pool.equals(pool))
  })

  it('Fail on zero amount', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(0) }
    const startTime = currentTime.add(new BN(0))
    const endTime = currentTime.add(new BN(31_000_000))

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      invariant
    }

    const tx = new Transaction().add(
      await staker.createIncentiveIx(createIncentiveVars, incentiveAccount.publicKey)
    )

    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount], staker.connection),
      ERRORS_STAKER.ZERO_AMOUNT
    )
  })

  it('Fail, incentive starts more than one hour in past ', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currentTime.add(new BN(-4000))
    const endTime = currentTime.add(new BN(31_000_000))

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      invariant
    }
    const tx = new Transaction().add(
      await staker.createIncentiveIx(createIncentiveVars, incentiveAccount.publicKey)
    )

    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount], staker.connection),
      ERRORS_STAKER.START_IN_PAST
    )
  })

  it('Fail, too long incentive time', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currentTime.add(new BN(0))
    const endTime = currentTime.add(new BN(32_000_000))

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      invariant
    }

    const tx = new Transaction().add(
      await staker.createIncentiveIx(createIncentiveVars, incentiveAccount.publicKey)
    )

    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount], staker.connection),
      ERRORS_STAKER.TO_LONG_DURATION
    )
  })
  it('Check if amount on incentive token account after donate is correct', async () => {
    const incentiveAccount = Keypair.generate()
    const balanceBefore = (await incentiveToken.getAccountInfo(incentiveTokenAcc)).amount
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currentTime.add(new BN(0))
    const endTime = currentTime.add(new BN(31_000_000))

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      invariant
    }

    const tx = new Transaction().add(
      await staker.createIncentiveIx(createIncentiveVars, incentiveAccount.publicKey)
    )

    await signAndSend(tx, [founderAccount, incentiveAccount], staker.connection)

    const balance = (await incentiveToken.getAccountInfo(incentiveTokenAcc)).amount
    assert.ok(balance.eq(new BN(reward.v).add(balanceBefore)))
  })
})
