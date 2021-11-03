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
  let userStake
  let positionAddress
  let owner
  let incentive
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

    // create user stake
    userStake = Keypair.generate()

    positionAddress = Keypair.generate()

    owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 10e9)
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(null)
      }, 1000)
    })
  })

  it('Stake', async () => {
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

    let index = 0
    const ixStake = await staker.stakeInstruction({
      positionAddress: positionAddress.publicKey,
      incentive: incentiveAccount.publicKey,
      owner: owner.publicKey,
      index: index
    })
    await signAndSend(new Transaction().add(ixStake), [owner], connection)
  })
})
