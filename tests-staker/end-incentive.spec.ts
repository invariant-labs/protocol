import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair, sleep } from '@invariant-labs/sdk'
import { Network } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { CreateIncentive, Decimal, EndIncentive, LiquidityMining } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { assertThrowsAsync, createToken, tou64, signAndSend } from './testUtils'
import { createToken as createTkn } from '../tests/testUtils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { CreateFeeTier, CreatePool } from '@invariant-labs/sdk/src/market'

describe('End incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const founderAccount = Keypair.generate()
  const mintAuthority = Keypair.generate()

  let stakerAuthority: PublicKey
  let staker: LiquidityMining
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let tokenX: Token
  let tokenY: Token
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
    staker = new LiquidityMining(
      connection,
      Network.LOCAL,
      provider.wallet,
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
    const admin = Keypair.generate()
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

  it('End incentive ', async () => {
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
    const endTime = currentTime.add(new BN(10))

    const balanceBefore = (await incentiveToken.getAccountInfo(founderTokenAcc)).amount

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

    const createIx = await staker.createIncentiveIx(createIncentiveVars, incentiveAccount.publicKey)
    const createTx = new Transaction().add(createIx)
    await signAndSend(createTx, [founderAccount, incentiveAccount], staker.connection)

    await sleep(18000)

    const endIncentive: EndIncentive = {
      incentive: incentiveAccount.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      ownerTokenAcc: founderTokenAcc,
      founder: founderAccount.publicKey
    }
    const endIncentiveIx = await staker.endIncentiveInstruction(endIncentive)
    const endIncentiveTx = new Transaction().add(endIncentiveIx)
    await signAndSend(endIncentiveTx, [founderAccount], staker.connection)

    const balanceAfter = (await incentiveToken.getAccountInfo(founderTokenAcc)).amount
    assert.ok(balanceAfter.eq(balanceBefore))

    // check if incentive account exist, should not
    await assertThrowsAsync(staker.getIncentive(incentiveAccount.publicKey))
  })
})
