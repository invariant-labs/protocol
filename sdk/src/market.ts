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
import { findInitialized, fromInteger } from './math'
import { SEED, signAndSend, tou64 } from './utils'
import idl from './idl/amm.json'
import { IWallet, Pair } from '.'
import { getMarketAddress } from './network'

import { Amm } from './idl/amm'
import { Network } from './network'
const POSITION_SEED = 'positionv1'
const TICK_SEED = 'tickv1'
const POSITION_LIST_SEED = 'positionlistv1'
export const DEFAULT_PUBLIC_KEY = new PublicKey(0)

// in initializable ticks
const RANGE_IN_DIRECTION = 17
const RANGE_IN_OTHER_DIRECTION = 2

export interface Decimal {
  v: BN
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
  public program: Program<Amm>

  constructor(network: Network, wallet: IWallet, connection: Connection, programId?: PublicKey) {
    this.connection = connection
    this.wallet = wallet

    const programAddress = Network.LOCAL ? programId : new PublicKey(getMarketAddress(network))

    const provider = new Provider(connection, wallet, Provider.defaultOptions())
    this.program = new Program<Amm>(idl as any, programAddress, provider)
  }

  async create({ pair, signer, initTick, fee, tickSpacing }: CreatePool) {
    const tick = initTick || 0

    const [programAuthority, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from(SEED)],
      this.program.programId
    )

    const [poolAddress, bump] = await pair.getAddressAndBump(this.program.programId)

    const tokenX = new Token(this.connection, pair.tokenX, TOKEN_PROGRAM_ID, signer)
    const tokenY = new Token(this.connection, pair.tokenY, TOKEN_PROGRAM_ID, signer)

    const tokenXReserve = await tokenX.createAccount(programAuthority)
    const tokenYReserve = await tokenY.createAccount(programAuthority)

    const bitmapKeypair = await Keypair.generate()

    await this.program.rpc.create(bump, nonce, tick, new BN(fee), new BN(tickSpacing), {
      accounts: {
        pool: poolAddress,
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

  async getTickmap(pair: Pair) {
    const state = await this.get(pair)
    const tickmap = (await this.program.account.tickmap.fetch(state.tickmap)) as Tickmap
    return tickmap
  }

  async getApproveInstruction(pair: Pair, owner: PublicKey, account: PublicKey, amount: BN) {
    return Token.createApproveInstruction(
      TOKEN_PROGRAM_ID,
      account,
      (await this.get(pair)).authority,
      owner,
      [],
      tou64(amount)
    )
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

  async createTickInstruction(pair: Pair, index: number, payer: PublicKey) {
    const state = await this.get(pair)

    const { tickAddress, tickBump } = await this.getTickAddress(pair, index)

    return (await this.program.instruction.createTick(tickBump, index, {
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
    })) as TransactionInstruction
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
    index,
    lowerTick,
    upperTick,
    liquidityDelta
  }: InitPosition) {
    const state = await this.get(pair)

    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTick)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTick)
    const { positionAddress, positionBump } = await this.getPositionAddress(owner, index)
    const { positionListAddress } = await this.getPositionListAddress(owner)
    const poolAddress = await pair.getAddress(this.program.programId)

    return this.program.instruction.initPosition(
      positionBump,
      index,
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

  async withdrawInstruction({
    pair,
    owner,
    userTokenX,
    userTokenY,
    index,
    liquidityDelta
  }: ModifyPosition) {
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

    return this.program.instruction.withdraw(
      // positionBump,
      index,
      position.lowerTickIndex,
      position.upperTickIndex,
      liquidityDelta,
      {
        accounts: {
          pool: await pair.getAddress(this.program.programId),
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
          tokenProgram: TOKEN_PROGRAM_ID
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

  async withdraw(
    { pair, owner, userTokenX, userTokenY, index, liquidityDelta }: ModifyPosition,
    signer: Keypair
  ) {
    const withdrawPositionIx = await this.withdrawInstruction({
      pair,
      owner,
      userTokenX,
      userTokenY,
      index,
      liquidityDelta
    })

    await signAndSend(new Transaction().add(withdrawPositionIx), [signer], this.connection)
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
        accountX,
        accountY,
        programAuthority: state.authority,
        tokenProgram: TOKEN_PROGRAM_ID
      }
    })
    let approve: TransactionInstruction
    if (XtoY) {
      approve = Token.createApproveInstruction(
        TOKEN_PROGRAM_ID,
        accountX,
        state.authority,
        owner,
        [],
        tou64(amount)
      )
    } else {
      approve = Token.createApproveInstruction(
        TOKEN_PROGRAM_ID,
        accountY,
        state.authority,
        owner,
        [],
        tou64(amount)
      )
    }
    const tx = new Transaction().add(approve).add(swapIx)

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
  liquidity: Decimal
  lowerTickIndex: number
  upperTickIndex: number
  feeGrowthInsideX: Decimal
  feeGrowthInsideY: Decimal
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
  index: number
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
  fee: number
  tickSpacing: number
}
