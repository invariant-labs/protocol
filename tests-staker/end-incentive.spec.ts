import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair, sleep } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { createToken, tou64 } from './utils'
import { createToken as createTkn } from '../tests/testUtils'
import { signAndSend } from '../sdk-staker/lib/utils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { CreateFeeTier, CreatePool } from '@invariant-labs/sdk/src/market'

describe('End incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const founderAccount = Keypair.generate()
  const mintAuthority = Keypair.generate()

  let stakerAuthority: PublicKey
  let staker: Staker
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
    incentiveTokenAcc = await incentiveToken.createAccount(stakerAuthority)

    // mint to founder acc
    amount = new anchor.BN(100 * 1e6)
    await incentiveToken.mintTo(founderTokenAcc, wallet, [], tou64(amount))

    /// ////////////////////
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

    const ixCreate = await staker.createIncentiveTransaction({
      reward,
      startTime,
      endTime,
      incentive: incentiveAccount.publicKey,
      pool: pool,
      founder: founderAccount.publicKey,
      founderTokenAcc: founderTokenAcc,
      invariant
    })
    await signAndSend(
      new Transaction().add(ixCreate),
      [incentiveAccount, founderAccount],
      connection
    )

    await sleep(12000)

    const ixEndIncentive = await staker.endIncentiveInstruction({
      incentive: incentiveAccount.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      ownerTokenAcc: founderTokenAcc,
      owner: founderAccount.publicKey
    })
    await signAndSend(new Transaction().add(ixEndIncentive), [founderAccount], connection)

    const balanceAfter = (await incentiveToken.getAccountInfo(founderTokenAcc)).amount
    assert.ok(balanceAfter.eq(balanceBefore))
  })
})
