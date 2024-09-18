import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { FeeTier, Market, Position, Tick } from '@invariant-labs/sdk/lib/market'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  Decimal,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/src/market'
import {
  feeToTickSpacing,
  FEE_TIERS,
  generateTicksArray,
  tou64,
  getTokenProgramAddress
} from '@invariant-labs/sdk/src/utils'
import BN from 'bn.js'
import { Pair, TICK_LIMIT, calculatePriceSqrt, LIQUIDITY_DENOMINATOR } from '@invariant-labs/sdk'
import { assert } from 'chai'
import { getBalance } from '@invariant-labs/sdk/lib/utils'

export async function assertThrowsAsync(fn: Promise<any>, word?: string) {
  try {
    await fn
  } catch (e: any) {
    let err
    if (e.code) {
      err = '0x' + e.code.toString(16)
    } else {
      err = e.toString()
    }
    if (word) {
      const regex = new RegExp(`${word}$`)
      if (!regex.test(err)) {
        console.log(err)
        throw new Error('Invalid Error message')
      }
    }
    return
  }
  throw new Error('Function did not throw error')
}

export const eqDecimal = (x: Decimal, y: Decimal) => {
  return x.v.eq(y.v)
}

export const createToken = async (
  connection: Connection,
  payer: Keypair,
  mintAuthority: Keypair,
  decimals: number = 6,
  freezeAuthority: PublicKey | null = null,
  isToken2022: boolean = false
): Promise<PublicKey> => {
  const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

  const mint = await createMint(
    connection,
    payer,
    mintAuthority.publicKey,
    freezeAuthority,
    decimals,
    undefined,
    undefined,
    programId
  )

  return mint
}

// do not compare bump
export const positionEquals = (a: Position, b: Position) => {
  return positionWithoutOwnerEquals(a, b) && a.owner.equals(b.owner)
}

export const positionWithoutOwnerEquals = (a: Position, b: Position) => {
  return (
    eqDecimal(a.feeGrowthInsideX, b.feeGrowthInsideX) &&
    eqDecimal(a.feeGrowthInsideY, b.feeGrowthInsideY) &&
    eqDecimal(a.liquidity, b.liquidity) &&
    a.lowerTickIndex === b.lowerTickIndex &&
    a.upperTickIndex === b.upperTickIndex &&
    a.pool.equals(b.pool) &&
    a.id.eq(b.id) &&
    a.lastSlot.eq(b.lastSlot) &&
    eqDecimal(a.secondsPerLiquidityInside, b.secondsPerLiquidityInside) &&
    eqDecimal(a.tokensOwedX, b.tokensOwedX) &&
    eqDecimal(a.tokensOwedY, b.tokensOwedY)
  )
}

export const createStandardFeeTiers = async (market: Market, payer: Keypair) => {
  await Promise.all(
    FEE_TIERS.map(async feeTier => {
      const createFeeTierVars: CreateFeeTier = {
        feeTier,
        admin: payer.publicKey
      }
      await market.createFeeTier(createFeeTierVars, payer)
    })
  )
}

export const createTokensAndPool = async (
  market: Market,
  connection: Connection,
  payer: Keypair,
  initTick: number = 0,
  feeTier: FeeTier = FEE_TIERS[0]
) => {
  const mintAuthority = Keypair.generate()

  const promiseResults = await Promise.all([
    createToken(connection, payer, mintAuthority),
    createToken(connection, payer, mintAuthority),
    connection.requestAirdrop(mintAuthority.publicKey, 1e9),
    connection.requestAirdrop(payer.publicKey, 1e9)
  ])

  const pair = new Pair(promiseResults[0], promiseResults[1], feeTier)
  const tokenX = pair.tokenX
  const tokenY = pair.tokenY
  const feeTierAccount = await connection.getAccountInfo(market.getFeeTierAddress(feeTier).address)
  if (feeTierAccount === null) {
    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: payer.publicKey
    }
    await market.createFeeTier(createFeeTierVars, payer)
  }

  const createPoolVars: CreatePool = {
    pair,
    payer: payer,
    initTick
  }
  await market.createPool(createPoolVars)

  return { tokenX, tokenY, pair, mintAuthority }
}

export const createUserWithTokens = async (
  pair: Pair,
  connection: Connection,
  mintAuthority: Keypair,
  mintAmount: BN = new BN(1e9)
) => {
  const owner = Keypair.generate()
  const tokenXProgram = TOKEN_PROGRAM_ID
  const tokenYProgram = TOKEN_PROGRAM_ID
  const [userAccountX, userAccountY] = await Promise.all([
    createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenX,
      owner.publicKey,
      undefined,
      tokenXProgram
    ),
    createAssociatedTokenAccount(
      connection,
      mintAuthority,
      pair.tokenY,
      owner.publicKey,
      undefined,
      tokenYProgram
    ),
    connection.requestAirdrop(owner.publicKey, 1e9)
  ])

  await Promise.all([
    mintTo(
      connection,
      mintAuthority,
      pair.tokenX,
      userAccountX,
      mintAuthority,
      mintAmount,
      [],
      undefined,
      tokenXProgram
    ),
    mintTo(
      connection,
      mintAuthority,
      pair.tokenY,
      userAccountY,
      mintAuthority,
      mintAmount,
      [],
      undefined,
      tokenYProgram
    )
  ])

  return { owner, userAccountX, userAccountY }
}

export const createPoolWithLiquidity = async (
  market: Market,
  connection: Connection,
  payer: Keypair,
  liquidity: Decimal = { v: new BN(10).pow(new BN(16)) },
  initialTick: number = 0,
  lowerTick: number = -1000,
  upperTick: number = 1000
) => {
  const { pair, mintAuthority } = await createTokensAndPool(market, connection, payer, initialTick)
  const { owner, userAccountX, userAccountY } = await createUserWithTokens(
    pair,
    connection,
    mintAuthority,
    new BN(10).pow(new BN(14))
  )

  const initPositionVars: InitPosition = {
    pair,
    owner: owner.publicKey,
    userTokenX: userAccountX,
    userTokenY: userAccountY,
    lowerTick,
    upperTick,
    liquidityDelta: liquidity,
    knownPrice: calculatePriceSqrt(initialTick),
    slippage: { v: new BN(0) }
  }
  await market.initPosition(initPositionVars, owner)

  return { pair, mintAuthority }
}

export const setInitialized = (bitmap: number[], index: number) => {
  bitmap[Math.floor((index + TICK_LIMIT) / 8)] |= 1 << (index + TICK_LIMIT) % 8
}

export const createPosition = async (
  connection: Connection,
  lowerTick: number,
  upperTick: number,
  liquidity: BN,
  owner: Keypair,
  ownerTokenXAccount: PublicKey,
  ownerTokenYAccount: PublicKey,
  pair: Pair,
  market: Market,
  wallet: Keypair,
  mintAuthority: Keypair
) => {
  const tokenXProgram = await getTokenProgramAddress(connection, pair.tokenX)
  const tokenYProgram = await getTokenProgramAddress(connection, pair.tokenY)

  const mintAmount = tou64(new BN(10).pow(new BN(18)))
  if ((await getBalance(connection, ownerTokenXAccount, tokenXProgram)).eq(new BN(0))) {
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenX,
      ownerTokenXAccount,
      mintAuthority,
      mintAmount,
      [mintAuthority],
      undefined,
      tokenXProgram
    )
  }
  if ((await getBalance(connection, ownerTokenYAccount, tokenYProgram)).eq(new BN(0))) {
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenY,
      ownerTokenXAccount,
      mintAuthority,
      mintAmount,
      [mintAuthority],
      undefined,
      tokenYProgram
    )
  }

  const initPositionVars: InitPosition = {
    pair,
    owner: owner.publicKey,
    userTokenX: ownerTokenXAccount,
    userTokenY: ownerTokenYAccount,
    lowerTick,
    upperTick,
    liquidityDelta: { v: liquidity },
    knownPrice: (await market.getPool(pair)).sqrtPrice,
    slippage: { v: new BN(0) }
  }
  await market.initPosition(initPositionVars, owner)
}

export const performSwap = async (
  pair: Pair,
  xToY: boolean,
  amount: BN,
  estimatedPriceAfterSwap: Decimal,
  slippage: Decimal,
  byAmountIn: boolean,
  connection: Connection,
  market: Market,
  mintAuthority: Keypair
) => {
  const swapper = Keypair.generate()
  await connection.requestAirdrop(swapper.publicKey, 1e12)
  const tokenXProgram = await getTokenProgramAddress(connection, pair.tokenX)
  const tokenYProgram = await getTokenProgramAddress(connection, pair.tokenY)

  const accountX = await createAssociatedTokenAccount(
    connection,
    swapper,
    pair.tokenX,
    swapper.publicKey,
    undefined,
    tokenXProgram
  )
  const accountY = await createAssociatedTokenAccount(
    connection,
    swapper,
    pair.tokenY,
    swapper.publicKey,
    undefined,
    tokenYProgram
  )

  if (xToY) {
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenX,
      accountX,
      mintAuthority,
      amount,
      [],
      undefined,
      tokenXProgram
    )
  } else {
    await mintTo(
      connection,
      mintAuthority,
      pair.tokenY,
      accountY,
      mintAuthority,
      amount,
      [],
      undefined,
      tokenYProgram
    )
  }

  const swapVars: Swap = {
    pair,
    owner: swapper.publicKey,
    xToY,
    amount,
    estimatedPriceAfterSwap,
    slippage,
    accountX,
    accountY,
    byAmountIn
  }
  await market.swap(swapVars, swapper)
}

export const createTicksFromRange = async (
  market: Market,
  { pair, payer }: CreateTick,
  start: number,
  stop: number,
  signer: Keypair
) => {
  const step = pair.feeTier.tickSpacing ?? feeToTickSpacing(pair.feeTier.fee)

  await Promise.all(
    generateTicksArray(start, stop, step).map(async index => {
      const createTickVars: CreateTick = {
        pair,
        index,
        payer
      }
      await market.createTick(createTickVars, signer)
    })
  )
}

export const initMarket = async (
  market: Market,
  pairs: Pair[],
  admin: Keypair,
  initTick?: number
) => {
  try {
    await market.createState(admin.publicKey, admin)
  } catch (e) {}

  const state = await market.getState()
  const { bump } = market.getStateAddress()
  const { programAuthority, nonce } = market.getProgramAuthority()
  assert.ok(state.admin.equals(admin.publicKey))
  assert.ok(state.authority.equals(programAuthority))
  assert.ok(state.nonce === nonce)
  assert.ok(state.bump === bump)

  for (const pair of pairs) {
    try {
      await market.getFeeTier(pair.feeTier)
    } catch (e) {
      const createFeeTierVars: CreateFeeTier = {
        feeTier: pair.feeTier,
        admin: admin.publicKey
      }
      await market.createFeeTier(createFeeTierVars, admin)
    }

    const createPoolVars: CreatePool = {
      pair,
      payer: admin,
      initTick: initTick
    }
    await market.createPool(createPoolVars)

    const createdPool = await market.getPool(pair)
    assert.ok(createdPool.tokenX.equals(pair.tokenX))
    assert.ok(createdPool.tokenY.equals(pair.tokenY))
    assert.ok(createdPool.fee.v.eq(pair.feeTier.fee))
    assert.equal(createdPool.tickSpacing, pair.feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(calculatePriceSqrt(initTick ?? 0).v))
    assert.ok(createdPool.currentTickIndex === (initTick ?? 0))
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length === TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v === 0))
  }
}

export const createTickArray = (size: number) => {
  const ticks: Tick[] = []
  for (let i = -(size / 2); i < size / 2; i++) {
    const tick: Tick = {
      pool: Keypair.generate().publicKey,
      index: i * 10,
      sign: true,
      liquidityChange: { v: new BN(Math.random() * 100000000).mul(LIQUIDITY_DENOMINATOR) },
      liquidityGross: { v: new BN(0) },
      sqrtPrice: { v: new BN(0) },
      feeGrowthOutsideX: { v: new BN(Math.random() * 100) },
      feeGrowthOutsideY: { v: new BN(Math.random() * 100) },
      secondsPerLiquidityOutside: { v: new BN(0) },
      bump: 0
    }
    ticks.push(tick)
  }

  return ticks
}

export const jsonArrayToTicks = (data: any[]) => {
  const ticks: Tick[] = []

  data.forEach(tick => {
    ticks.push({
      index: tick.index,
      sign: tick.sign,
      bump: tick.bump,
      liquidityChange: { v: new BN(tick.liquidityChange.v) },
      liquidityGross: { v: new BN(tick.liquidityGross.v) },
      sqrtPrice: { v: new BN(tick.sqrtPrice.v) },
      feeGrowthOutsideX: { v: new BN(tick.feeGrowthOutsideX.v) },
      feeGrowthOutsideY: { v: new BN(tick.feeGrowthOutsideY.v) },
      secondsPerLiquidityOutside: {
        v: new BN(tick.secondsPerLiquidityOutside.v)
      },
      pool: new PublicKey(tick.pool)
    })
  })

  return ticks
}

export const usdcUsdhPoolSnapshot = {
  ticksPreviousSnapshot: [
    {
      index: -13860,
      sign: true,
      bump: 251,
      liquidityChange: { v: '22964554844140308' },
      liquidityGross: { v: '22964554844140308' },
      sqrtPrice: { v: '500090922499000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264697' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -39,
      sign: true,
      bump: 253,
      liquidityChange: { v: '161429709979803343' },
      liquidityGross: { v: '161429709979803343' },
      sqrtPrice: { v: '998051997319000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264157' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -10,
      sign: true,
      bump: 255,
      liquidityChange: { v: '2000600039969988198' },
      liquidityGross: { v: '2000600039969988198' },
      sqrtPrice: { v: '999500149965000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -6,
      sign: true,
      bump: 255,
      liquidityChange: { v: '11699113914588497725' },
      liquidityGross: { v: '11699113914588497725' },
      sqrtPrice: { v: '999700059990000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264155' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -2,
      sign: true,
      bump: 255,
      liquidityChange: { v: '15563669416664063941' },
      liquidityGross: { v: '15563669416664063941' },
      sqrtPrice: { v: '999900009999000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264639' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 0,
      sign: true,
      bump: 253,
      liquidityChange: { v: '14214718904961000000' },
      liquidityGross: { v: '14214718904961000000' },
      sqrtPrice: { v: '1000000000000000000000000' },
      feeGrowthOutsideX: { v: '125342983384200995' },
      feeGrowthOutsideY: { v: '146260402736825943' },
      secondsPerLiquidityOutside: { v: '265443' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 2,
      sign: true,
      bump: 255,
      liquidityChange: { v: '280022883875000000' },
      liquidityGross: { v: '280022883875000000' },
      sqrtPrice: { v: '1000100000000000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '249352' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 3,
      sign: true,
      bump: 254,
      liquidityChange: { v: '141968198361735573' },
      liquidityGross: { v: '141968198361735573' },
      sqrtPrice: { v: '1000150003749000000000000' },
      feeGrowthOutsideX: { v: '124355143127782591' },
      feeGrowthOutsideY: { v: '146260402736825943' },
      secondsPerLiquidityOutside: { v: '265408' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 4,
      sign: true,
      bump: 254,
      liquidityChange: { v: '170571497404733572290' },
      liquidityGross: { v: '170571497404733572290' },
      sqrtPrice: { v: '1000200010000000000000000' },
      feeGrowthOutsideX: { v: '124252497947731995' },
      feeGrowthOutsideY: { v: '146260402736825943' },
      secondsPerLiquidityOutside: { v: '265406' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 5,
      sign: false,
      bump: 252,
      liquidityChange: { v: '170713465603095307863' },
      liquidityGross: { v: '170713465603095307863' },
      sqrtPrice: { v: '1000250018750000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 8,
      sign: false,
      bump: 255,
      liquidityChange: { v: '280022883875000000' },
      liquidityGross: { v: '280022883875000000' },
      sqrtPrice: { v: '1000400060004000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 9,
      sign: false,
      bump: 254,
      liquidityChange: { v: '14214718904961000000' },
      liquidityGross: { v: '14214718904961000000' },
      sqrtPrice: { v: '1000450078756000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 10,
      sign: false,
      bump: 253,
      liquidityChange: { v: '17564269456634052139' },
      liquidityGross: { v: '17564269456634052139' },
      sqrtPrice: { v: '1000500100010000000000000' },
      feeGrowthOutsideX: { v: '44518539706358012' },
      feeGrowthOutsideY: { v: '44584358715477974' },
      secondsPerLiquidityOutside: { v: '29240' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 14,
      sign: false,
      bump: 248,
      liquidityChange: { v: '9779105136174456388' },
      liquidityGross: { v: '9779105136174456388' },
      sqrtPrice: { v: '1000700210035000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 15,
      sign: false,
      bump: 255,
      liquidityChange: { v: '1920008778414041337' },
      liquidityGross: { v: '1920008778414041337' },
      sqrtPrice: { v: '1000750243793000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 47,
      sign: false,
      bump: 249,
      liquidityChange: { v: '161429709979803343' },
      liquidityGross: { v: '161429709979803343' },
      sqrtPrice: { v: '1002352645643000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 13868,
      sign: false,
      bump: 255,
      liquidityChange: { v: '22964554844140308' },
      liquidityGross: { v: '22964554844140308' },
      sqrtPrice: { v: '2000436350662000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    }
  ],
  ticksCurrentSnapshot: [
    {
      index: -13860,
      sign: true,
      bump: 251,
      liquidityChange: { v: '19068164041883237' },
      liquidityGross: { v: '19068164041883237' },
      sqrtPrice: { v: '500090922499000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264697' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -39,
      sign: true,
      bump: 253,
      liquidityChange: { v: '161429709979803343' },
      liquidityGross: { v: '161429709979803343' },
      sqrtPrice: { v: '998051997319000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264157' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -21,
      sign: true,
      bump: 254,
      liquidityChange: { v: '40357944858000000' },
      liquidityGross: { v: '40357944858000000' },
      sqrtPrice: { v: '998950603498000000000000' },
      feeGrowthOutsideX: { v: '125342983384200995' },
      feeGrowthOutsideY: { v: '146260402736825943' },
      secondsPerLiquidityOutside: { v: '265976' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -10,
      sign: true,
      bump: 255,
      liquidityChange: { v: '8353205782440988198' },
      liquidityGross: { v: '8353205782440988198' },
      sqrtPrice: { v: '999500149965000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -6,
      sign: true,
      bump: 255,
      liquidityChange: { v: '37131384992131673308' },
      liquidityGross: { v: '37131384992131673308' },
      sqrtPrice: { v: '999700059990000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264155' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -5,
      sign: true,
      bump: 255,
      liquidityChange: { v: '759269202163885743' },
      liquidityGross: { v: '759269202163885743' },
      sqrtPrice: { v: '999750043743000000000000' },
      feeGrowthOutsideX: { v: '125342983384200995' },
      feeGrowthOutsideY: { v: '146260402736825943' },
      secondsPerLiquidityOutside: { v: '266097' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -2,
      sign: true,
      bump: 255,
      liquidityChange: { v: '15563669416664063941' },
      liquidityGross: { v: '15563669416664063941' },
      sqrtPrice: { v: '999900009999000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '264639' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: -1,
      sign: true,
      bump: 255,
      liquidityChange: { v: '13210465448874091781' },
      liquidityGross: { v: '13210465448874091781' },
      sqrtPrice: { v: '999950003749000000000000' },
      feeGrowthOutsideX: { v: '125670055388951310' },
      feeGrowthOutsideY: { v: '146327805999865497' },
      secondsPerLiquidityOutside: { v: '266308' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 2,
      sign: true,
      bump: 255,
      liquidityChange: { v: '20363576185323580807' },
      liquidityGross: { v: '20363576185323580807' },
      sqrtPrice: { v: '1000100000000000000000000' },
      feeGrowthOutsideX: { v: '124251168448391763' },
      feeGrowthOutsideY: { v: '146254149906104013' },
      secondsPerLiquidityOutside: { v: '249352' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 4,
      sign: true,
      bump: 254,
      liquidityChange: { v: '136542678376659381762' },
      liquidityGross: { v: '136542678376659381762' },
      sqrtPrice: { v: '1000200010000000000000000' },
      feeGrowthOutsideX: { v: '124252497947731995' },
      feeGrowthOutsideY: { v: '146260402736825943' },
      secondsPerLiquidityOutside: { v: '265406' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 5,
      sign: false,
      bump: 252,
      liquidityChange: { v: '136542678376659381762' },
      liquidityGross: { v: '136542678376659381762' },
      sqrtPrice: { v: '1000250018750000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 7,
      sign: false,
      bump: 255,
      liquidityChange: { v: '20083553301448580807' },
      liquidityGross: { v: '20083553301448580807' },
      sqrtPrice: { v: '1000350043751000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 8,
      sign: false,
      bump: 255,
      liquidityChange: { v: '280022883875000000' },
      liquidityGross: { v: '280022883875000000' },
      sqrtPrice: { v: '1000400060004000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 9,
      sign: false,
      bump: 254,
      liquidityChange: { v: '13210465448874091781' },
      liquidityGross: { v: '13210465448874091781' },
      sqrtPrice: { v: '1000450078756000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 10,
      sign: false,
      bump: 253,
      liquidityChange: { v: '17564269456634052139' },
      liquidityGross: { v: '17564269456634052139' },
      sqrtPrice: { v: '1000500100010000000000000' },
      feeGrowthOutsideX: { v: '44518539706358012' },
      feeGrowthOutsideY: { v: '44584358715477974' },
      secondsPerLiquidityOutside: { v: '29240' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 13,
      sign: false,
      bump: 255,
      liquidityChange: { v: '759269202163885743' },
      liquidityGross: { v: '759269202163885743' },
      sqrtPrice: { v: '1000650178776000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 14,
      sign: false,
      bump: 248,
      liquidityChange: { v: '43349110313498673308' },
      liquidityGross: { v: '43349110313498673308' },
      sqrtPrice: { v: '1000700210035000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 19,
      sign: false,
      bump: 254,
      liquidityChange: { v: '69000725542000000' },
      liquidityGross: { v: '69000725542000000' },
      sqrtPrice: { v: '1000950403850000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 20,
      sign: false,
      bump: 253,
      liquidityChange: { v: '65879695562000000' },
      liquidityGross: { v: '65879695562000000' },
      sqrtPrice: { v: '1001000450120000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 29,
      sign: false,
      bump: 254,
      liquidityChange: { v: '40357944858000000' },
      liquidityGross: { v: '40357944858000000' },
      sqrtPrice: { v: '1001450979157000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 47,
      sign: false,
      bump: 249,
      liquidityChange: { v: '161429709979803343' },
      liquidityGross: { v: '161429709979803343' },
      sqrtPrice: { v: '1002352645643000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    },
    {
      index: 13868,
      sign: false,
      bump: 255,
      liquidityChange: { v: '19068164041883237' },
      liquidityGross: { v: '19068164041883237' },
      sqrtPrice: { v: '2000436350662000000000000' },
      feeGrowthOutsideX: { v: '0' },
      feeGrowthOutsideY: { v: '0' },
      secondsPerLiquidityOutside: { v: '0' },
      pool: 'FwiuNR91xfiUvWiBu4gieK4SFmh9qjMhYS9ebyYJ8PGj'
    }
  ],
  currentTickIndex: 4
}
