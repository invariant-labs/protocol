import * as anchor from '@project-serum/anchor'
import { BN, Program, utils, Idl, Provider } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  Signer
} from '@solana/web3.js'
import { findInitialized, isInitialized } from './math'
import { feeToTickSpacing, SEED, signAndSend, tou64 } from './utils'
import idl from './idl/amm.json'
import { IWallet, Pair } from '.'
import { getMarketAddress } from './network'

import { Network } from './network'
const POSITION_SEED = 'positionv1'
const TICK_SEED = 'tickv1'
const POSITION_LIST_SEED = 'positionlistv1'
const FEE_TIER = 'feetierv1'
export const DEFAULT_PUBLIC_KEY = new PublicKey(0)

// in initializable ticks
const RANGE_IN_DIRECTION = 17
const RANGE_IN_OTHER_DIRECTION = 2

export interface Decimal {
  v: BN
}

export interface FeeTierStructure {
  fee: Decimal
  tickSpacing: number
  bump: number
}

export interface PoolStructure {
  tokenX: PublicKey
  tokenY: PublicKey
  tokenXReserve: PublicKey
  tokenYReserve: PublicKey
  tickSpacing: number
  fee: Decimal
  liquidity: Decimal
  sqrtPrice: Decimal
  currentTickIndex: number
  tickmap: PublicKey
  feeGrowthGlobalX: Decimal
  feeGrowthGlobalY: Decimal
  feeProtocolTokenX: Decimal
  feeProtocolTokenY: Decimal
  secondsPerLiquidityGlobal: Decimal
  startTimestamp: BN
  lastTimestamp: BN
  bump: number
  nonce: number
  authority: PublicKey
}

export interface Tickmap {
  bitmap: Array<number>
}

export class Market {
  private connection: Connection
  private wallet: IWallet
  public program: Program

  constructor(network: Network, wallet: IWallet, connection: Connection, programId?: PublicKey) {
    this.connection = connection
    this.wallet = wallet

    const programAddress = Network.LOCAL ? programId : new PublicKey(getMarketAddress(network))

    const provider = new Provider(connection, wallet, Provider.defaultOptions())
    this.program = new Program(idl as any, programAddress, provider)
  }

  async create({ pair, signer, initTick, feeTier }: CreatePool) {
    const { fee, tickSpacing } = feeTier
    const tick = initTick || 0
    const ts = tickSpacing ?? feeToTickSpacing(fee)

    const [programAuthority, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from(SEED)],
      this.program.programId
    )

    const [poolAddress, bump] = await pair.getAddressAndBump(this.program.programId)
    const { address: feeTierAddress } = await this.getFeeTierAddress(feeTier)

    const tokenX = new Token(this.connection, pair.tokenX, TOKEN_PROGRAM_ID, signer)
    const tokenY = new Token(this.connection, pair.tokenY, TOKEN_PROGRAM_ID, signer)

    const tokenXReserve = await tokenX.createAccount(programAuthority)
    const tokenYReserve = await tokenY.createAccount(programAuthority)

    const bitmapKeypair = Keypair.generate()

    await this.program.rpc.create(bump, nonce, tick, fee, ts, {
      accounts: {
        pool: poolAddress,
        feeTier: feeTierAddress,
        tickmap: bitmapKeypair.publicKey,
        tokenX: tokenX.publicKey,
        tokenY: tokenY.publicKey,
        tokenXReserve,
        tokenYReserve,
        programAuthority,
        payer: signer.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      },
      signers: [signer, bitmapKeypair],
      instructions: [await this.program.account.tickmap.createInstruction(bitmapKeypair)]
    })
  }

  async get(pair: Pair) {
    const address = await pair.getAddress(this.program.programId)
    return (await this.program.account.pool.fetch(address)) as PoolStructure
  }

  async getFeeTier(feeTier: FeeTier) {
    const { address } = await this.getFeeTierAddress(feeTier)
    return (await this.program.account.feeTier.fetch(address)) as FeeTierStructure
  }

  async getPool(tokenX: PublicKey, tokenY: PublicKey) {
    const address = await new Pair(tokenX, tokenY).getAddress(this.program.programId)
    return (await this.program.account.pool.fetch(address)) as PoolStructure
  }

  public async onPoolChange(
    tokenX: PublicKey,
    tokenY: PublicKey,
    fn: (poolStructure: PoolStructure) => void
  ) {
    const poolAddress = await new Pair(tokenX, tokenY).getAddress(this.program.programId)

    this.program.account.pool
      .subscribe(poolAddress, 'singleGossip')
      .on('change', (poolStructure: PoolStructure) => {
        fn(poolStructure)
      })
  }

  async getFeeTierAddress({ fee, tickSpacing }: FeeTier) {
    const ts = tickSpacing ?? feeToTickSpacing(fee)
    const tickSpacingBuffer = Buffer.alloc(2)
    const feeBuffer = Buffer.alloc(8)
    tickSpacingBuffer.writeUInt16LE(ts)
    feeBuffer.writeBigUInt64LE(BigInt(fee.toString()))

    const [address, bump] = await PublicKey.findProgramAddress(
      [
        Buffer.from(utils.bytes.utf8.encode(FEE_TIER)),
        this.program.programId.toBuffer(),
        feeBuffer,
        tickSpacingBuffer
      ],
      this.program.programId
    )

    return {
      address,
      bump
    }
  }

  async getTickmap(pair: Pair) {
    const state = await this.get(pair)
    const tickmap = (await this.program.account.tickmap.fetch(state.tickmap)) as Tickmap
    return tickmap
  }

  async isInitialized(pair: Pair, index: number) {
    const state = await this.get(pair)
    const tickmap = await this.getTickmap(pair)
    return isInitialized(tickmap, index, state.tickSpacing)
  }

  async getTick(pair: Pair, index: number) {
    const { tickAddress } = await this.getTickAddress(pair, index)
    return (await this.program.account.tick.fetch(tickAddress)) as Tick
  }

  async getInitializedTicksInRange(pair: Pair, from: number, to: number) {
    const state = await this.get(pair)
    const tickmap = await this.getTickmap(pair)
    const indexes = findInitialized(tickmap.bitmap, from, to, state.tickSpacing)

    return Promise.all(
      indexes.map(async (index) => {
        const { tickAddress } = await this.getTickAddress(pair, index)
        return (await this.program.account.tick.fetch(tickAddress)) as Tick
      })
    )
  }

  async getPositionList(owner: PublicKey) {
    const { positionListAddress } = await this.getPositionListAddress(owner)
    return (await this.program.account.positionList.fetch(positionListAddress)) as PositionList
  }

  async getPosition(owner: PublicKey, index: number) {
    const { positionAddress } = await this.getPositionAddress(owner, index)
    return (await this.program.account.position.fetch(positionAddress)) as Position
  }

  async getPositionsFromIndexes(owner: PublicKey, indexes: Array<number>) {
    const positionPromises = indexes.map(async (tick, i) => {
      return await this.getPosition(owner, i)
    })
    return Promise.all(positionPromises)
  }

  async getPositionsFromRange(owner: PublicKey, lowerIndex: number, upperIndex: number) {
    return this.getPositionsFromIndexes(
      owner,
      Array.from({ length: upperIndex - lowerIndex + 1 }, (_, i) => i + lowerIndex)
    )
  }

  async getTickAddress(pair, index: number) {
    const poolAddress = await pair.getAddress(this.program.programId)
    const indexBuffer = Buffer.alloc(4)
    indexBuffer.writeInt32LE(index)

    const [tickAddress, tickBump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode(TICK_SEED)), poolAddress.toBuffer(), indexBuffer],
      this.program.programId
    )

    return {
      tickAddress,
      tickBump
    }
  }

  async getPositionListAddress(owner: PublicKey) {
    const [positionListAddress, positionListBump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode(POSITION_LIST_SEED)), owner.toBuffer()],
      this.program.programId
    )

    return {
      positionListAddress,
      positionListBump
    }
  }

  async getPositionAddress(owner: PublicKey, index: number) {
    const indexBuffer = Buffer.alloc(4)
    indexBuffer.writeInt32LE(index)

    const [positionAddress, positionBump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode(POSITION_SEED)), owner.toBuffer(), indexBuffer],
      this.program.programId
    )

    return {
      positionAddress,
      positionBump
    }
  }

  async getNewPositionAddress(owner: PublicKey) {
    const positionList = await this.getPositionList(owner)
    return this.getPositionAddress(owner, positionList.head)
  }

  async createFeeTierInstruction(feeTier: FeeTier, payer: PublicKey) {
    const { fee, tickSpacing } = feeTier
    const { address, bump } = await this.getFeeTierAddress(feeTier)
    const ts = tickSpacing ?? feeToTickSpacing(fee)

    return this.program.instruction.createFeeTier(bump, fee, ts, {
      accounts: {
        feeTier: address,
        payer,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    })
  }
  async createFeeTier(feeTier: FeeTier, payer: Keypair) {
    const ix = await this.createFeeTierInstruction(feeTier, payer.publicKey)
    signAndSend(new Transaction().add(ix), [payer], this.connection)
  }

  async createTickInstruction(pair: Pair, index: number, payer: PublicKey) {
    const state = await this.get(pair)

    const { tickAddress, tickBump } = await this.getTickAddress(pair, index)

    return this.program.instruction.createTick(tickBump, index, {
      accounts: {
        tick: tickAddress,
        pool: await pair.getAddress(this.program.programId),
        tickmap: state.tickmap,
        payer,
        tokenX: state.tokenX,
        tokenY: state.tokenY,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    }) as TransactionInstruction
  }

  async createTick(pair: Pair, index: number, payer: Keypair) {
    const lowerIx = await this.createTickInstruction(pair, index, payer.publicKey)
    await signAndSend(new Transaction().add(lowerIx), [payer], this.connection)
  }

  async createPositionListInstruction(owner: PublicKey) {
    const { positionListAddress, positionListBump } = await this.getPositionListAddress(owner)

    return this.program.instruction.createPositionList(positionListBump, {
      accounts: {
        positionList: positionListAddress,
        owner: owner,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    }) as TransactionInstruction
  }

  async createPositionList(owner: Keypair) {
    const ix = await this.createPositionListInstruction(owner.publicKey)

    await signAndSend(new Transaction().add(ix), [owner], this.connection)
  }

  async initPositionInstruction({
    pair,
    owner,
    userTokenX,
    userTokenY,
    lowerTick,
    upperTick,
    liquidityDelta
  }: InitPosition) {
    const state = await this.get(pair)

    // maybe in the future index cloud be store at market
    const positionList = await this.getPositionList(owner)
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTick)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTick)
    const { positionAddress, positionBump } = await this.getPositionAddress(
      owner,
      positionList.head
    )
    const { positionListAddress } = await this.getPositionListAddress(owner)
    const poolAddress = await pair.getAddress(this.program.programId)

    return this.program.instruction.initPosition(
      positionBump,
      lowerTick,
      upperTick,
      liquidityDelta,
      {
        accounts: {
          pool: poolAddress,
          positionList: positionListAddress,
          position: positionAddress,
          owner,
          lowerTick: lowerTickAddress,
          upperTick: upperTickAddress,
          tokenX: pair.tokenX,
          tokenY: pair.tokenY,
          accountX: userTokenX,
          accountY: userTokenY,
          reserveX: state.tokenXReserve,
          reserveY: state.tokenYReserve,
          programAuthority: state.authority,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId
        }
      }
    ) as TransactionInstruction
  }

  async initPositionTx(initPosition: InitPosition) {
    const { owner, userTokenX, userTokenY } = initPosition

    const initPositionIx = await this.initPositionInstruction(initPosition)
    return new Transaction().add(initPositionIx)
  }

  async initPosition(initPosition: InitPosition, signer: Keypair) {
    const { owner, userTokenX, userTokenY } = initPosition

    const tx = await this.initPositionTx(initPosition)
    await signAndSend(tx, [signer], this.connection)
  }

  async swap(
    pair: Pair,
    XtoY: boolean,
    amount: BN,
    priceLimit: BN,
    accountX: PublicKey,
    accountY: PublicKey,
    owner: Keypair
  ) {
    const tx = await this.swapTransaction(
      pair,
      XtoY,
      amount,
      priceLimit,
      accountX,
      accountY,
      owner.publicKey
    )

    await signAndSend(tx, [owner], this.connection)
  }

  async swapTransaction(
    pair: Pair,
    XtoY: boolean,
    amount: BN,
    priceLimit: BN,
    accountX: PublicKey,
    accountY: PublicKey,
    owner: PublicKey
  ) {
    const state = await this.get(pair)
    const tickmap = await this.getTickmap(pair)

    const [lowerBound, upperBound] = XtoY
      ? [-RANGE_IN_DIRECTION * state.tickSpacing, RANGE_IN_OTHER_DIRECTION * state.tickSpacing]
      : [-RANGE_IN_OTHER_DIRECTION * state.tickSpacing, RANGE_IN_DIRECTION * state.tickSpacing]

    const indexes = findInitialized(
      tickmap.bitmap,
      state.currentTickIndex + lowerBound,
      state.currentTickIndex + upperBound,
      state.tickSpacing
    )

    const remainingAccounts = await Promise.all(
      indexes.map(async (index) => {
        const { tickAddress } = await this.getTickAddress(pair, index)
        return tickAddress
      })
    )

    const swapIx = await this.program.instruction.swap(XtoY, amount, true, priceLimit, {
      remainingAccounts: remainingAccounts.map((pubkey) => {
        return { pubkey, isWritable: true, isSigner: false }
      }),
      accounts: {
        pool: await pair.getAddress(this.program.programId),
        tickmap: state.tickmap,
        tokenX: state.tokenX,
        tokenY: state.tokenY,
        reserveX: state.tokenXReserve,
        reserveY: state.tokenYReserve,
        owner,
        accountX,
        accountY,
        programAuthority: state.authority,
        tokenProgram: TOKEN_PROGRAM_ID
      }
    })
    const tx = new Transaction().add(swapIx)

    return tx
  }

  async getReserveBalances(pair: Pair, payer: Signer) {
    const tokenX = new Token(this.connection, pair.tokenX, TOKEN_PROGRAM_ID, payer)
    const tokenY = new Token(this.connection, pair.tokenY, TOKEN_PROGRAM_ID, payer)

    const state = await this.get(pair)

    const accounts = await Promise.all([
      tokenX.getAccountInfo(state.tokenXReserve),
      tokenY.getAccountInfo(state.tokenYReserve)
    ])

    return { x: accounts[0].amount, y: accounts[1].amount }
  }

  async claimFeeInstruction({ pair, owner, userTokenX, userTokenY, index }: ClaimFee) {
    const state = await this.get(pair)
    const { positionAddress, positionBump } = await this.getPositionAddress(owner, index)
    const position = await this.getPosition(owner, index)
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(
      pair,
      position.lowerTickIndex
    )
    const { tickAddress: upperTickAddress } = await this.getTickAddress(
      pair,
      position.upperTickIndex
    )

    return (await this.program.instruction.claimFee(
      index,
      position.lowerTickIndex,
      position.upperTickIndex,
      {
        accounts: {
          pool: await pair.getAddress(this.program.programId),
          position: positionAddress,
          lowerTick: lowerTickAddress,
          upperTick: upperTickAddress,
          owner,
          tokenX: pair.tokenX,
          tokenY: pair.tokenY,
          accountX: userTokenX,
          accountY: userTokenY,
          reserveX: state.tokenXReserve,
          reserveY: state.tokenYReserve,
          programAuthority: state.authority,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    )) as TransactionInstruction
  }

  async claimFee({ pair, owner, userTokenX, userTokenY, index }: ClaimFee, signer: Keypair) {
    const claimFeeIx = await this.claimFeeInstruction({
      pair,
      owner,
      userTokenX,
      userTokenY,
      index
    })

    await signAndSend(new Transaction().add(claimFeeIx), [signer], this.connection)
  }

  async removePositionWithIndexInstruction(
    pair: Pair,
    owner: PublicKey,
    lastPositionIndex: number,
    index: number,
    userTokenX: PublicKey,
    userTokenY: PublicKey
  ): Promise<TransactionInstruction> {
    const { positionListAddress } = await this.getPositionListAddress(owner)
    const { positionAddress: removedPositionAddress } = await this.getPositionAddress(owner, index)
    const { positionAddress: lastPositionAddress } = await this.getPositionAddress(
      owner,
      lastPositionIndex
    )

    const state = await this.get(pair)
    const position = await this.getPosition(owner, index)

    const { tickAddress: lowerTickAddress } = await this.getTickAddress(
      pair,
      position.lowerTickIndex
    )
    const { tickAddress: upperTickAddress } = await this.getTickAddress(
      pair,
      position.upperTickIndex
    )

    return this.program.instruction.removePosition(
      index,
      position.lowerTickIndex,
      position.upperTickIndex,
      {
        accounts: {
          owner: owner,
          removedPosition: removedPositionAddress,
          positionList: positionListAddress,
          lastPosition: lastPositionAddress,
          pool: await pair.getAddress(this.program.programId),
          tickmap: state.tickmap,
          lowerTick: lowerTickAddress,
          upperTick: upperTickAddress,
          tokenX: pair.tokenX,
          tokenY: pair.tokenY,
          accountX: userTokenX,
          accountY: userTokenY,
          reserveX: state.tokenXReserve,
          reserveY: state.tokenYReserve,
          programAuthority: state.authority,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    ) as TransactionInstruction
  }

  async removePositionInstruction(
    pair: Pair,
    owner: PublicKey,
    index: number,
    userTokenX: PublicKey,
    userTokenY: PublicKey
  ): Promise<TransactionInstruction> {
    const positionList = await this.getPositionList(owner)
    return this.removePositionWithIndexInstruction(
      pair,
      owner,
      positionList.head - 1,
      index,
      userTokenX,
      userTokenY
    )
  }

  async transferPositionOwnershipInstruction(
    owner: PublicKey,
    recipient: PublicKey,
    index: number
  ): Promise<TransactionInstruction> {
    const { positionListAddress: ownerList } = await this.getPositionListAddress(owner)
    const { positionListAddress: recipientList } = await this.getPositionListAddress(recipient)

    const ownerPositionList = await this.getPositionList(owner)
    const { positionAddress: removedPosition } = await this.getPositionAddress(owner, index)
    const { positionAddress: lastPosition } = await this.getPositionAddress(
      owner,
      ownerPositionList.head - 1
    )
    const { positionAddress: newPosition, positionBump: newPositionBump } =
      await this.getNewPositionAddress(recipient)

    return this.program.instruction.transferPositionOwnership(newPositionBump, index, {
      accounts: {
        owner,
        recipient,
        ownerList,
        recipientList,
        lastPosition,
        removedPosition,
        newPosition,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    }) as TransactionInstruction
  }

  async updateSecondsPerLiquidityInstruction({
    pair,
    owner,
    lowerTickIndex,
    upperTickIndex,
    position,
    index
  }: SecondsPerLiquidity) {
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTickIndex)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTickIndex)
    const poolAddress = await pair.getAddress(this.program.programId)
    const { positionAddress: positionAddress, positionBump: bump } = await this.getPositionAddress(
      owner,
      index
    )

    return this.program.instruction.updateSecondsPerLiquidity(
      lowerTickIndex,
      upperTickIndex,
      index,
      {
        accounts: {
          pool: poolAddress,
          lowerTick: lowerTickAddress,
          upperTick: upperTickAddress,
          position: positionAddress,
          tokenX: pair.tokenX,
          tokenY: pair.tokenY,
          owner,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId
        }
      }
    ) as TransactionInstruction
  }
}

export interface Decimal {
  v: BN
}

export interface PositionList {
  head: number
  bump: number
}
export interface Tick {
  index: number
  sign: boolean
  liquidityChange: Decimal
  liquidityGross: Decimal
  sqrtPrice: Decimal
  feeGrowthOutsideX: Decimal
  feeGrowthOutsideY: Decimal
  bump: number
}

export interface Position {
  owner: PublicKey
  pool: PublicKey
  id: BN
  liquidity: Decimal
  lowerTickIndex: number
  upperTickIndex: number
  feeGrowthInsideX: Decimal
  feeGrowthInsideY: Decimal
  secondsPerLiquidityInside: Decimal
  tokensOwedX: Decimal
  tokensOwedY: Decimal
  bump: number
}

export enum Errors {
  ZeroAmount = '0x12c', // 0
  ZeroOutput = '0x12d', // 1
  WrongTick = '0x12e', // 2
  WrongLimit = '0x12f', // 3
  InvalidTickSpacing = '0x130', // 4
  InvalidTickInterval = '0x131', // 5
  NoMoreTicks = '0x132', // 6
  TickNotFound = '0x133', // 7
  PriceLimitReached = '0x134' // 8
}

export interface InitPosition {
  pair: Pair
  owner: PublicKey
  userTokenX: PublicKey
  userTokenY: PublicKey
  lowerTick: number
  upperTick: number
  liquidityDelta: Decimal
}

export interface ModifyPosition {
  pair: Pair
  owner: PublicKey
  userTokenX: PublicKey
  userTokenY: PublicKey
  index: number
  liquidityDelta: Decimal
}

export interface CreatePool {
  pair: Pair
  signer: Keypair
  initTick?: number
  feeTier: FeeTier
}

export interface FeeTier {
  fee: BN
  tickSpacing?: number
}

export interface ClaimFee {
  pair: Pair
  owner: PublicKey
  userTokenX: PublicKey
  userTokenY: PublicKey
  index: number
}
export interface SecondsPerLiquidity {
  pair: Pair
  owner: PublicKey
  lowerTickIndex: number
  upperTickIndex: number
  position: PublicKey
  index: number
}
