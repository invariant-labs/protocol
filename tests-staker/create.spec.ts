import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { CreateIncentive, Decimal, Staker } from '../staker-sdk/src/staker'
import { eqDecimal, createToken, assertThrowsAsync, ERRORS_STAKER, signAndSend } from './testUtils'
import { createToken as createTkn, initMarket } from '../tests/testUtils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token } from '@solana/spl-token'
import { Network } from '../staker-sdk/lib'
import { tou64 } from '@invariant-labs/sdk/src/utils'

describe('Create incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const founderAccount = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  let staker: Staker
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAccount: PublicKey
  let incentiveTokenAccount: Keypair
  let amount: BN
  let pair: Pair

  beforeEach(async () => {
    // create staker instance

    staker = await Staker.build(Network.LOCAL, provider.wallet, connection)

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
    await initMarket(market, [pair], admin)
    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
  })

  it('Create incentive ', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime: Decimal = { v: currentTime.add(new BN(0)) }
    const endTime: Decimal = { v: currentTime.add(new BN(31_000_000)) }
    const totalSecondsClaimed: Decimal = { v: new BN(0) }

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

    const createdIncentive = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(createdIncentive.totalRewardUnclaimed.v.eq(reward.v))
    assert.ok(eqDecimal(createdIncentive.totalSecondsClaimed, totalSecondsClaimed))
    assert.ok(createdIncentive.startTime.v.eq(startTime.v))
    assert.ok(createdIncentive.endTime.v.eq(endTime.v))
    assert.ok(createdIncentive.pool.equals(pool))
  })

  it('Fail on zero amount', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(0) }
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

    const tx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        incentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount, incentiveTokenAccount], staker.connection),
      ERRORS_STAKER.ZERO_AMOUNT
    )
  })

  it('Fail, incentive starts more than one hour in past ', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = { v: currentTime.add(new BN(-4000)) }
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
    const tx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        incentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount, incentiveTokenAccount], staker.connection),
      ERRORS_STAKER.START_IN_PAST
    )
  })

  it('Fail, too long incentive time', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(32_000_000)) }

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

    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount, incentiveTokenAccount], staker.connection),
      ERRORS_STAKER.TO_LONG_DURATION
    )
  })
  it('Check if amount on incentive token account after donate is correct', async () => {
    const incentiveAccount = Keypair.generate()
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
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

    const balance = (await incentiveToken.getAccountInfo(incentiveTokenAccount.publicKey)).amount
    assert.ok(balance.eq(new BN(reward.v)))
  })
})
