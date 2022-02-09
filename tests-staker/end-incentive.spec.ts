import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair, sleep } from '@invariant-labs/sdk'
import { Network } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { CreateIncentive, Decimal, EndIncentive, Staker } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { assertThrowsAsync, createToken, signAndSend, tou64 } from './testUtils'
import { createToken as createTkn, initEverything } from '../tests/testUtils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token } from '@solana/spl-token'

describe('End incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const admin = Keypair.generate()
  const founderAccount = Keypair.generate()
  const mintAuthority = Keypair.generate()
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
    await Promise.all([
      connection.requestAirdrop(founderAccount.publicKey, 10e9),
      connection.requestAirdrop(admin.publicKey, 10e9)
    ])

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
      createTkn(connection, wallet, mintAuthority)
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
    const endIncentiveIx = await staker.endIncentiveIx(endIncentive)
    const endIncentiveTx = new Transaction().add(endIncentiveIx)
    await signAndSend(endIncentiveTx, [founderAccount], staker.connection)

    const balanceAfter = (await incentiveToken.getAccountInfo(founderTokenAcc)).amount
    assert.ok(balanceAfter.eq(balanceBefore))

    // check if incentive account exist, should not
    await assertThrowsAsync(staker.getIncentive(incentiveAccount.publicKey))
  })
})
