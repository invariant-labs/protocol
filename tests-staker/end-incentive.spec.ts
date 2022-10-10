import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair, sleep } from '@invariant-labs/sdk'
import { Network } from '../staker-sdk/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { CreateIncentive, Decimal, EndIncentive, Staker } from '../staker-sdk/src/staker'
import { assertThrowsAsync, createToken, signAndSend } from './testUtils'
import { createToken as createTkn, initMarket } from '../tests/testUtils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token } from '@solana/spl-token'
import { tou64 } from '@invariant-labs/sdk/src/utils'

describe('End incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const admin = Keypair.generate()
  const founderAccount = Keypair.generate()
  const mintAuthority = Keypair.generate()
  let market: Market
  let staker: Staker
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAccount: PublicKey
  let incentiveTokenAccount: Keypair
  let amount: BN
  let pair: Pair

  before(async () => {
    // create staker instance

    staker = await Staker.build(Network.LOCAL, provider.wallet, connection)

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await Promise.all([
      connection.requestAirdrop(founderAccount.publicKey, 10e9),
      connection.requestAirdrop(admin.publicKey, 10e9)
    ])

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
    await initMarket(market, [pair], admin)
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
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(10)) }

    const balanceBefore = (await incentiveToken.getAccountInfo(founderTokenAccount)).amount

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

    const createIx = await staker.createIncentiveIx(
      createIncentiveVars,
      incentiveAccount.publicKey,
      incentiveTokenAccount.publicKey
    )
    const createTx = new Transaction().add(createIx)
    await signAndSend(
      createTx,
      [founderAccount, incentiveAccount, incentiveTokenAccount],
      staker.connection
    )

    await sleep(18000)

    const endIncentive: EndIncentive = {
      incentive: incentiveAccount.publicKey,
      incentiveTokenAccount: incentiveTokenAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: founderTokenAccount,
      founder: founderAccount.publicKey
    }
    const endIncentiveIx = await staker.endIncentiveIx(endIncentive)
    const endIncentiveTx = new Transaction().add(endIncentiveIx)
    await signAndSend(endIncentiveTx, [founderAccount], staker.connection)

    const balanceAfter = (await incentiveToken.getAccountInfo(founderTokenAccount)).amount
    assert.ok(balanceAfter.eq(balanceBefore))

    // check if incentive account exist, should not
    await assertThrowsAsync(staker.getIncentive(incentiveAccount.publicKey))
  })
})
