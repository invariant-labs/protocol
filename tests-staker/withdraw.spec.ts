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

describe('withdraw', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  let stakerAuthority: PublicKey
  let nonce: number
  let staker: Staker

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
  })

  it('Stake', async () => {
    const positionAddress = Keypair.generate()
    const owner = Keypair.generate()

    // const ix = await staker.withdrawInstruction({
    //   stakerAuthority: stakerAuthority
    // })
  })
})

//TODO check empty incentive
//TODO check not started incentive
//TODO check nomberOfStakes
