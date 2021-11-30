import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
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
import { sleep } from '@invariant-labs/sdk'
import { Token } from '@solana/spl-token'

describe('End incentive tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let stakerAuthority: PublicKey
  const mintAuthority = Keypair.generate()
  let nonce: number
  let staker: Staker
  let pool: PublicKey
  let amm: PublicKey
  let incentiveToken: Token
  const founderAccount = Keypair.generate()
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
    const admin = Keypair.generate()
    const market = new Market(0, provider.wallet, connection, anchor.workspace.Amm.programId)

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool
    const fee = 600
    const tickSpacing = 10

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    await market.createState(admin, protocolFee)
    await market.createFeeTier(feeTier, admin)
    await market.create({
      pair,
      signer: admin
    })
    pool = await pair.getAddress(anchor.workspace.Amm.programId)
    amm = anchor.workspace.Amm.programId
  })

  it('End incentive ', async () => {
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
    const endTime = currenTime.add(new BN(10))
    const totalSecondsClaimed: Decimal = { v: new BN(0) }

    const balanceBefore = (await incentiveToken.getAccountInfo(founderTokenAcc)).amount

    const ixCreate = await staker.createIncentiveInstruction({
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
