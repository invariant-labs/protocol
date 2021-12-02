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
import { calculatePriceAfterSlippage, findClosestTicks, isInitialized } from './math'
import {
  feeToTickSpacing,
  generateTicksArray,
  getFeeTierAddress,
  parseLiquidityOnTicks,
  SEED,
  signAndSend
} from './utils'
import { Amm, IDL } from './idl/amm'
import { IWallet, Pair } from '.'
import { getMarketAddress } from './network'

import { Network } from './network'
const POSITION_SEED = 'positionv1'
const TICK_SEED = 'tickv1'
const POSITION_LIST_SEED = 'positionlistv1'
const STATE_SEED = 'statev1'
export const FEE_TIER = 'feetierv1'
export const DEFAULT_PUBLIC_KEY = new PublicKey(0)

export interface Decimal {
  v: BN
}

export interface State {
  protocolFee: Decimal
  admin: PublicKey
  bump: number
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
  public connection: Connection
  public wallet: IWallet
  public program: Program<Amm>

  constructor(network: Network, wallet: IWallet, connection: Connection, programId?: PublicKey) {
    this.connection = connection
    this.wallet = wallet
    const programAddress = new PublicKey(getMarketAddress(network))
    const provider = new Provider(connection, wallet, Provider.defaultOptions())

    this.program = new Program(IDL, programAddress, provider)
  }

  async create({ pair, signer, initTick }: CreatePool) {
    const { fee, tickSpacing } = pair.feeTier
    const tick = initTick || 0
    const ts = tickSpacing ?? feeToTickSpacing(fee)

    const [programAuthority, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from(SEED)],
      this.program.programId
    )

    const [poolAddress, bump] = await pair.getAddressAndBump(this.program.programId)
    const { address: feeTierAddress } = await this.getFeeTierAddress(pair.feeTier)

    const tokenX = new Token(this.connection, pair.tokenX, TOKEN_PROGRAM_ID, signer)
    const tokenY = new Token(this.connection, pair.tokenY, TOKEN_PROGRAM_ID, signer)

    const tokenXReserve = await tokenX.createAccount(programAuthority)
    const tokenYReserve = await tokenY.createAccount(programAuthority)

    const bitmapKeypair = Keypair.generate()

    await this.program.rpc.createPool(bump, nonce, tick, fee, ts, {
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

  async getPool(pair: Pair) {
    const address = await pair.getAddress(this.program.programId)
    return (await this.program.account.pool.fetch(address)) as PoolStructure
  }

  public async onPoolChange(
    tokenX: PublicKey,
    tokenY: PublicKey,
    feeTier: FeeTier,
    fn: (poolStructure: PoolStructure) => void
  ) {
    const poolAddress = await new Pair(tokenX, tokenY, feeTier).getAddress(this.program.programId)

    this.program.account.pool
      .subscribe(poolAddress, 'singleGossip')
      .on('change', (poolStructure: PoolStructure) => {
        fn(poolStructure)
      })
  }

  async getFeeTierAddress(feeTier: FeeTier) {
    return await getFeeTierAddress(feeTier, this.program.programId)
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

  async getClosestTicks(pair: Pair, limit: number, maxRange?: number) {
    const state = await this.get(pair)
    const tickmap = await this.getTickmap(pair)
    const indexes = findClosestTicks(
      tickmap.bitmap,
      state.currentTickIndex,
      state.tickSpacing,
      limit,
      maxRange
    )

    return Promise.all(
      indexes.map(async (index) => {
        const { tickAddress } = await this.getTickAddress(pair, index)
        return (await this.program.account.tick.fetch(tickAddress)) as Tick
      })
    )
  }

  async getLiquidityOnTicks(pair: Pair) {
    const pool = await this.get(pair)

    const ticks = await this.getClosestTicks(pair, Infinity)

    return parseLiquidityOnTicks(ticks, pool)
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
    const positionPromises = indexes.map(async (i) => {
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
    const stateAddress = (await this.getStateAddress()).address
    const ts = tickSpacing ?? feeToTickSpacing(fee)

    return await this.program.instruction.createFeeTier(bump, fee, ts, {
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

    await signAndSend(new Transaction().add(ix), [payer], this.connection)
  }

  async createStateInstruction(admin: PublicKey, protocolFee: Decimal) {
    const { address, bump } = await this.getStateAddress()

    return this.program.instruction.createState(bump, protocolFee, {
      accounts: {
        state: address,
        admin,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    })
  }

  async createState(admin: Keypair, protocolFee: Decimal) {
    const ix = await this.createStateInstruction(admin.publicKey, protocolFee)
    await signAndSend(new Transaction().add(ix), [admin], this.connection)
  }

  async getStateAddress() {
    const [address, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(utils.bytes.utf8.encode(STATE_SEED))],
      this.program.programId
    )

    return {
      address,
      bump
    }
  }

  async getState() {
    const address = await (await this.getStateAddress()).address
    return (await this.program.account.state.fetch(address)) as State
  }

  async createTickInstruction(pair: Pair, index: number, payer: PublicKey) {
    const state = await this.get(pair)

    const { tickAddress, tickBump } = await this.getTickAddress(pair, index)
    const feeTierAddress = await pair.getFeeTierAddress(this.program.programId)
    return this.program.instruction.createTick(tickBump, feeTierAddress, index, {
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

  async createTicksFromRange(pair: Pair, payer: Keypair, start: number, stop: number) {
    const step = pair.feeTier.tickSpacing ?? feeToTickSpacing(pair.feeTier.fee)

    Promise.all(
      generateTicksArray(start, stop, step).map(async (tick) => {
        await this.createTick(pair, tick, payer)
      })
    )
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

  async initPositionInstruction(
    { pair, owner, userTokenX, userTokenY, lowerTick, upperTick, liquidityDelta }: InitPosition,
    assumeFirstPosition: boolean = false
  ) {
    const state = await this.get(pair)

    // maybe in the future index cloud be store at market
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTick)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTick)
    const { positionAddress, positionBump } = await this.getPositionAddress(
      owner,
      assumeFirstPosition ? 0 : (await this.getPositionList(owner)).head
    )
    const { positionListAddress } = await this.getPositionListAddress(owner)
    const poolAddress = await pair.getAddress(this.program.programId)
    const feeTierAddress = await pair.getFeeTierAddress(this.program.programId)

    return this.program.instruction.createPosition(
      positionBump,
      feeTierAddress,
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
    const { owner, pair, lowerTick, upperTick } = initPosition

    const [tickmap, pool] = await Promise.all([this.getTickmap(pair), this.get(pair)])

    const lowerExists = isInitialized(tickmap, lowerTick, pool.tickSpacing)
    const upperExists = isInitialized(tickmap, upperTick, pool.tickSpacing)

    const tx = new Transaction()

    if (!lowerExists) {
      tx.add(await this.createTickInstruction(pair, lowerTick, owner))
    }
    if (!upperExists) {
      tx.add(await this.createTickInstruction(pair, upperTick, owner))
    }

    const { positionListAddress } = await this.getPositionListAddress(owner)
    const account = await this.connection.getAccountInfo(positionListAddress)

    if (account === null) {
      tx.add(await this.createPositionListInstruction(owner))
      return tx.add(await this.initPositionInstruction(initPosition, true))
    }

    return tx.add(await this.initPositionInstruction(initPosition, false))
  }

  async initPosition(initPosition: InitPosition, signer: Keypair) {
    const tx = await this.initPositionTx(initPosition)
    await signAndSend(tx, [signer], this.connection)
  }

  async swap(swap: Swap, owner: Keypair, overridePriceLimit?: BN) {
    const tx = await this.swapTransaction(
      {
        owner: owner.publicKey,
        ...swap
      },
      overridePriceLimit
    )

    await signAndSend(tx, [owner], this.connection)
  }

  async swapTransaction(
    {
      pair,
      XtoY,
      amount,
      knownPrice,
      slippage,
      accountX,
      accountY,
      byAmountIn,
      owner
    }: SwapTransaction,
    overridePriceLimit?: BN
  ) {
    const pool = await this.get(pair)
    const tickmap = await this.getTickmap(pair)
    const feeTierAddress = await pair.getFeeTierAddress(this.program.programId)
    const { address: stateAddress } = await this.getStateAddress()

    const priceLimit =
      overridePriceLimit ?? calculatePriceAfterSlippage(knownPrice, slippage, !XtoY).v

    const indexesInDirection = findClosestTicks(
      tickmap.bitmap,
      pool.currentTickIndex,
      pool.tickSpacing,
      15,
      Infinity,
      XtoY ? 'down' : 'up'
    )
    const indexesInReverse = findClosestTicks(
      tickmap.bitmap,
      pool.currentTickIndex,
      pool.tickSpacing,
      3,
      Infinity,
      XtoY ? 'up' : 'down'
    )
    const remainingAccounts = await Promise.all(
      indexesInDirection.concat(indexesInReverse).map(async (index) => {
        const { tickAddress } = await this.getTickAddress(pair, index)
        return tickAddress
      })
    )

    const swapIx = await this.program.instruction.swap(
      feeTierAddress,
      XtoY,
      amount,
      byAmountIn,
      priceLimit,
      {
        remainingAccounts: remainingAccounts.map((pubkey) => {
          return { pubkey, isWritable: true, isSigner: false }
        }),
        accounts: {
          state: stateAddress,
          pool: await pair.getAddress(this.program.programId),
          tickmap: pool.tickmap,
          tokenX: pool.tokenX,
          tokenY: pool.tokenY,
          reserveX: pool.tokenXReserve,
          reserveY: pool.tokenYReserve,
          owner,
          accountX,
          accountY,
          programAuthority: pool.authority,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    )

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
    const { positionAddress } = await this.getPositionAddress(owner, index)
    const position = await this.getPosition(owner, index)
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(
      pair,
      position.lowerTickIndex
    )
    const { tickAddress: upperTickAddress } = await this.getTickAddress(
      pair,
      position.upperTickIndex
    )
    const feeTierAddress = await pair.getFeeTierAddress(this.program.programId)

    return (await this.program.instruction.claimFee(
      feeTierAddress,
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

  async withdrawProtocolFeeInstruction(
    pair: Pair,
    accountX: PublicKey,
    accountY: PublicKey,
    signer: PublicKey
  ) {
    const pool = await this.get(pair)
    const feeTierAddress = await pair.getFeeTierAddress(this.program.programId)
    const stateAddress = await (await this.getStateAddress()).address

    return (await this.program.instruction.withdrawProtocolFee({
      accounts: {
        state: stateAddress,
        pool: await pair.getAddress(this.program.programId),
        tokenX: pool.tokenX,
        tokenY: pool.tokenY,
        feeTier: feeTierAddress,
        reserveX: pool.tokenXReserve,
        reserveY: pool.tokenYReserve,
        accountX,
        accountY,
        admin: signer,
        programAuthority: pool.authority,
        tokenProgram: TOKEN_PROGRAM_ID
      }
    })) as TransactionInstruction
  }

  async withdrawProtocolFee(pair: Pair, accountX: PublicKey, accountY: PublicKey, signer: Keypair) {
    const ix = await this.withdrawProtocolFeeInstruction(pair, accountX, accountY, signer.publicKey)
    await signAndSend(new Transaction().add(ix), [signer], this.connection)
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
    const feeTierAddress = await pair.getFeeTierAddress(this.program.programId)

    return this.program.instruction.removePosition(
      feeTierAddress,
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
    index
  }: SecondsPerLiquidity) {
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTickIndex)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTickIndex)
    const poolAddress = await pair.getAddress(this.program.programId)
    const { positionAddress: positionAddress, positionBump: bump } = await this.getPositionAddress(
      owner,
      index
    )
    const feeTierAddress = await pair.getFeeTierAddress(this.program.programId)

    return this.program.instruction.updateSecondsPerLiquidity(
      feeTierAddress,
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

export interface Swap {
  pair: Pair
  XtoY: boolean
  amount: BN
  knownPrice: Decimal
  slippage: Decimal
  accountX: PublicKey
  accountY: PublicKey
  byAmountIn: boolean
}

export interface SwapTransaction extends Swap {
  owner: PublicKey
}

export interface SecondsPerLiquidity {
  pair: Pair
  owner: PublicKey
  lowerTickIndex: number
  upperTickIndex: number
  index: number
}
