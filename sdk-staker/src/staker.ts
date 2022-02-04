import { Network } from './network'
import { Staker, IDL } from './idl/staker'
import { BN, Program, Provider } from '@project-serum/anchor'
import { IWallet } from '.'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { InitPosition, UpdateSecondsPerLiquidity, Market } from '@invariant-labs/sdk/src/market'
import {
  Connection,
  PublicKey,
  ConfirmOptions,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  Keypair,
  sendAndConfirmRawTransaction
} from '@solana/web3.js'
import { STAKER_SEED } from './utils'
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes'

export class LiquidityMining {
  connection: Connection
  network: Network
  wallet: IWallet
  programId: PublicKey
  public program: Program<Staker>

  opts?: ConfirmOptions

  // TODO implement builder pattern
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
    const provider = new Provider(connection, wallet, opts ?? Provider.defaultOptions())
    switch (network) {
      case Network.LOCAL:
        this.programId = programId
        this.program = new Program(IDL, this.programId, provider)
        break
      default:
        throw new Error('Not supported')
    }
  }

  // frontend methods

  public async createIncentive(createIncentive: CreateIncentive) {
    const incentiveAccount = Keypair.generate()
    const incentive = incentiveAccount.publicKey
    const createIx = await this.createIncentiveIx(createIncentive, incentiveAccount.publicKey)
    const tx = new Transaction().add(createIx)
    const stringTx = await this.signAndSend(tx, [incentiveAccount])

    return { stringTx, incentive }
  }

  public async createStake(
    market: Market,
    update: UpdateSecondsPerLiquidity,
    createStake: CreateStake
  ) {
    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await this.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)
    const stringTx = await this.signAndSend(tx)
    const [stake, bump] = await this.getUserStakeAddressAndBump(
      createStake.incentive,
      createStake.pool,
      createStake.id
    )

    return { stringTx, stake }
  }

  public async withdraw(market: Market, update: UpdateSecondsPerLiquidity, withdraw: Withdraw) {
    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const withdrawIx = await this.withdrawIx(withdraw)
    const tx = new Transaction().add(updateIx).add(withdrawIx)
    const stringTx = await this.signAndSend(tx)

    return stringTx
  }

  public async endIncentive(endIncentive: EndIncentive) {
    const endIncentiveIx = await this.endIncentiveIx(endIncentive)
    const tx = new Transaction().add(endIncentiveIx)
    const stringTx = await this.signAndSend(tx)

    return stringTx
  }

  public async removeStake(pool: PublicKey, id: BN, incentive: PublicKey, founder: PublicKey) {
    const [userStakeAddress] = await this.getUserStakeAddressAndBump(incentive, pool, id)

    const removeIx = await this.removeStakeIx(userStakeAddress, incentive, founder)
    const tx = new Transaction().add(removeIx)
    const stringTx = await this.signAndSend(tx)

    return stringTx
  }

  public async removeAllStakes(staker: LiquidityMining, incentive: PublicKey, founder: Keypair) {
    const stakes = await staker.getAllIncentiveStakes(incentive)
    let tx = new Transaction()

    for (let stake of stakes) {
      tx.add(await staker.removeStakeIx(stake.publicKey, incentive, founder.publicKey))
    }
    const stringTx = await this.signAndSend(tx)

    return stringTx
  }

  // instructions

  public async createIncentiveIx(
    {
      reward,
      startTime,
      endTime,
      founder,
      pool,
      incentiveTokenAcc,
      founderTokenAcc,
      invariant
    }: CreateIncentive,
    incentive: PublicKey
  ) {
    const [stakerAuthority, nonce] = await PublicKey.findProgramAddress(
      [STAKER_SEED],
      this.programId
    )

    return this.program.instruction.createIncentive(nonce, reward, startTime, endTime, {
      accounts: {
        incentive: incentive,
        pool,
        incentiveTokenAccount: incentiveTokenAcc,
        founderTokenAccount: founderTokenAcc,
        founder: founder,
        stakerAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        invariant,
        rent: SYSVAR_RENT_PUBKEY
      }
    })
  }

  public async createStakeIx({
    pool,
    id,
    position,
    incentive,
    owner,
    index,
    invariant
  }: CreateStake) {
    const [userStakeAddress, userStakeBump] = await this.getUserStakeAddressAndBump(
      incentive,
      pool,
      id
    )
    return this.program.instruction.stake(index, userStakeBump, {
      accounts: {
        userStake: userStakeAddress,
        position,
        incentive,
        owner,
        systemProgram: SystemProgram.programId,
        invariant,
        rent: SYSVAR_RENT_PUBKEY
      }
    })
  }

  public async withdrawIx({
    incentive,
    pool,
    id,
    incentiveTokenAcc,
    ownerTokenAcc,
    position,
    owner,
    invariant,
    index
  }: Withdraw) {
    const [stakerAuthority, nonce] = await PublicKey.findProgramAddress(
      [STAKER_SEED],
      this.programId
    )

    const [userStakeAddress] = await this.getUserStakeAddressAndBump(incentive, pool, id)

    return this.program.instruction.withdraw(index, nonce, {
      accounts: {
        userStake: userStakeAddress,
        incentive,
        incentiveTokenAccount: incentiveTokenAcc,
        ownerTokenAccount: ownerTokenAcc,
        position,
        stakerAuthority,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
        invariant,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY
      }
    })
  }

  public async endIncentiveIx({
    incentive,
    incentiveTokenAcc,
    ownerTokenAcc,
    founder
  }: EndIncentive) {
    const [stakerAuthority, stakerAuthorityBump] = await PublicKey.findProgramAddress(
      [STAKER_SEED],
      this.programId
    )

    return this.program.instruction.endIncentive(stakerAuthorityBump, {
      accounts: {
        incentive,
        incentiveTokenAccount: incentiveTokenAcc,
        founderTokenAccount: ownerTokenAcc,
        stakerAuthority,
        founder: founder,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY
      }
    })
  }

  public async removeStakeIx(userStake: PublicKey, incentive: PublicKey, founder: PublicKey) {
    return this.program.instruction.removeStake({
      accounts: {
        incentive,
        userStake: userStake,
        founder: founder,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY
      }
    })
  }

  // getters
  public async getIncentive(incentivePubKey: PublicKey) {
    return (await this.program.account.incentive.fetch(incentivePubKey)) as IncentiveStructure
  }

  public async getUserStakeAddressAndBump(incentive: PublicKey, pool: PublicKey, id: BN) {
    const pubBuf = pool.toBuffer()
    const idBuf = Buffer.alloc(16)
    idBuf.writeBigUInt64LE(BigInt(id.toString()))
    return await PublicKey.findProgramAddress(
      [STAKER_SEED, incentive.toBuffer(), pubBuf, idBuf],
      this.programId
    )
  }

  public async getStake(incentive: PublicKey, pool: PublicKey, id: BN) {
    const [userStakeAddress] = await this.getUserStakeAddressAndBump(incentive, pool, id)
    return await this.program.account.userStake.fetch(userStakeAddress)
  }

  public async getAllIncentiveStakes(incentive: PublicKey) {
    return await this.program.account.userStake.all([
      {
        memcmp: { bytes: bs58.encode(incentive.toBuffer()), offset: 8 }
      }
    ])
  }

  private async signAndSend(tx: Transaction, signers?: Keypair[], opts?: ConfirmOptions) {
    const blockhash = await this.connection.getRecentBlockhash(
      this.opts?.commitment || Provider.defaultOptions().commitment
    )
    tx.feePayer = this.wallet.publicKey
    tx.recentBlockhash = blockhash.blockhash

    await this.wallet.signTransaction(tx)
    if (signers) tx.partialSign(...signers)

    return await sendAndConfirmRawTransaction(
      this.connection,
      tx.serialize(),
      opts ?? Provider.defaultOptions()
    )
  }
}

export interface CreateIncentive {
  reward: Decimal
  startTime: BN
  endTime: BN
  pool: PublicKey
  founder: PublicKey
  incentiveTokenAcc: PublicKey
  founderTokenAcc: PublicKey
  invariant: PublicKey
}
export interface CreateStake {
  pool: PublicKey
  id: BN
  position: PublicKey
  incentive: PublicKey
  owner?: PublicKey
  index: number
  invariant: PublicKey
}
export interface RemoveStake {
  staker: LiquidityMining
  pool: PublicKey
  id: BN
  incentive: PublicKey
  founder: Keypair
  connection: Connection
}
export interface Stake {
  incentive: PublicKey
  position: PublicKey
  secondsPerLiquidityInitial: Decimal
  liquidity: Decimal
  bump: number
}
export interface Withdraw {
  incentive: PublicKey
  pool: PublicKey
  id: BN
  incentiveTokenAcc: PublicKey
  ownerTokenAcc: PublicKey
  position: PublicKey
  owner?: PublicKey
  invariant: PublicKey
  index: number
  nonce: number
}

export interface EndIncentive {
  incentive: PublicKey
  incentiveTokenAcc: PublicKey
  ownerTokenAcc: PublicKey
  founder: PublicKey
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
