import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair, signAndSend } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Staker, CreateIncentive } from '../sdk-staker/lib/staker'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { createToken, tou64, eqDecimal, assertThrowsAsync, ERRORS_STAKER } from './utils'
import { createToken as createTkn } from '../tests/testUtils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { CreateFeeTier, CreatePool } from '@invariant-labs/sdk/src/market'
import { Network } from '../sdk-staker/lib'
import { assert } from 'chai'

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
  let staker: Staker
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token

  let tokenX: Token
  let tokenY: Token
  let founderTokenAcc: PublicKey
  let incentiveTokenAcc: Keypair
  let amount: BN
  let pair: Pair

  before(async () => {
    // create staker instance
    const [_mintAuthority] = await anchor.web3.PublicKey.findProgramAddress(
      [STAKER_SEED],
      program.programId
    )
    stakerAuthority = _mintAuthority
    staker = new Staker(connection, Network.LOCAL, provider.wallet, program.programId)

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    // create taken acc for founder and staker
    founderTokenAcc = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAcc = Keypair.generate()

    // mint to founder acc
    amount = new anchor.BN(100 * 1e6)
    await incentiveToken.mintTo(founderTokenAcc, wallet, [], tou64(amount))

    // create invariant and pool

    const market = await Market.build(
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
      payer: admin,
      tokenX,
      tokenY
    }
    await market.createPool(createPoolVars)
    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
    invariant = anchor.workspace.Invariant.programId
  })

  it('Create incentive ', async () => {
    const incentiveAccount = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise(resolve => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })
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
      incentiveToken: incentiveToken.publicKey,
      incentive: incentiveAccount.publicKey,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAccount: incentiveTokenAcc.publicKey,
      founderTokenAcc: founderTokenAcc,
      invariant
    }
    const tx = await staker.createIncentiveTransaction(createIncentiveVars)
    await signAndSend(tx, [founderAccount, incentiveAccount, incentiveTokenAcc], staker.connection)

    const createdIncentive = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(eqDecimal(createdIncentive.totalRewardUnclaimed, reward))
    assert.ok(eqDecimal(createdIncentive.totalSecondsClaimed, totalSecondsClaimed))
    assert.ok(createdIncentive.startTime.eq(startTime))
    assert.ok(createdIncentive.endTime.eq(endTime))
    assert.ok(createdIncentive.pool.equals(pool))
  })

  it('Fail on zero amount', async () => {
    const incentiveAccount = Keypair.generate()
    incentiveTokenAcc = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise(resolve => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(0) }
    const startTime = currentTime.add(new BN(0))
    const endTime = currentTime.add(new BN(31_000_000))

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      incentiveToken: incentiveToken.publicKey,
      incentive: incentiveAccount.publicKey,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAccount: incentiveTokenAcc.publicKey,
      founderTokenAcc: founderTokenAcc,
      invariant
    }

    const tx = await staker.createIncentiveTransaction(createIncentiveVars)
    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount, incentiveTokenAcc], staker.connection),
      ERRORS_STAKER.ZERO_AMOUNT
    )
  })

  it('Fail, incentive starts more than one hour in past ', async () => {
    const incentiveAccount = Keypair.generate()
    incentiveTokenAcc = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise(resolve => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currentTime.add(new BN(-4000))
    const endTime = currentTime.add(new BN(31_000_000))

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      incentiveToken: incentiveToken.publicKey,
      incentive: incentiveAccount.publicKey,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAccount: incentiveTokenAcc.publicKey,
      founderTokenAcc: founderTokenAcc,
      invariant
    }

    const tx = await staker.createIncentiveTransaction(createIncentiveVars)
    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount, incentiveTokenAcc], staker.connection),
      ERRORS_STAKER.START_IN_PAST
    )
  })

  it('Fail, too long incentive time', async () => {
    const incentiveAccount = Keypair.generate()
    incentiveTokenAcc = Keypair.generate()
    await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    await new Promise(resolve => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })

    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(1000) }
    const startTime = currentTime.add(new BN(0))
    const endTime = currentTime.add(new BN(32_000_000))

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      incentiveToken: incentiveToken.publicKey,
      incentive: incentiveAccount.publicKey,
      pool,
      founder: founderAccount.publicKey,
      incentiveTokenAccount: incentiveTokenAcc.publicKey,
      founderTokenAcc: founderTokenAcc,
      invariant
    }

    const tx = await staker.createIncentiveTransaction(createIncentiveVars)
    await assertThrowsAsync(
      signAndSend(tx, [founderAccount, incentiveAccount, incentiveTokenAcc], staker.connection),
      ERRORS_STAKER.TO_LONG_DURATION
    )
  })
})
