import { Network } from './network'
import idl from './idl/staker.json'
import * as anchor from '@project-serum/anchor'
import { BN, Idl, Program, Provider, utils } from '@project-serum/anchor'
import { IWallet } from '.'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  Connection,
  PublicKey,
  ConfirmOptions,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair
} from '@solana/web3.js'
import { STAKER_SEED } from './utils'

export class Staker {
  connection: Connection
  network: Network
  wallet: IWallet
  programId: PublicKey
  stakerAuthority: PublicKey
  idl: Idl = idl as Idl
  public program: Program

  opts?: ConfirmOptions

  public constructor(
    connection: Connection,
    network: Network,
    wallet: IWallet,
    stakerAuthority: PublicKey,
    programId?: PublicKey,
    opts?: ConfirmOptions
  ) {
    this.connection = connection
    this.network = network
    this.wallet = wallet
    this.opts = opts
    this.stakerAuthority = stakerAuthority
    const provider = new Provider(connection, wallet, opts || Provider.defaultOptions())
    switch (network) {
      case Network.LOCAL:
        this.programId = programId
        this.program = new Program(idl as any, this.programId, provider)
        break
      default:
        throw new Error('Not supported')
    }
  }

  public async createIncentiveInstruction({
    reward,
    startTime,
    endTime,
    founder,
    incentive,
    pool,
    incentiveTokenAcc,
    founderTokenAcc,
    amm,
    stakerAuthority
  }: CreateIncentive) {
    return this.program.instruction.createIncentive(reward, startTime, endTime, {
      accounts: {
        incentive: incentive.publicKey,
        pool: pool,
        incentiveTokenAccount: incentiveTokenAcc,
        founderTokenAccount: founderTokenAcc,
        founder: founder.publicKey,
        stakerAuthority: stakerAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        amm: amm,
        rent: SYSVAR_RENT_PUBKEY
      }
    }) as TransactionInstruction
  }

  public async getIncentive(incentivePubKey: PublicKey) {
    return (await this.program.account.incentive.fetch(incentivePubKey)) as IncentiveStructure
  }

  public async stakeInstruction({ position, incentive, owner, index, amm }: createStake) {
    const [userStakeAddress, userStakeBump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode(STAKER_SEED)), owner.toBuffer()],
      this.programId
    )

    return (await this.program.instruction.stake(index, userStakeBump, {
      accounts: {
        userStake: userStakeAddress,
        position,
        incentive: incentive,
        owner,
        systemProgram: SystemProgram.programId,
        amm: amm,
        rent: SYSVAR_RENT_PUBKEY
      }
    })) as TransactionInstruction
  }

  public async getStakeAddress(owner: PublicKey) {
    const [positionAddress, positionBump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode(STAKER_SEED)), owner.toBuffer()],
      this.program.programId
    )
    return {
      positionAddress,
      positionBump
    }
  }

  public async getStake(owner: PublicKey) {
    let { positionAddress } = await this.getStakeAddress(owner)
    return (await this.program.account.userStake.fetch(positionAddress)) as Stake
  }

  public async withdrawInstruction({
    stakeAddress,
    incentive,
    stakerAuthority,
    incentiveTokenAcc,
    userTokenAcc,
    user,
    nonce
  }: Withdraw) {
    return (await this.program.instruction.stake(nonce, {
      accounts: {
        userStake: stakeAddress,
        incentive: incentive,
        incentiveTokenAccount: incentiveTokenAcc,
        useerTokenAccount: userTokenAcc,
        stakerAuthority: stakerAuthority,
        user: user,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY
      }
    })) as TransactionInstruction
  }
}
export interface CreateIncentive {
  reward: Decimal
  startTime: BN
  endTime: BN
  incentive: Keypair
  pool: PublicKey
  founder: Keypair
  incentiveTokenAcc: PublicKey
  founderTokenAcc: PublicKey
  amm: PublicKey
  stakerAuthority: PublicKey
}
export interface createStake {
  position: PublicKey
  incentive: PublicKey
  owner: PublicKey
  amm: PublicKey
  index: number
}
export interface Stake {
  position: PublicKey
  incentive: PublicKey
  liquidity: Decimal
  owner: PublicKey
  amm: PublicKey
  index: number
}
export interface Withdraw {
  stakeAddress: PublicKey
  incentive: PublicKey
  stakerAuthority: PublicKey
  incentiveTokenAcc: PublicKey
  userTokenAcc: PublicKey
  user: PublicKey
  nonce: number
}
export interface IncentiveStructure {
  tokenAccount: PublicKey
  totalRewardUnclaimed: Decimal
  totalSecondsClaimed: Decimal
  startTime: BN
  endTime: BN
  numOfStakes: BN
  pool: PublicKey
}

export interface Decimal {
  v: BN
}

export interface Init {
  nonce: number
  stakerAuthority: PublicKey
}
