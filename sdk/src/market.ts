import { BN, Program, utils, Provider } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js'
import { calculatePriceAfterSlippage, findClosestTicks, isInitialized } from './math'
import {
  feeToTickSpacing,
  generateTicksArray,
  getFeeTierAddress,
  getMaxTick,
  getMinTick,
  parseLiquidityOnTicks,
  SEED,
  simulateSwap,
  SimulateSwapInterface,
  SimulationResult
} from './utils'
import { Amm, IDL } from './idl/amm'
import { ComputeUnitsInstruction, IWallet, Pair } from '.'
import { getMarketAddress, Network } from './network'

const POSITION_SEED = 'positionv1'
const TICK_SEED = 'tickv1'
const POSITION_LIST_SEED = 'positionlistv1'
const STATE_SEED = 'statev1'
const MAX_IX = 4
const TICKS_PER_IX = 1
export const FEE_TIER = 'feetierv1'
export const DEFAULT_PUBLIC_KEY = new PublicKey(0)

export class Market {
  public connection: Connection
  public wallet: IWallet
  public program: Program<Amm>
  public stateAddress: PublicKey = PublicKey.default
  public programAuthority: PublicKey = PublicKey.default

  private constructor(
    network: Network,
    wallet: IWallet,
    connection: Connection,
    programId?: PublicKey
  ) {
    this.connection = connection
    this.wallet = wallet
    const programAddress = new PublicKey(getMarketAddress(network))
    const provider = new Provider(connection, wallet, Provider.defaultOptions())

    this.program = new Program(IDL, programAddress, provider)
  }

  public static async build(
    network: Network,
    wallet: IWallet,
    connection: Connection,
    programId?: PublicKey
  ): Promise<Market> {
    const instance = new Market(network, wallet, connection, programId)
    instance.stateAddress = (await instance.getStateAddress()).address
    instance.programAuthority = (await instance.getProgramAuthority()).programAuthority

    return instance
  }

  async createPool({ pair, payer, initTick, protocolFee, tokenX, tokenY }: CreatePool) {
    const bitmapKeypair = Keypair.generate()
    const tick = initTick || 0

    const { address: stateAddress } = await this.getStateAddress()

    const [poolAddress, bump] = await pair.getAddressAndBump(this.program.programId)
    const { address: feeTierAddress } = await this.getFeeTierAddress(pair.feeTier)

    const tokenXReserve = await tokenX.createAccount(this.programAuthority)
    const tokenYReserve = await tokenY.createAccount(this.programAuthority)

    return await this.program.rpc.createPool(bump, tick, protocolFee, {
      accounts: {
        state: stateAddress,
        pool: poolAddress,
        feeTier: feeTierAddress,
        tickmap: bitmapKeypair.publicKey,
        tokenX: tokenX.publicKey,
        tokenY: tokenY.publicKey,
        tokenXReserve,
        tokenYReserve,
        payer: payer.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      },
      signers: [payer, bitmapKeypair],
      instructions: [await this.program.account.tickmap.createInstruction(bitmapKeypair)]
    })
  }

  async getProgramAuthority() {
    const [programAuthority, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from(SEED)],
      this.program.programId
    )

    return {
      programAuthority,
      nonce
    }
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
      .subscribe(poolAddress, 'singleGossip') // REVIEW use recent commitment + allow overwrite via props
      .on('change', (poolStructure: PoolStructure) => {
        fn(poolStructure)
      })
  }

  async getFeeTierAddress(feeTier: FeeTier) {
    return await getFeeTierAddress(feeTier, this.program.programId)
  }

  async getTickmap(pair: Pair) {
    const state = await this.getPool(pair)
    const tickmap = (await this.program.account.tickmap.fetch(state.tickmap)) as Tickmap
    return tickmap
  }

  async isInitialized(pair: Pair, index: number) {
    const state = await this.getPool(pair)
    const tickmap = await this.getTickmap(pair)
    return isInitialized(tickmap, index, state.tickSpacing)
  }

  async getTick(pair: Pair, index: number) {
    const { tickAddress } = await this.getTickAddress(pair, index)
    return (await this.program.account.tick.fetch(tickAddress)) as Tick
  }

  async getClosestTicks(
    pair: Pair,
    limit: number,
    maxRange?: number,
    oneWay: 'up' | 'down' | undefined = undefined
  ) {
    const state = await this.getPool(pair)
    const tickmap = await this.getTickmap(pair)
    const indexes = findClosestTicks(
      tickmap.bitmap,
      state.currentTickIndex,
      state.tickSpacing,
      limit,
      maxRange,
      oneWay
    )

    return Promise.all(
      indexes.map(async index => {
        const { tickAddress } = await this.getTickAddress(pair, index)
        return (await this.program.account.tick.fetch(tickAddress)) as Tick
      })
    )
  }

  async getLiquidityOnTicks(pair: Pair) {
    const pool = await this.getPool(pair)
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
    const positionPromises = indexes.map(async i => {
      return await this.getPosition(owner, i)
    })
    return await Promise.all(positionPromises)
  }

  async getPositionsFromRange(owner: PublicKey, lowerIndex: number, upperIndex: number) {
    try {
      await this.getPositionList(owner)
      return await this.getPositionsFromIndexes(
        owner,
        Array.from({ length: upperIndex - lowerIndex + 1 }, (_, i) => i + lowerIndex)
      )
    } catch (e) {
      return []
    }
  }

  async getTickAddress(pair: Pair, index: number) {
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
    return await this.getPositionAddress(owner, positionList.head)
  }

  async createFeeTierInstruction({ feeTier, admin }: CreateFeeTier) {
    admin = admin || this.wallet.publicKey
    const { fee, tickSpacing } = feeTier
    const { address, bump } = await this.getFeeTierAddress(feeTier)
    const ts = tickSpacing ?? feeToTickSpacing(fee)

    return this.program.instruction.createFeeTier(bump, fee, ts, {
      accounts: {
        state: this.stateAddress,
        feeTier: address,
        admin,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    })
  }

  async createFeeTierTransaction(createFeeTier: CreateFeeTier) {
    const ix = await this.createFeeTierInstruction(createFeeTier)
    return new Transaction().add(ix)
  }

  async createStateInstruction(admin?: PublicKey) {
    admin = admin || this.wallet.publicKey
    const { programAuthority, nonce } = await this.getProgramAuthority()
    const { address, bump } = await this.getStateAddress()

    return this.program.instruction.createState(bump, nonce, {
      accounts: {
        state: address,
        admin,
        programAuthority: programAuthority,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    })
  }

  async createStateTransaction(admin?: PublicKey) {
    const ix = await this.createStateInstruction(admin)
    return new Transaction().add(ix)
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
    const address = (await this.getStateAddress()).address
    return (await this.program.account.state.fetch(address)) as State
  }

  async createTickInstruction({ pair, index, payer }: CreateTick) {
    payer = payer || this.wallet.publicKey
    const state = await this.getPool(pair)
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
    })
  }

  async createTickTransaction(createTick: CreateTick) {
    const ix = await this.createTickInstruction(createTick)
    return new Transaction().add(ix)
  }

  async createPositionListInstruction(owner?: PublicKey) {
    owner = owner || this.wallet.publicKey
    const { positionListAddress, positionListBump } = await this.getPositionListAddress(owner)

    return this.program.instruction.createPositionList(positionListBump, {
      accounts: {
        positionList: positionListAddress,
        owner,
        signer: owner,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    })
  }

  async createPositionListTransaction(owner?: PublicKey) {
    const ix = await this.createPositionListInstruction(owner)
    return new Transaction().add(ix)
  }

  async initPositionInstruction(
    { pair, owner, userTokenX, userTokenY, lowerTick, upperTick, liquidityDelta }: InitPosition,
    assumeFirstPosition: boolean = false
  ) {
    const state = await this.getPool(pair)

    const upperTickIndex = upperTick != Infinity ? upperTick : getMaxTick(pair.tickSpacing)
    const lowerTickIndex = lowerTick != -Infinity ? lowerTick : getMinTick(pair.tickSpacing)

    // maybe in the future index cloud be store at market
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTickIndex)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTickIndex)
    const { positionAddress, positionBump } = await this.getPositionAddress(
      owner,
      assumeFirstPosition ? 0 : (await this.getPositionList(owner)).head
    )
    const { positionListAddress } = await this.getPositionListAddress(owner)
    const poolAddress = await pair.getAddress(this.program.programId)

    return this.program.instruction.createPosition(
      positionBump,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      {
        accounts: {
          state: this.stateAddress,
          pool: poolAddress,
          positionList: positionListAddress,
          position: positionAddress,
          tickmap: state.tickmap,
          owner,
          payer: owner,
          lowerTick: lowerTickAddress,
          upperTick: upperTickAddress,
          tokenX: pair.tokenX,
          tokenY: pair.tokenY,
          accountX: userTokenX,
          accountY: userTokenY,
          reserveX: state.tokenXReserve,
          reserveY: state.tokenYReserve,
          programAuthority: this.programAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId
        }
      }
    )
  }

  async initPositionTx(initPosition: InitPosition) {
    const { pair, lowerTick, upperTick } = initPosition
    const payer = initPosition.owner || this.wallet.publicKey
    const [tickmap, pool] = await Promise.all([this.getTickmap(pair), this.getPool(pair)])

    let lowerInstruction: TransactionInstruction
    let upperInstruction: TransactionInstruction
    let listInstruction: TransactionInstruction
    let positionInstruction: TransactionInstruction
    const tx = new Transaction()

    let lowerExists = true
    try {
      await this.getTick(pair, lowerTick)
    } catch (e) {
      lowerExists = false
      lowerInstruction = await this.createTickInstruction({ pair, index: lowerTick, payer })
    }

    let upperExists = true
    try {
      await this.getTick(pair, upperTick)
    } catch (e) {
      upperExists = false
      upperInstruction = await this.createTickInstruction({ pair, index: upperTick, payer })
    }

    const { positionListAddress } = await this.getPositionListAddress(payer)
    const account = await this.connection.getAccountInfo(positionListAddress)

    let listExists = true
    if (account === null) {
      listExists = false
      listInstruction = await this.createPositionListInstruction(payer)
      positionInstruction = await this.initPositionInstruction(initPosition, true)
    } else {
      positionInstruction = await this.initPositionInstruction(initPosition, false)
    }

    if (!lowerExists && !upperExists && listExists) {
      tx.add(ComputeUnitsInstruction(400000, payer))
    }
    if (!lowerExists) {
      tx.add(lowerInstruction)
    }
    if (!upperExists) {
      tx.add(upperInstruction)
    }
    if (!listExists) {
      tx.add(listInstruction)
    }

    return tx.add(positionInstruction)
  }

  async swapInstruction(swap: Swap, overridePriceLimit?: BN) {
    const { pair, xToY, amount, knownPrice, slippage, accountX, accountY, byAmountIn } = swap
    const owner = swap.owner || this.wallet.publicKey

    const [pool, tickmap, feeTierAddress] = await Promise.all([
      this.getPool(pair),
      this.getTickmap(pair),
      pair.getAddress(this.program.programId)
    ])

    const priceLimit =
      overridePriceLimit ?? calculatePriceAfterSlippage(knownPrice, slippage, !xToY).v

    const indexesInDirection = findClosestTicks(
      tickmap.bitmap,
      pool.currentTickIndex,
      pool.tickSpacing,
      10,
      Infinity,
      xToY ? 'down' : 'up'
    )

    const indexesInReverse = findClosestTicks(
      tickmap.bitmap,
      pool.currentTickIndex,
      pool.tickSpacing,
      3,
      Infinity,
      xToY ? 'up' : 'down'
    )
    const remainingAccounts = await Promise.all(
      indexesInDirection.concat(indexesInReverse).map(async index => {
        const { tickAddress } = await this.getTickAddress(pair, index)
        return tickAddress
      })
    )

    const ra: Array<{ pubkey: PublicKey; isWritable: boolean; isSigner: boolean }> =
      remainingAccounts.map(pubkey => {
        return { pubkey, isWritable: true, isSigner: false }
      })

    let ticksArray: Tick[] = await this.getClosestTicks(
      pair,
      Infinity,
      undefined,
      xToY ? 'down' : 'up'
    )

    let ticks: Map<number, Tick> = new Map<number, Tick>()

    for (var tick of ticksArray) {
      ticks.set(tick.index, tick)
    }

    //simulate swap to get exact amount of tokens swaped between tick croses
    const swapParameters: SimulateSwapInterface = {
      xToY: xToY,
      byAmountIn: byAmountIn,
      swapAmount: amount,
      currentPrice: pool.sqrtPrice,
      slippage: slippage,
      ticks: ticks,
      tickmap,
      pool: pool,
      market: this,
      pair: pair
    }
    let simulationResult: SimulationResult = simulateSwap(swapParameters)
    let amountPerTick: BN[] = simulationResult.amountPerTick
    let sum: BN = new BN(0)
    for (var value of amountPerTick) {
      sum = sum.add(value)
    }

    if (!sum.eq(amount)) {
      throw new Error('Input amount and simulation amount sum are different')
    }

    if (amountPerTick.length > MAX_IX) {
      throw new Error('Instruction limit was exceeded')
    }

    const poolAddress = await pair.getAddress(this.program.programId)

    return this.program.instruction.swap(xToY, amount, byAmountIn, priceLimit, {
      remainingAccounts: ra,
      accounts: {
        state: this.stateAddress,
        pool: poolAddress,
        tickmap: pool.tickmap,
        tokenX: pool.tokenX,
        tokenY: pool.tokenY,
        reserveX: pool.tokenXReserve,
        reserveY: pool.tokenYReserve,
        owner,
        accountX,
        accountY,
        programAuthority: this.programAuthority,
        tokenProgram: TOKEN_PROGRAM_ID
      }
    })
  }

  async swapTransaction(swap: Swap, overridePriceLimit?: BN) {
    const ix = await this.swapInstruction(swap, overridePriceLimit)
    return new Transaction().add(ix)
  }

  async getReserveBalances(pair: Pair, tokenX: Token, tokenY: Token) {
    const state = await this.getPool(pair)

    const accounts = await Promise.all([
      tokenX.getAccountInfo(state.tokenXReserve),
      tokenY.getAccountInfo(state.tokenYReserve)
    ])

    return { x: accounts[0].amount, y: accounts[1].amount }
  }

  async claimFeeInstruction(claimFee: ClaimFee) {
    const { pair, userTokenX, userTokenY, index } = claimFee
    const owner = claimFee.owner || this.wallet.publicKey

    const state = await this.getPool(pair)
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

    return this.program.instruction.claimFee(
      index,
      position.lowerTickIndex,
      position.upperTickIndex,
      {
        accounts: {
          state: this.stateAddress,
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
          programAuthority: this.programAuthority,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    )
  }

  async claimFeeTransaction(claimFee: ClaimFee) {
    const ix = await this.claimFeeInstruction(claimFee)
    return new Transaction().add(ix)
  }

  async withdrawProtocolFeeInstruction(withdrawProtocolFee: WithdrawProtocolFee) {
    const { pair, accountX, accountY } = withdrawProtocolFee
    const admin = withdrawProtocolFee.admin || this.wallet.publicKey

    const pool = await this.getPool(pair)

    return this.program.instruction.withdrawProtocolFee({
      accounts: {
        state: this.stateAddress,
        pool: await pair.getAddress(this.program.programId),
        tokenX: pool.tokenX,
        tokenY: pool.tokenY,
        reserveX: pool.tokenXReserve,
        reserveY: pool.tokenYReserve,
        accountX,
        accountY,
        authority: admin,
        programAuthority: this.programAuthority,
        tokenProgram: TOKEN_PROGRAM_ID
      }
    })
  }

  async withdrawProtocolFeeTransaction(withdrawProtocolFee: WithdrawProtocolFee) {
    const ix = await this.withdrawProtocolFeeInstruction(withdrawProtocolFee)
    return new Transaction().add(ix)
  }

  async removePositionInstruction(removePosition: RemovePosition): Promise<TransactionInstruction> {
    const { pair, index, userTokenX, userTokenY } = removePosition
    const owner = removePosition.owner || this.wallet.publicKey

    const positionList = await this.getPositionList(removePosition.owner)
    const { positionListAddress } = await this.getPositionListAddress(owner)
    const { positionAddress: removedPositionAddress } = await this.getPositionAddress(owner, index)
    const { positionAddress: lastPositionAddress } = await this.getPositionAddress(
      owner,
      positionList.head - 1
    )

    const state = await this.getPool(pair)
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
          state: this.stateAddress,
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
          programAuthority: this.programAuthority,
          tokenProgram: TOKEN_PROGRAM_ID
        }
      }
    )
  }

  async removePositionTransaction(removePosition: RemovePosition) {
    const ix = await this.removePositionInstruction(removePosition)
    return new Transaction().add(ix)
  }

  async transferPositionOwnershipInstruction(
    transferPositionOwnership: TransferPositionOwnership
  ): Promise<TransactionInstruction> {
    const { index } = transferPositionOwnership
    const owner = transferPositionOwnership.owner || this.wallet.publicKey
    const recipient = transferPositionOwnership.recipient || this.wallet.publicKey

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
    })
  }

  async transferPositionOwnershipTransaction(transferPositionOwnership: TransferPositionOwnership) {
    const ix = await this.transferPositionOwnershipInstruction(transferPositionOwnership)
    return new Transaction().add(ix)
  }

  async updateSecondsPerLiquidityInstruction(updateSecondsPerLiquidity: UpdateSecondsPerLiquidity) {
    const { pair, lowerTickIndex, upperTickIndex, index } = updateSecondsPerLiquidity
    const owner = updateSecondsPerLiquidity.owner || this.wallet.publicKey

    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTickIndex)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTickIndex)
    const poolAddress = await pair.getAddress(this.program.programId)
    const { positionAddress } = await this.getPositionAddress(owner, index)

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
    )
  }

  async updateSecondsPerLiquidityTransaction(updateSecondsPerLiquidity: UpdateSecondsPerLiquidity) {
    const ix = await this.updateSecondsPerLiquidityInstruction(updateSecondsPerLiquidity)
    return new Transaction().add(ix)
  }

  async initializeOracle({ pair, payer }: InitializeOracle) {
    const oracleKeypair = Keypair.generate()
    const poolAddress = await pair.getAddress(this.program.programId)

    return await this.program.rpc.initializeOracle({
      accounts: {
        pool: poolAddress,
        oracle: oracleKeypair.publicKey,
        tokenX: pair.tokenX,
        tokenY: pair.tokenY,
        payer: payer.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      },
      signers: [payer, oracleKeypair],
      instructions: [await this.program.account.oracle.createInstruction(oracleKeypair)]
    })
  }

  async getOracle(pair: Pair) {
    const pool = await this.getPool(pair)
    return await this.program.account.oracle.fetch(pool.oracleAddress)
  }
}

export interface Decimal {
  v: BN
}

export interface FeeGrowth {
  v: BN
}

export interface State {
  admin: PublicKey
  nonce: number
  authority: PublicKey
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
  positionIterator: BN
  tickSpacing: number
  fee: Decimal,
  protocolFee: Decimal,
  liquidity: Decimal
  sqrtPrice: Decimal
  currentTickIndex: number
  tickmap: PublicKey
  feeGrowthGlobalX: FeeGrowth
  feeGrowthGlobalY: FeeGrowth
  feeProtocolTokenX: BN
  feeProtocolTokenY: BN
  secondsPerLiquidityGlobal: Decimal
  startTimestamp: BN
  lastTimestamp: BN
  feeReceiver: PublicKey
  oracleAddress: PublicKey
  oracleInitialized: boolean
  bump: number
}

export interface Tickmap {
  bitmap: number[]
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
  lastSlot: BN
  tokensOwedX: Decimal
  tokensOwedY: Decimal
  bump: number
}
export interface FeeTier {
  fee: BN
  tickSpacing?: number
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
  owner?: PublicKey
  userTokenX: PublicKey
  userTokenY: PublicKey
  lowerTick: number
  upperTick: number
  liquidityDelta: Decimal
}

export interface ModifyPosition {
  pair: Pair
  owner?: PublicKey
  userTokenX: PublicKey
  userTokenY: PublicKey
  index: number
  liquidityDelta: Decimal
}

export interface CreatePool {
  pair: Pair
  payer: Keypair
  initTick?: number
  protocolFee: Decimal
  tokenX: Token
  tokenY: Token
}
export interface ClaimFee {
  pair: Pair
  owner?: PublicKey
  userTokenX: PublicKey
  userTokenY: PublicKey
  index: number
}
export interface Swap {
  pair: Pair
  owner?: PublicKey
  xToY: boolean
  amount: BN
  knownPrice: Decimal
  slippage: Decimal
  accountX: PublicKey
  accountY: PublicKey
  byAmountIn: boolean
}
export interface UpdateSecondsPerLiquidity {
  pair: Pair
  owner?: PublicKey
  lowerTickIndex: number
  upperTickIndex: number
  index: number
}
export interface CreateFeeTier {
  feeTier: FeeTier
  admin?: PublicKey
}
export interface CreateTick {
  pair: Pair
  index: number
  payer?: PublicKey
}
export interface WithdrawProtocolFee {
  pair: Pair
  accountX: PublicKey
  accountY: PublicKey
  admin?: PublicKey
}
export interface RemovePosition {
  pair: Pair
  owner?: PublicKey
  index: number
  userTokenX: PublicKey
  userTokenY: PublicKey
}
export interface TransferPositionOwnership {
  owner?: PublicKey
  recipient?: PublicKey
  index: number
}

export interface InitializeOracle {
  pair: Pair
  payer: Keypair
}
