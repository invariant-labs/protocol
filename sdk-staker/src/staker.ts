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
  idl: Idl = idl as Idl
  public program: Program

  opts?: ConfirmOptions

  public constructor(
    connection: Connection,
    network: Network,
    wallet: IWallet,
    programId?: PublicKey,
    opts?: ConfirmOptions
  ) {
    this.connection = connection
    this.network = network
    this.wallet = wallet
    this.opts = opts
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
    amm
  }: CreateIncentive) {
    const [stakerAuthority, bump] = await PublicKey.findProgramAddress(
      [STAKER_SEED],
      this.programId
    )
    return this.program.instruction.createIncentive(bump, reward, startTime, endTime, {
      accounts: {
        incentive: incentive.publicKey,
        pool: pool,
        incentiveTokenAccount: incentiveTokenAcc,
        founderTokenAccount: founderTokenAcc,
        founder: founder.publicKey,
        stakerAuthority,
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
      [STAKER_SEED, owner.toBuffer(), incentive.toBuffer(), position.toBuffer()],
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

  public async getStakeAddress(owner: PublicKey, incentive: PublicKey, position: PublicKey) {
    const [stakeAddress, stakeBump] = await PublicKey.findProgramAddress(
      [STAKER_SEED, owner.toBuffer(), incentive.toBuffer(), position.toBuffer()],

      this.program.programId
    )
    return {
      stakeAddress,
      stakeBump
    }
  }

  public async getStake(owner: PublicKey, incentive: PublicKey, position: PublicKey) {
    let { stakeAddress } = await this.getStakeAddress(owner, incentive, position)
    return (await this.program.account.userStake.fetch(stakeAddress)) as Stake
  }

  public async withdrawInstruction({
    incentive,
    incentiveTokenAcc,
    ownerTokenAcc,
    position,
    owner,
    amm,
    index
  }: Withdraw) {
    const [stakerAuthority, stakerAuthorityBump] = await PublicKey.findProgramAddress(
      [STAKER_SEED],
      this.programId
    )

    const [userStakeAddress, userStakeBump] = await PublicKey.findProgramAddress(
      [STAKER_SEED, owner.toBuffer(), incentive.toBuffer(), position.toBuffer()],
      this.programId
    )

    return (await this.program.instruction.withdraw(index, userStakeBump, stakerAuthorityBump, {
      accounts: {
        userStake: userStakeAddress,
        incentive: incentive,
        incentiveTokenAccount: incentiveTokenAcc,
        ownerTokenAccount: ownerTokenAcc,
        position,
        stakerAuthority,
        owner: owner,
        tokenProgram: TOKEN_PROGRAM_ID,
        amm: amm,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY
      }
    })) as TransactionInstruction
  }

  public async endIncentiveInstruction({
    incentive,
    incentiveTokenAcc,
    ownerTokenAcc,
    owner
  }: EndIncentive) {
    const [stakerAuthority, stakerAuthorityBump] = await PublicKey.findProgramAddress(
      [STAKER_SEED],
      this.programId
    )

    return (await this.program.instruction.endIncentive(stakerAuthorityBump, {
      accounts: {
        incentive: incentive,
        incentiveTokenAccount: incentiveTokenAcc,
        founderTokenAccount: ownerTokenAcc,
        stakerAuthority,
        owner: owner,
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
  secondsPerLiquidityInitial: Decimal
  owner: PublicKey
  amm: PublicKey
  index: number
}
export interface Withdraw {
  incentive: PublicKey
  incentiveTokenAcc: PublicKey
  ownerTokenAcc: PublicKey
  position: PublicKey
  owner: PublicKey
  amm: PublicKey
  index: number
  nonce: number
}

export interface EndIncentive {
  incentive: PublicKey
  incentiveTokenAcc: PublicKey
  ownerTokenAcc: PublicKey
  owner: PublicKey
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
