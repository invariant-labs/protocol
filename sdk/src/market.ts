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
import {
  calculatePriceAfterSlippage,
  calculatePriceSqrt,
  findClosestTicks,
  getX,
  getY,
  isInitialized
} from './math'
import {
  feeToTickSpacing,
  getFeeTierAddress,
  getMaxTick,
  getMinTick,
  parseLiquidityOnTicks,
  SEED,
  simulateSwap,
  SimulateSwapInterface,
  SimulationResult
} from './utils'
import { Invariant, IDL } from './idl/invariant'
import { ComputeUnitsInstruction, DENOMINATOR, IWallet, Pair, signAndSend } from '.'
import { getMarketAddress, Network } from './network'
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes'

const POSITION_SEED = 'positionv1'
const TICK_SEED = 'tickv1'
const POSITION_LIST_SEED = 'positionlistv1'
const STATE_SEED = 'statev1'
const MAX_IX = 8
const TICKS_PER_IX = 1
export const FEE_TIER = 'feetierv1'
export const DEFAULT_PUBLIC_KEY = new PublicKey(0)

export class Market {
  public connection: Connection
  public wallet: IWallet
  public program: Program<Invariant>
  public stateAddress: PublicKey = PublicKey.default
  public programAuthority: PublicKey = PublicKey.default
  public network: Network

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

    this.network = network
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

  async createPool(createPool: CreatePool) {
    const { transaction, signers } = await this.createPoolTx(createPool)

    await signAndSend(transaction, [createPool.payer, ...signers], this.connection)
  }

  async createPoolTx({ pair, payer, initTick }: CreatePoolTx) {
    const payerPubkey = payer?.publicKey ?? this.wallet.publicKey
    const bitmapKeypair = Keypair.generate()
    const tokenXReserve = Keypair.generate()
    const tokenYReserve = Keypair.generate()
    const tick = initTick ?? 0

    const { address: stateAddress } = await this.getStateAddress()

    const [poolAddress] = await pair.getAddressAndBump(this.program.programId)
    const { address: feeTierAddress } = await this.getFeeTierAddress(pair.feeTier)

    const createIx = this.program.instruction.createPool(tick, {
      accounts: {
        state: stateAddress,
        pool: poolAddress,
        feeTier: feeTierAddress,
        tickmap: bitmapKeypair.publicKey,
        tokenX: pair.tokenX,
        tokenY: pair.tokenY,
        tokenXReserve: tokenXReserve.publicKey,
        tokenYReserve: tokenYReserve.publicKey,
        authority: this.programAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        payer: payerPubkey,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId
      }
    })

    const transaction = new Transaction({
      feePayer: payerPubkey
    })
      .add(
        SystemProgram.createAccount({
          fromPubkey: payerPubkey,
          newAccountPubkey: bitmapKeypair.publicKey,
          space: this.program.account.tickmap.size,
          lamports: await this.connection.getMinimumBalanceForRentExemption(
            this.program.account.tickmap.size
          ),
          programId: this.program.programId
        })
      )
      .add(createIx)

    return {
      transaction,
      signers: [bitmapKeypair, tokenXReserve, tokenYReserve]
    }
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

  public async onTickChange(pair: Pair, index: number, fn: (tick: Tick) => void) {
    const { tickAddress } = await this.getTickAddress(pair, index)

    this.program.account.tick
      .subscribe(tickAddress, 'singleGossip') // REVIEW use recent commitment + allow overwrite via props
      .on('change', (poolStructure: Tick) => {
        fn(poolStructure)
      })
  }

  public async unsubscribeTick(pair: Pair, index: number): Promise<void> {
    const { tickAddress } = await this.getTickAddress(pair, index)
    return await this.program.account.tick.unsubscribe(tickAddress)
  }

  public async onTickmapChange(tickmap: PublicKey, fn: (tickmap: Tickmap) => void) {
    this.program.account.tickmap
      .subscribe(tickmap, 'singleGossip') // REVIEW use recent commitment + allow overwrite via props
      .on('change', (tickmapStructure: Tickmap) => {
        fn(tickmapStructure)
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

  async getClosestTicks(pair: Pair, limit: number, maxRange?: number, oneWay?: 'up' | 'down') {
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

    const ticksArray = (
      await Promise.all(indexes.map(index => this.getTickAddress(pair, index)))
    ).map(a => a.tickAddress)
    return (await this.program.account.tick.fetchMultiple(ticksArray)) as Tick[]
  }

  async getAllTicks(pair: Pair) {
    const poolPublicKey = await pair.getAddress(this.program.programId)
    return (
      await this.program.account.tick.all([
        {
          memcmp: { bytes: bs58.encode(poolPublicKey.toBuffer()), offset: 8 }
        }
      ])
    ).map(a => a.account) as Tick[]
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

  async getPositionsFromIndexes(owner: PublicKey, indexes: number[]) {
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
    admin = admin ?? this.wallet.publicKey
    const { fee, tickSpacing } = feeTier
    const { address } = await this.getFeeTierAddress(feeTier)
    const ts = tickSpacing ?? feeToTickSpacing(fee)

    return this.program.instruction.createFeeTier(fee, ts, {
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

  // Admin function
  async createFeeTier(createFeeTier: CreateFeeTier, signer: Keypair) {
    const tx = await this.createFeeTierTransaction(createFeeTier)

    await signAndSend(tx, [signer], this.connection)
  }

  async createStateInstruction(admin?: PublicKey) {
    admin = admin ?? this.wallet.publicKey
    const { programAuthority, nonce } = await this.getProgramAuthority()
    const { address } = await this.getStateAddress()

    return this.program.instruction.createState(nonce, {
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

  async createState(admin: PublicKey, signer: Keypair) {
    const tx = await this.createStateTransaction(admin)

    await signAndSend(tx, [signer], this.connection)
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
    payer = payer ?? this.wallet.publicKey
    const state = await this.getPool(pair)
    const { tickAddress } = await this.getTickAddress(pair, index)

    return this.program.instruction.createTick(index, {
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

  async createTick(createTick: CreateTick, signer: Keypair) {
    const tx = await this.createTickTransaction(createTick)

    await signAndSend(tx, [signer], this.connection)
  }

  async createPositionListInstruction(owner?: PublicKey) {
    owner = owner ?? this.wallet.publicKey
    const { positionListAddress } = await this.getPositionListAddress(owner)

    return this.program.instruction.createPositionList({
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

  async createPositionList(owner: PublicKey, signer: Keypair) {
    const tx = await this.createPositionListTransaction(owner)

    await signAndSend(tx, [signer], this.connection)
  }

  async initPositionInstruction(
    { pair, owner, userTokenX, userTokenY, lowerTick, upperTick, liquidityDelta }: InitPosition,
    assumeFirstPosition: boolean = false
  ) {
    const state = await this.getPool(pair)
    owner = owner ?? this.wallet.publicKey

    const upperTickIndex = upperTick !== Infinity ? upperTick : getMaxTick(pair.tickSpacing)
    const lowerTickIndex = lowerTick !== -Infinity ? lowerTick : getMinTick(pair.tickSpacing)

    // maybe in the future index cloud be store at market
    const { tickAddress: lowerTickAddress } = await this.getTickAddress(pair, lowerTickIndex)
    const { tickAddress: upperTickAddress } = await this.getTickAddress(pair, upperTickIndex)
    const { positionAddress } = await this.getPositionAddress(
      owner,
      assumeFirstPosition ? 0 : (await this.getPositionList(owner)).head
    )
    const { positionListAddress } = await this.getPositionListAddress(owner)
    const poolAddress = await pair.getAddress(this.program.programId)

    return this.program.instruction.createPosition(lowerTickIndex, upperTickIndex, liquidityDelta, {
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
    })
  }

  async initPositionTx(initPosition: InitPosition) {
    const { pair, lowerTick, upperTick } = initPosition
    const payer = initPosition.owner ?? this.wallet.publicKey

    // undefined - tmp solution
    let lowerInstruction: TransactionInstruction | undefined
    let upperInstruction: TransactionInstruction | undefined
    let listInstruction: TransactionInstruction | undefined
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
    if (!lowerExists && lowerInstruction) {
      tx.add(lowerInstruction)
    }
    if (!upperExists && upperInstruction) {
      tx.add(upperInstruction)
    }
    if (!listExists && listInstruction) {
      tx.add(listInstruction)
    }

    return tx.add(positionInstruction)
  }

  async initPosition(initPosition: InitPosition, signer: Keypair) {
    const tx = await this.initPositionTx(initPosition)

    await signAndSend(tx, [signer], this.connection)
  }

  async initPoolAndPositionTx(
    {
      pair,
      owner,
      userTokenX,
      userTokenY,
      lowerTick,
      upperTick,
      liquidityDelta,
      initTick
    }: InitPoolAndPosition,
    payer?: Keypair
  ) {
    const payerPubkey = payer?.publicKey ?? this.wallet.publicKey
    const bitmapKeypair = Keypair.generate()
    const tokenXReserve = Keypair.generate()
    const tokenYReserve = Keypair.generate()
    const tick = initTick ?? 0

    const { address: stateAddress } = await this.getStateAddress()

    const [poolAddress] = await pair.getAddressAndBump(this.program.programId)
    const { address: feeTierAddress } = await this.getFeeTierAddress(pair.feeTier)

    const { positionListAddress } = await this.getPositionListAddress(payerPubkey)
    const { tickAddress } = await this.getTickAddress(pair, lowerTick)
    const { tickAddress: tickAddressUpper } = await this.getTickAddress(pair, upperTick)

    const listExists = (await this.connection.getAccountInfo(positionListAddress)) !== null
    const head = listExists ? (await this.getPositionList(payerPubkey)).head : 0

    const { positionAddress } = await this.getPositionAddress(payerPubkey, head)

    const transaction = new Transaction({
      feePayer: payerPubkey
    })
    if (this.network == Network.DEV || this.network == Network.LOCAL) {
      // REMOVE ME WHEN 1.9 HITS MAINNET
      transaction.add(ComputeUnitsInstruction(400000, payerPubkey))
    }

    transaction
      .add(
        SystemProgram.createAccount({
          fromPubkey: payerPubkey,
          newAccountPubkey: bitmapKeypair.publicKey,
          space: this.program.account.tickmap.size,
          lamports: await this.connection.getMinimumBalanceForRentExemption(
            this.program.account.tickmap.size
          ),
          programId: this.program.programId
        })
      )
      .add(
        this.program.instruction.createPool(tick, {
          accounts: {
            state: stateAddress,
            pool: poolAddress,
            feeTier: feeTierAddress,
            tickmap: bitmapKeypair.publicKey,
            tokenX: pair.tokenX,
            tokenY: pair.tokenY,
            tokenXReserve: tokenXReserve.publicKey,
            tokenYReserve: tokenYReserve.publicKey,
            authority: this.programAuthority,
            tokenProgram: TOKEN_PROGRAM_ID,
            payer: payerPubkey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId
          }
        })
      )
      .add(
        this.program.instruction.createTick(lowerTick, {
          accounts: {
            tick: tickAddress,
            pool: poolAddress,
            tickmap: bitmapKeypair.publicKey,
            payer: payerPubkey,
            tokenX: pair.tokenX,
            tokenY: pair.tokenY,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId
          }
        })
      )
      .add(
        this.program.instruction.createTick(upperTick, {
          accounts: {
            tick: tickAddressUpper,
            pool: poolAddress,
            tickmap: bitmapKeypair.publicKey,
            payer: payerPubkey,
            tokenX: pair.tokenX,
            tokenY: pair.tokenY,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId
          }
        })
      )
    if (!listExists) transaction.add(await this.createPositionListInstruction(payerPubkey))

    transaction.add(
      this.program.instruction.createPosition(lowerTick, upperTick, liquidityDelta, {
        accounts: {
          state: this.stateAddress,
          pool: poolAddress,
          positionList: positionListAddress,
          position: positionAddress,
          tickmap: bitmapKeypair.publicKey,
          owner: payerPubkey,
          payer: payerPubkey,
          lowerTick: tickAddress,
          upperTick: tickAddressUpper,
          tokenX: pair.tokenX,
          tokenY: pair.tokenY,
          accountX: userTokenX,
          accountY: userTokenY,
          reserveX: tokenXReserve.publicKey,
          reserveY: tokenYReserve.publicKey,
          programAuthority: this.programAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId
        }
      })
    )

    return {
      transaction,
      signers: [bitmapKeypair, tokenXReserve, tokenYReserve]
    }
  }

  async initPoolAndPosition(createPool: InitPoolAndPosition, signer: Keypair) {
    const { transaction, signers } = await this.initPoolAndPositionTx(createPool, signer)

    await signAndSend(transaction, [signer, ...signers], this.connection)
  }

  async swapInstruction(swap: Swap) {
    const {
      pair,
      xToY,
      amount,
      estimatedPriceAfterSwap,
      slippage,
      accountX,
      accountY,
      byAmountIn
    } = swap
    const owner = swap.owner ?? this.wallet.publicKey

    const [pool, tickmap, poolAddress] = await Promise.all([
      this.getPool(pair),
      this.getTickmap(pair),
      pair.getAddress(this.program.programId)
    ])

    const priceLimit = calculatePriceAfterSlippage(estimatedPriceAfterSwap, slippage, !xToY).v

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

    // trunk-ignore(eslint)
    const ra: Array<{ pubkey: PublicKey; isWritable: boolean; isSigner: boolean }> =
      remainingAccounts.map(pubkey => {
        return { pubkey, isWritable: true, isSigner: false }
      })

    const tx: Transaction = new Transaction()

    const swapIx = this.program.instruction.swap(xToY, amount, byAmountIn, priceLimit, {
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
    tx.add(swapIx)
    return tx
  }

  async swapTransactionSplit(swap: Swap) {
    const {
      pair,
      xToY,
      amount,
      estimatedPriceAfterSwap,
      slippage,
      accountX,
      accountY,
      byAmountIn
    } = swap
    const owner = swap.owner ?? this.wallet.publicKey

    const [pool, tickmap, poolAddress] = await Promise.all([
      this.getPool(pair),
      this.getTickmap(pair),
      pair.getAddress(this.program.programId)
    ])

    const priceLimit = calculatePriceAfterSlippage(estimatedPriceAfterSwap, slippage, !xToY).v

    const indexesInDirection = findClosestTicks(
      tickmap.bitmap,
      pool.currentTickIndex,
      pool.tickSpacing,
      8,
      Infinity,
      xToY ? 'down' : 'up'
    )

    const indexesInReverse = findClosestTicks(
      tickmap.bitmap,
      pool.currentTickIndex,
      pool.tickSpacing,
      1,
      Infinity,
      xToY ? 'up' : 'down'
    )
    const remainingAccounts = await Promise.all(
      indexesInDirection.concat(indexesInReverse).map(async index => {
        const { tickAddress } = await this.getTickAddress(pair, index)
        return tickAddress
      })
    )

    // trunk-ignore(eslint/@typescript-eslint/member-delimiter-style)
    const ra: Array<{ pubkey: PublicKey; isWritable: boolean; isSigner: boolean }> =
      remainingAccounts.map(pubkey => {
        return { pubkey, isWritable: true, isSigner: false }
      })

    const ticksArray: Tick[] = await this.getClosestTicks(
      pair,
      Infinity,
      undefined,
      xToY ? 'down' : 'up'
    )

    const ticks: Map<number, Tick> = new Map<number, Tick>()

    for (const tick of ticksArray) {
      ticks.set(tick.index, tick)
    }
    const poolData: PoolData = {
      currentTickIndex: pool.currentTickIndex,
      tickSpacing: pool.tickSpacing,
      liquidity: pool.liquidity,
      fee: pool.fee,
      sqrtPrice: pool.sqrtPrice
    }
    // simulate swap to get exact amount of tokens swapped between tick crosses
    const swapParameters: SimulateSwapInterface = {
      xToY: xToY,
      byAmountIn: byAmountIn,
      swapAmount: amount,
      priceLimit: { v: priceLimit },
      slippage: slippage,
      ticks: ticks,
      tickmap,
      pool: poolData
    }

    const simulationResult: SimulationResult = simulateSwap(swapParameters)
    const amountPerTick: BN[] = simulationResult.amountPerTick
    let sum: BN = new BN(0)
    for (const value of amountPerTick) {
      sum = sum.add(value)
    }

    if (!sum.eq(amount)) {
      throw new Error('Input amount and simulation amount sum are different')
    }

    if (amountPerTick.length > MAX_IX) {
      throw new Error('Instruction limit was exceeded')
    }

    const tx: Transaction = new Transaction()

    // this is for solana 1.9
    // const unitsIx = ComputeUnitsInstruction(COMPUTE_UNITS, owner)
    // tx.add(unitsIx)

    let amountIx: BN = new BN(0)
    for (let i = 0; i < amountPerTick.length; i++) {
      amountIx = amountIx.add(amountPerTick[i])

      if (
        ((i + 1) % TICKS_PER_IX === 0 || i === amountPerTick.length - 1) &&
        !amountPerTick[i].eqn(0)
      ) {
        const swapIx = this.program.instruction.swap(xToY, amountIx, byAmountIn, priceLimit, {
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
        tx.add(swapIx)
        amountIx = new BN(0)
      }
    }
    return tx
  }

  async swapTransaction(swap: Swap) {
    const ix = await this.swapInstruction(swap)
    return new Transaction().add(ix)
  }

  async swap(swap: Swap, signer: Keypair) {
    const tx = await this.swapTransaction(swap)

    await signAndSend(tx, [signer], this.connection)
  }

  async swapSplit(swap: Swap, signer: Keypair) {
    const tx = await this.swapTransactionSplit(swap)

    await signAndSend(tx, [signer], this.connection)
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
    const owner = claimFee.owner ?? this.wallet.publicKey

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

  async claimFee(claimFee: ClaimFee, signer: Keypair) {
    const tx = await this.claimFeeTransaction(claimFee)

    await signAndSend(tx, [signer], this.connection)
  }

  async withdrawProtocolFeeInstruction(withdrawProtocolFee: WithdrawProtocolFee) {
    const { pair, accountX, accountY } = withdrawProtocolFee
    const admin = withdrawProtocolFee.admin ?? this.wallet.publicKey

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

  // Admin function
  async withdrawProtocolFee(withdrawProtocolFee: WithdrawProtocolFee, signer: Keypair) {
    const tx = await this.withdrawProtocolFeeTransaction(withdrawProtocolFee)

    await signAndSend(tx, [signer], this.connection)
  }

  async removePositionInstruction(removePosition: RemovePosition): Promise<TransactionInstruction> {
    const { pair, index, userTokenX, userTokenY } = removePosition
    const owner = removePosition.owner ?? this.wallet.publicKey

    const positionList = await this.getPositionList(owner)
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

  async removePosition(removePosition: RemovePosition, signer: Keypair) {
    const tx = await this.removePositionTransaction(removePosition)

    await signAndSend(tx, [signer], this.connection)
  }

  async transferPositionOwnershipInstruction(
    transferPositionOwnership: TransferPositionOwnership
  ): Promise<TransactionInstruction> {
    const { index } = transferPositionOwnership
    const owner = transferPositionOwnership.owner ?? this.wallet.publicKey
    const recipient = transferPositionOwnership.recipient ?? this.wallet.publicKey

    const { positionListAddress: ownerList } = await this.getPositionListAddress(owner)
    const { positionListAddress: recipientList } = await this.getPositionListAddress(recipient)

    const ownerPositionList = await this.getPositionList(owner)
    const { positionAddress: removedPosition } = await this.getPositionAddress(owner, index)
    const { positionAddress: lastPosition } = await this.getPositionAddress(
      owner,
      ownerPositionList.head - 1
    )
    const { positionAddress: newPosition } = await this.getNewPositionAddress(recipient)

    return this.program.instruction.transferPositionOwnership(index, {
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

  async transferPositionOwnership(
    transferPositionOwnership: TransferPositionOwnership,
    signer: Keypair
  ) {
    const tx = await this.transferPositionOwnershipTransaction(transferPositionOwnership)

    await signAndSend(tx, [signer], this.connection)
  }

  async updateSecondsPerLiquidityInstruction(updateSecondsPerLiquidity: UpdateSecondsPerLiquidity) {
    const { pair, lowerTickIndex, upperTickIndex, index } = updateSecondsPerLiquidity
    const owner = updateSecondsPerLiquidity.owner ?? this.wallet.publicKey

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

  async updateSecondsPerLiquidity(
    updateSecondsPerLiquidity: UpdateSecondsPerLiquidity,
    signer: Keypair
  ) {
    const tx = await this.updateSecondsPerLiquidityTransaction(updateSecondsPerLiquidity)

    await signAndSend(tx, [signer], this.connection)
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

  async changeProtocolFeeInstruction(changeProtocolFee: ChangeProtocolFee) {
    let { pair, admin, protocolFee } = changeProtocolFee
    admin = admin ?? this.wallet.publicKey

    const { address: stateAddress } = await this.getStateAddress()
    const poolAddress = await pair.getAddress(this.program.programId)

    return this.program.instruction.changeProtocolFee(protocolFee, {
      accounts: {
        state: stateAddress,
        pool: poolAddress,
        tokenX: pair.tokenX,
        tokenY: pair.tokenY,
        admin,
        programAuthority: this.programAuthority
      }
    })
  }

  async changeProtocolFeeTransaction(changeProtocolFee: ChangeProtocolFee) {
    const ix = await this.changeProtocolFeeInstruction(changeProtocolFee)
    return new Transaction().add(ix)
  }

  async changeProtocolFee(changeProtocolFee: ChangeProtocolFee, signer: Keypair) {
    const tx = await this.changeProtocolFeeTransaction(changeProtocolFee)

    await signAndSend(tx, [signer], this.connection)
  }

  async changeFeeReceiverInstruction(changeFeeReceiver: ChangeFeeReceiver) {
    const { pair, feeReceiver } = changeFeeReceiver
    const adminPubkey = changeFeeReceiver.admin ?? this.wallet.publicKey
    const { address: stateAddress } = await this.getStateAddress()
    const poolAddress = await pair.getAddress(this.program.programId)

    return this.program.instruction.changeFeeReceiver({
      accounts: {
        state: stateAddress,
        pool: poolAddress,
        tokenX: pair.tokenX,
        tokenY: pair.tokenY,
        admin: adminPubkey,
        feeReceiver: feeReceiver,
        programAuthority: this.programAuthority
      }
    })
  }

  async changeFeeReceiverTransaction(changeFeeReceiver: ChangeFeeReceiver) {
    const ix = await this.changeFeeReceiverInstruction(changeFeeReceiver)

    return new Transaction().add(ix)
  }

  async changeFeeReceiver(changeFeeReceiver: ChangeFeeReceiver, signer: Keypair) {
    const tx = await this.changeFeeReceiverTransaction(changeFeeReceiver)

    await signAndSend(tx, [signer], this.connection)
  }

  async getWholeLiquidity(pair: Pair) {
    const poolPublicKey = await pair.getAddress(this.program.programId)
    const positions: Position[] = (
      await this.program.account.position.all([
        {
          memcmp: { bytes: bs58.encode(poolPublicKey.toBuffer()), offset: 40 }
        }
      ])
    ).map(a => a.account) as Position[]

    let liquidity = new BN(0)
    for (const position of positions) {
      liquidity = liquidity.add(position.liquidity.v)
    }

    return liquidity
  }

  async getGlobalFee(pair: Pair) {
    const pool = await this.getPool(pair)
    const { feeProtocolTokenX, feeProtocolTokenY, protocolFee } = pool

    const feeX = feeProtocolTokenX.mul(DENOMINATOR).div(protocolFee.v)
    const feeY = feeProtocolTokenY.mul(DENOMINATOR).div(protocolFee.v)

    return { feeX, feeY }
  }

  async getVolume(pair: Pair) {
    const pool = await this.getPool(pair)
    const { feeProtocolTokenX, feeProtocolTokenY, protocolFee, fee } = pool

    const feeDenominator = protocolFee.v.mul(fee.v).div(DENOMINATOR)

    const volumeX = feeProtocolTokenX.mul(DENOMINATOR).div(feeDenominator)
    const volumeY = feeProtocolTokenY.mul(DENOMINATOR).div(feeDenominator)

    return { volumeX, volumeY }
  }

  async getAllPools() {
    return (await this.program.account.pool.all([])).map(
      ({ account }) => account
    ) as PoolStructure[]
  }

  async getPairLiquidityValues(pair: Pair) {
    const pool = await this.getPool(pair)
    const poolPublicKey = await pair.getAddress(this.program.programId)
    const positions: Position[] = (
      await this.program.account.position.all([
        {
          memcmp: { bytes: bs58.encode(poolPublicKey.toBuffer()), offset: 40 }
        }
      ])
    ).map(({ account }) => account) as Position[]

    let liquidityX = new BN(0)
    let liquidityY = new BN(0)
    for (const position of positions) {
      let xVal, yVal

      try {
        xVal = getX(
          position.liquidity.v,
          calculatePriceSqrt(position.upperTickIndex).v,
          pool.sqrtPrice.v,
          calculatePriceSqrt(position.lowerTickIndex).v
        )
      } catch (error) {
        xVal = new BN(0)
      }

      try {
        yVal = getY(
          position.liquidity.v,
          calculatePriceSqrt(position.upperTickIndex).v,
          pool.sqrtPrice.v,
          calculatePriceSqrt(position.lowerTickIndex).v
        )
      } catch (error) {
        yVal = new BN(0)
      }

      liquidityX = liquidityX.add(xVal)
      liquidityY = liquidityY.add(yVal)
    }

    return { liquidityX, liquidityY }
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
  fee: Decimal
  protocolFee: Decimal
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

export interface PoolData {
  currentTickIndex: number
  tickSpacing: number
  liquidity: Decimal
  fee: Decimal
  sqrtPrice: Decimal
}
export interface Tickmap {
  bitmap: number[]
}
export interface TickPosition {
  byte: number
  bit: number
}
export interface PositionList {
  head: number
  bump: number
}
export interface Tick {
  pool: PublicKey
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
  NoMoreTicks = '0x132 ', // 6
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

export interface InitPoolAndPosition extends InitPosition {
  initTick?: number
}

export interface ModifyPosition {
  pair: Pair
  owner?: PublicKey
  userTokenX: PublicKey
  userTokenY: PublicKey
  index: number
  liquidityDelta: Decimal
}

export interface CreatePoolTx {
  pair: Pair
  payer?: Keypair
  initTick?: number
}
export interface CreatePool extends CreatePoolTx {
  payer: Keypair
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
  estimatedPriceAfterSwap: Decimal
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

export interface ChangeProtocolFee {
  pair: Pair
  admin?: PublicKey
  protocolFee: Decimal
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

export interface ChangeFeeReceiver {
  pair: Pair
  admin?: PublicKey
  feeReceiver: PublicKey
}
