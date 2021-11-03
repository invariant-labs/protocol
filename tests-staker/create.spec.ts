import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal } from '../sdk-staker/src/staker'
import {
  eqDecimal,
  assertThrowsAsync,
  ERRORS,
  ERRORS_STAKER,
  STAKER_SEED,
  createToken,
  tou64
} from './utils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { signAndSend } from '../sdk-staker/lib/utils'
import { chmodSync } from 'fs'

describe('Create incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  let stakerAuthority: PublicKey
  let nonce: number
  let staker: Staker
  let pool
  let incentiveToken
  let founderAccount
  let founderTokenAcc
  let incentiveTokenAcc
  let amount

  before(async () => {
    const [_mintAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [STAKER_SEED],
      program.programId
    )
    stakerAuthority = _mintAuthority
    nonce = _nonce
    staker = new Staker(
      connection,
      Network.LOCAL,
      provider.wallet,
      stakerAuthority,
      program.programId
    )

    // create pool addres
    pool = Keypair.generate()
    // create founder account
    founderAccount = Keypair.generate()
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
      pool: pool.publicKey,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      stakerAuthority: stakerAuthority
    })
    await signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection)

    const createdIncentive = await staker.get(incentiveAccount.publicKey)
    assert.ok(eqDecimal(createdIncentive.totalRewardUnclaimed, reward))
    assert.ok(eqDecimal(createdIncentive.totalSecondsClaimed, totalSecondsClaimed))
    assert.ok(createdIncentive.startTime.eq(startTime))
    assert.ok(createdIncentive.endTime.eq(endTime))
    //TODO test incentive token address
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
      pool: pool.publicKey,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      stakerAuthority: stakerAuthority
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
      pool: pool.publicKey,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      stakerAuthority: stakerAuthority
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
      pool: pool.publicKey,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      stakerAuthority: stakerAuthority
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
      pool: pool.publicKey,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      stakerAuthority: stakerAuthority
    })
    await signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection)
    const balance = (await incentiveToken.getAccountInfo(incentiveTokenAcc)).amount
    assert.ok(balance.eq(new BN(reward.v).add(balanceBefore)))
  })

  // it('Check if amount on incentive token account after donate is correct', async () => {
  //   const incentiveAccount = Keypair.generate()
  //   await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
  //   await new Promise((resolve) => {
  //     setTimeout(() => {
  //       resolve(null)
  //     }, 1000)
  //   })

  //   const seconds = new Date().valueOf() / 1000
  //   const currenTime = new BN(Math.floor(seconds))
  //   const reward: Decimal = { v: new BN(1000) }
  //   const startTime = currenTime.add(new BN(0))
  //   const endTime = currenTime.add(new BN(31_000_000))

  //   const createIx = await staker.createIncentiveInstruction({
  //     reward,
  //     startTime,
  //     endTime,
  //     incentive: incentiveAccount,
  //     pool: pool,
  //     founder: founderAccount,
  //     incentiveTokenAcc: incentiveTokenAcc,
  //     founderTokenAcc: founderTokenAcc,
  //     stakerAuthority: stakerAuthority
  //   })
  //   await signAndSend(new Transaction().add(createIx), [incentiveAccount, founderAccount], connection)

  //   await new Promise((resolve) => {
  //     setTimeout(() => {
  //       resolve(null)
  //     }, 1000)
  //   })

  //   const balanceBefore = (await incentiveToken.getAccountInfo(incentiveTokenAcc)).amount
  //   const amount: Decimal = { v: new BN(1000) }

  //   const increaseIx = await staker.increaseIncentiveInstruction({
  //     amount,
  //     incentive: incentiveAccount,
  //     founder: founderAccount,
  //     incentiveTokenAcc: incentiveTokenAcc,
  //     founderTokenAcc: founderTokenAcc,
  //     stakerAuthority: stakerAuthority
  //   })
  //   await signAndSend(new Transaction().add(increaseIx), [founderAccount], connection)

  //   const balanceAfter = (await incentiveToken.getAccountInfo(incentiveTokenAcc)).amount
  //   assert.ok(balanceAfter.eq(new BN(amount.v).add(balanceBefore)))
  //   const createdIncentive = await staker.get(incentiveAccount.publicKey)
  //   const totalReward: Decimal = { v: reward.v.add(amount.v) }
  //   assert.ok(eqDecimal(createdIncentive.totalRewardUnclaimed, totalReward))
  // })
})
