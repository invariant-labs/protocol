import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { eqDecimal, assertThrowsAsync, ERRORS_STAKER, createToken, tou64 } from './utils'
import { createToken as createTkn } from '../tests/testUtils'
import { signAndSend } from '../sdk-staker/lib/utils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token } from '@solana/spl-token'

describe('Create incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  let stakerAuthority: PublicKey
  const mintAuthority = Keypair.generate()
  const founderAccount = Keypair.generate()
  const admin = Keypair.generate()
  let nonce: number
  let staker: Staker
  let pool: PublicKey
  let amm: PublicKey
  let incentiveToken: Token

  let founderTokenAcc: PublicKey
  let incentiveTokenAcc: PublicKey
  let amount: BN
  let pair: Pair

  before(async () => {
    //create staker instance
    const [_mintAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [STAKER_SEED],
      program.programId
    )
    stakerAuthority = _mintAuthority
    nonce = _nonce
    staker = new Staker(connection, Network.LOCAL, provider.wallet, program.programId)

    //create token
    incentiveToken = await createToken({
      connection: connection,
      payer: wallet,
      mintAuthority: wallet.publicKey
    })
    //add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    //create taken acc for founder and staker
    founderTokenAcc = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAcc = await incentiveToken.createAccount(stakerAuthority)

    //mint to founder acc
    amount = new anchor.BN(100 * 1e6)
    await incentiveToken.mintTo(founderTokenAcc, wallet, [], tou64(amount))

    ///////////////////////
    //create amm and pool

    const market = new Market(0, provider.wallet, connection, anchor.workspace.Amm.programId)

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey)

    // create pool
    const fee = 600
    const tickSpacing = 10

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    await market.createFeeTier(feeTier, wallet)
    await market.create({
      pair,
      signer: admin,
      feeTier
    })
    pool = await pair.getAddress(anchor.workspace.Amm.programId)
    amm = anchor.workspace.Amm.programId
  })

  it('Create incentive ', async () => {
    const incentiveAccount = Keypair.generate()

    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currenTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime = currenTime.add(new BN(0))
    const endTime = currenTime.add(new BN(31_000_000))
    const totalSecondsClaimed: Decimal = { v: new BN(0) }

    const ix = await staker.createIncentiveInstruction({
      reward,
      startTime,
      endTime,
      incentive: incentiveAccount,
      pool: pool,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      amm: amm
    })
    await signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection)

    const createdIncentive = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(eqDecimal(createdIncentive.totalRewardUnclaimed, reward))
    assert.ok(eqDecimal(createdIncentive.totalSecondsClaimed, totalSecondsClaimed))
    assert.ok(createdIncentive.startTime.eq(startTime))
    assert.ok(createdIncentive.endTime.eq(endTime))
    assert.ok(createdIncentive.pool.equals(pool))
  })

  it('Fail on zero amount', async () => {
    const incentiveAccount = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currenTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(0) }
    const startTime = currenTime.add(new BN(0))
    const endTime = currenTime.add(new BN(31_000_000))

    const ix = await staker.createIncentiveInstruction({
      reward,
      startTime,
      endTime,
      incentive: incentiveAccount,
      pool: pool,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      amm: amm
    })

    await assertThrowsAsync(
      signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection),
      ERRORS_STAKER.ZERO_AMOUNT
    )
  })

  it('Fail, incentive starts more than one hour in past ', async () => {
    const incentiveAccount = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currenTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currenTime.add(new BN(-4000))
    const endTime = currenTime.add(new BN(31_000_000))

    const ix = await staker.createIncentiveInstruction({
      reward,
      startTime,
      endTime,
      incentive: incentiveAccount,
      pool: pool,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      amm: amm
    })

    await assertThrowsAsync(
      signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection),
      ERRORS_STAKER.START_IN_PAST
    )
  })

  it('Fail, too long incentive time', async () => {
    const incentiveAccount = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currenTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currenTime.add(new BN(0))
    const endTime = currenTime.add(new BN(32_000_000))

    const ix = await staker.createIncentiveInstruction({
      reward,
      startTime,
      endTime,
      incentive: incentiveAccount,
      pool: pool,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      amm: amm
    })

    await assertThrowsAsync(
      signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection),
      ERRORS_STAKER.TO_LONG_DURATION
    )
  })
  it('Check if amount on incentive token account after donate is correct', async () => {
    const incentiveAccount = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    const balanceBefore = (await incentiveToken.getAccountInfo(incentiveTokenAcc)).amount
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currenTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currenTime.add(new BN(0))
    const endTime = currenTime.add(new BN(31_000_000))

    const ix = await staker.createIncentiveInstruction({
      reward,
      startTime,
      endTime,
      incentive: incentiveAccount,
      pool: pool,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      amm: amm
    })
    await signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection)
    const balance = (await incentiveToken.getAccountInfo(incentiveTokenAcc)).amount
    assert.ok(balance.eq(new BN(reward.v).add(balanceBefore)))
  })
})
