import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { TokenInstructions } from '@project-serum/serum'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
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
  tou64
} from '@invariant-labs/sdk/src/utils'
import BN from 'bn.js'
import { Pair, TICK_LIMIT, calculatePriceSqrt } from '@invariant-labs/sdk'
import { assert } from 'chai'
import { LIQUIDITY_DENOMINATOR } from '@invariant-labs/sdk'

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
  decimals = 6
) => {
  const token = await Token.createMint(
    connection,
    payer,
    mintAuthority.publicKey,
    null,
    decimals,
    TokenInstructions.TOKEN_PROGRAM_ID
  )
  return token
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

  const pair = new Pair(promiseResults[0].publicKey, promiseResults[1].publicKey, feeTier)
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, payer)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, payer)
  const feeTierAccount = await connection.getAccountInfo(
    (
      await market.getFeeTierAddress(feeTier)
    ).address
  )
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
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, mintAuthority)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, mintAuthority)

  const owner = Keypair.generate()

  const [userAccountX, userAccountY] = await Promise.all([
    tokenX.createAccount(owner.publicKey),
    tokenY.createAccount(owner.publicKey),
    connection.requestAirdrop(owner.publicKey, 1e9)
  ])

  await Promise.all([
    tokenX.mintTo(userAccountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount)),
    tokenY.mintTo(userAccountY, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))
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
  lowerTick: number,
  upperTick: number,
  liquidity: BN,
  owner: Keypair,
  ownerTokenXAccount: PublicKey,
  ownerTokenYAccount: PublicKey,
  tokenX: Token,
  tokenY: Token,
  pair: Pair,
  market: Market,
  wallet: Keypair,
  mintAuthority: Keypair
) => {
  const mintAmount = tou64(new BN(10).pow(new BN(18)))
  if ((await tokenX.getAccountInfo(ownerTokenXAccount)).amount.eq(new BN(0))) {
    await tokenX.mintTo(ownerTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
  }
  if ((await tokenY.getAccountInfo(ownerTokenYAccount)).amount.eq(new BN(0))) {
    await tokenY.mintTo(ownerTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
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
  tokenX: Token,
  tokenY: Token,
  mintAuthority: Keypair
) => {
  const swapper = Keypair.generate()
  await connection.requestAirdrop(swapper.publicKey, 1e12)

  const accountX = await tokenX.createAccount(swapper.publicKey)
  const accountY = await tokenY.createAccount(swapper.publicKey)

  if (xToY) {
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))
  } else {
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(amount))
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

export const initEverything = async (
  market: Market,
  pairs: Pair[],
  admin: Keypair,
  initTick?: number
) => {
  await market.createState(admin.publicKey, admin)

  const state = await market.getState()
  const { bump } = await market.getStateAddress()
  const { programAuthority, nonce } = await market.getProgramAuthority()
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

export const dataApy = {
  AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX: {
    feeTier: { fee: '3000000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -23550,
        sign: true,
        bump: 249,
        liquidityChange: { v: '203156374298672741' },
        liquidityGross: { v: '203156374298672741' },
        sqrtPrice: { v: '308066032252000000000000' },
        feeGrowthOutsideX: { v: '1277793787671468731427' },
        feeGrowthOutsideY: { v: '82960029201305385505' },
        secondsPerLiquidityOutside: { v: '6268281' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -23040,
        sign: true,
        bump: 255,
        liquidityChange: { v: '194587952836497448' },
        liquidityGross: { v: '194587952836497448' },
        sqrtPrice: { v: '316022329954000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -13560,
        sign: false,
        bump: 255,
        liquidityChange: { v: '203156374298672741' },
        liquidityGross: { v: '203156374298672741' },
        sqrtPrice: { v: '507648448211000000000000' },
        feeGrowthOutsideX: { v: '27997611982575719931' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '3491053' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -9690,
        sign: false,
        bump: 255,
        liquidityChange: { v: '194587952836497448' },
        liquidityGross: { v: '194587952836497448' },
        sqrtPrice: { v: '616020044340000000000000' },
        feeGrowthOutsideX: { v: '8128187110916219343' },
        feeGrowthOutsideY: { v: '4158979205758267690' },
        secondsPerLiquidityOutside: { v: '6268281' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -6720,
        sign: true,
        bump: 255,
        liquidityChange: { v: '46155556568838803' },
        liquidityGross: { v: '46155556568838803' },
        sqrtPrice: { v: '714635110859000000000000' },
        feeGrowthOutsideX: { v: '8128187110916219343' },
        feeGrowthOutsideY: { v: '4158979205758267690' },
        secondsPerLiquidityOutside: { v: '6268281' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -6660,
        sign: true,
        bump: 252,
        liquidityChange: { v: '170313091996622913' },
        liquidityGross: { v: '170313091996622913' },
        sqrtPrice: { v: '716782127757000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: 23040,
        sign: false,
        bump: 255,
        liquidityChange: { v: '46155556568838803' },
        liquidityGross: { v: '46155556568838803' },
        sqrtPrice: { v: '3164333356269000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: 30210,
        sign: false,
        bump: 253,
        liquidityChange: { v: '170313091996622913' },
        liquidityGross: { v: '170313091996622913' },
        sqrtPrice: { v: '4528652706902000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -23550,
        sign: true,
        bump: 249,
        liquidityChange: { v: '203156374298672741' },
        liquidityGross: { v: '203156374298672741' },
        sqrtPrice: { v: '308066032252000000000000' },
        feeGrowthOutsideX: { v: '1277793787671468731427' },
        feeGrowthOutsideY: { v: '82960029201305385505' },
        secondsPerLiquidityOutside: { v: '6268281' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -23040,
        sign: true,
        bump: 255,
        liquidityChange: { v: '194587952836497448' },
        liquidityGross: { v: '194587952836497448' },
        sqrtPrice: { v: '316022329954000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -13560,
        sign: false,
        bump: 255,
        liquidityChange: { v: '203156374298672741' },
        liquidityGross: { v: '203156374298672741' },
        sqrtPrice: { v: '507648448211000000000000' },
        feeGrowthOutsideX: { v: '27997611982575719931' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '3491053' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -9690,
        sign: false,
        bump: 255,
        liquidityChange: { v: '194587952836497448' },
        liquidityGross: { v: '194587952836497448' },
        sqrtPrice: { v: '616020044340000000000000' },
        feeGrowthOutsideX: { v: '8128187110916219343' },
        feeGrowthOutsideY: { v: '4158979205758267690' },
        secondsPerLiquidityOutside: { v: '6268281' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -6720,
        sign: true,
        bump: 255,
        liquidityChange: { v: '46155556568838803' },
        liquidityGross: { v: '46155556568838803' },
        sqrtPrice: { v: '714635110859000000000000' },
        feeGrowthOutsideX: { v: '8128187110916219343' },
        feeGrowthOutsideY: { v: '4158979205758267690' },
        secondsPerLiquidityOutside: { v: '6268281' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: -6660,
        sign: true,
        bump: 252,
        liquidityChange: { v: '170313091996622913' },
        liquidityGross: { v: '170313091996622913' },
        sqrtPrice: { v: '716782127757000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: 23040,
        sign: false,
        bump: 255,
        liquidityChange: { v: '46155556568838803' },
        liquidityGross: { v: '46155556568838803' },
        sqrtPrice: { v: '3164333356269000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      },
      {
        index: 30210,
        sign: false,
        bump: 253,
        liquidityChange: { v: '170313091996622913' },
        liquidityGross: { v: '170313091996622913' },
        sqrtPrice: { v: '4528652706902000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX'
      }
    ],
    weeklyFactor: 0.00821530274906374,
    currentTickIndex: -15150
  },
  HYCzZYupXUyamfTQWNkULW1EFcNPCTA5urnEXCFXkLRh: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [],
    ticksCurrentSnapshot: [],
    weeklyFactor: 0,
    currentTickIndex: 9
  },
  C7BLPzc1vzLL3Tm5udXELnHDRXeXkdd5f1oMKP8rwUNv: {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [],
    ticksCurrentSnapshot: [],
    weeklyFactor: 0,
    currentTickIndex: 35385
  },
  FeKSMTD9Z22kdnMLeNWAfaTXydbhVixUPcfZDW3QS1X4: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -1765,
        sign: true,
        bump: 254,
        liquidityChange: { v: '4526099828549912' },
        liquidityGross: { v: '4526099828549912' },
        sqrtPrice: { v: '915536004668000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FeKSMTD9Z22kdnMLeNWAfaTXydbhVixUPcfZDW3QS1X4'
      },
      {
        index: -9,
        sign: false,
        bump: 251,
        liquidityChange: { v: '4526099828549912' },
        liquidityGross: { v: '4526099828549912' },
        sqrtPrice: { v: '999550123723000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FeKSMTD9Z22kdnMLeNWAfaTXydbhVixUPcfZDW3QS1X4'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -1765,
        sign: true,
        bump: 254,
        liquidityChange: { v: '4526099828549912' },
        liquidityGross: { v: '4526099828549912' },
        sqrtPrice: { v: '915536004668000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FeKSMTD9Z22kdnMLeNWAfaTXydbhVixUPcfZDW3QS1X4'
      },
      {
        index: -9,
        sign: false,
        bump: 251,
        liquidityChange: { v: '4526099828549912' },
        liquidityGross: { v: '4526099828549912' },
        sqrtPrice: { v: '999550123723000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FeKSMTD9Z22kdnMLeNWAfaTXydbhVixUPcfZDW3QS1X4'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: -368
  },
  '7drJL7kEdJfgNzeaEYKDqTkfmiG2ain3nEPtGHDZc6i2': {
    feeTier: { fee: '3000000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -14820,
        sign: true,
        bump: 255,
        liquidityChange: { v: '58732111695922225' },
        liquidityGross: { v: '58732111695922225' },
        sqrtPrice: { v: '476654698745000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '7drJL7kEdJfgNzeaEYKDqTkfmiG2ain3nEPtGHDZc6i2'
      },
      {
        index: -60,
        sign: false,
        bump: 254,
        liquidityChange: { v: '58732111695922225' },
        liquidityGross: { v: '58732111695922225' },
        sqrtPrice: { v: '997004645044000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '7drJL7kEdJfgNzeaEYKDqTkfmiG2ain3nEPtGHDZc6i2'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -14820,
        sign: true,
        bump: 255,
        liquidityChange: { v: '58732111695922225' },
        liquidityGross: { v: '58732111695922225' },
        sqrtPrice: { v: '476654698745000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '7drJL7kEdJfgNzeaEYKDqTkfmiG2ain3nEPtGHDZc6i2'
      },
      {
        index: -60,
        sign: false,
        bump: 254,
        liquidityChange: { v: '58732111695922225' },
        liquidityGross: { v: '58732111695922225' },
        sqrtPrice: { v: '997004645044000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '7drJL7kEdJfgNzeaEYKDqTkfmiG2ain3nEPtGHDZc6i2'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: -90
  },
  '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC': {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: 21036,
        sign: true,
        bump: 254,
        liquidityChange: { v: '19510634000000' },
        liquidityGross: { v: '19510634000000' },
        sqrtPrice: { v: '2862648980675000000000000' },
        feeGrowthOutsideX: { v: '3966099986143379359' },
        feeGrowthOutsideY: { v: '19124256105670576257' },
        secondsPerLiquidityOutside: { v: '87666585' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21294,
        sign: true,
        bump: 250,
        liquidityChange: { v: '75527257557687655' },
        liquidityGross: { v: '75527257557687655' },
        sqrtPrice: { v: '2899814496479000000000000' },
        feeGrowthOutsideX: { v: '3921631555805864505' },
        feeGrowthOutsideY: { v: '18410984116410242074' },
        secondsPerLiquidityOutside: { v: '53899527' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21314,
        sign: false,
        bump: 254,
        liquidityChange: { v: '75527257557687655' },
        liquidityGross: { v: '75527257557687655' },
        sqrtPrice: { v: '2902715616241000000000000' },
        feeGrowthOutsideX: { v: '3912358147651707374' },
        feeGrowthOutsideY: { v: '18620948694680841909' },
        secondsPerLiquidityOutside: { v: '73069857' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21324,
        sign: true,
        bump: 253,
        liquidityChange: { v: '64830133718000000' },
        liquidityGross: { v: '64830133718000000' },
        sqrtPrice: { v: '2904167264348000000000000' },
        feeGrowthOutsideX: { v: '3929176794124169669' },
        feeGrowthOutsideY: { v: '18861296677865505407' },
        secondsPerLiquidityOutside: { v: '73842642' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21334,
        sign: true,
        bump: 255,
        liquidityChange: { v: '58542182796000000' },
        liquidityGross: { v: '58542182796000000' },
        sqrtPrice: { v: '2905619638428000000000000' },
        feeGrowthOutsideX: { v: '3946341709128543178' },
        feeGrowthOutsideY: { v: '19148881993760623666' },
        secondsPerLiquidityOutside: { v: '73953082' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21344,
        sign: false,
        bump: 255,
        liquidityChange: { v: '64830133718000000' },
        liquidityGross: { v: '64830133718000000' },
        sqrtPrice: { v: '2907072738839000000000000' },
        feeGrowthOutsideX: { v: '3980511015476638823' },
        feeGrowthOutsideY: { v: '19436622339962899962' },
        secondsPerLiquidityOutside: { v: '76230617' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21354,
        sign: false,
        bump: 253,
        liquidityChange: { v: '58542182796000000' },
        liquidityGross: { v: '58542182796000000' },
        sqrtPrice: { v: '2908526565940000000000000' },
        feeGrowthOutsideX: { v: '3997534117421881670' },
        feeGrowthOutsideY: { v: '19724503504582113673' },
        secondsPerLiquidityOutside: { v: '97222577' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21638,
        sign: false,
        bump: 254,
        liquidityChange: { v: '19510634000000' },
        liquidityGross: { v: '19510634000000' },
        sqrtPrice: { v: '2950120179301000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22625,
        sign: true,
        bump: 255,
        liquidityChange: { v: '31020079146000000' },
        liquidityGross: { v: '31020079146000000' },
        sqrtPrice: { v: '3099353188709000000000000' },
        feeGrowthOutsideX: { v: '15957406093976056' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '2953345' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22637,
        sign: true,
        bump: 255,
        liquidityChange: { v: '1734846294331776' },
        liquidityGross: { v: '1734846294331776' },
        sqrtPrice: { v: '3101213265582000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22641,
        sign: false,
        bump: 255,
        liquidityChange: { v: '1734846294331776' },
        liquidityGross: { v: '1734846294331776' },
        sqrtPrice: { v: '3101833539250000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22645,
        sign: false,
        bump: 254,
        liquidityChange: { v: '31020079146000000' },
        liquidityGross: { v: '31020079146000000' },
        sqrtPrice: { v: '3102453936976000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22967,
        sign: true,
        bump: 253,
        liquidityChange: { v: '13929396473000000' },
        liquidityGross: { v: '13929396473000000' },
        sqrtPrice: { v: '3152805167661000000000000' },
        feeGrowthOutsideX: { v: '199253545398429788' },
        feeGrowthOutsideY: { v: '1826091649430369031' },
        secondsPerLiquidityOutside: { v: '1410138' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22987,
        sign: false,
        bump: 255,
        liquidityChange: { v: '13929396473000000' },
        liquidityGross: { v: '13929396473000000' },
        sqrtPrice: { v: '3155959391968000000000000' },
        feeGrowthOutsideX: { v: '149793645169900451' },
        feeGrowthOutsideY: { v: '1500035577892528916' },
        secondsPerLiquidityOutside: { v: '429313' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: 21036,
        sign: true,
        bump: 254,
        liquidityChange: { v: '19510634000000' },
        liquidityGross: { v: '19510634000000' },
        sqrtPrice: { v: '2862648980675000000000000' },
        feeGrowthOutsideX: { v: '3966099986143379359' },
        feeGrowthOutsideY: { v: '19124256105670576257' },
        secondsPerLiquidityOutside: { v: '87666585' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21294,
        sign: true,
        bump: 250,
        liquidityChange: { v: '75527257557687655' },
        liquidityGross: { v: '75527257557687655' },
        sqrtPrice: { v: '2899814496479000000000000' },
        feeGrowthOutsideX: { v: '3921631555805864505' },
        feeGrowthOutsideY: { v: '18410984116410242074' },
        secondsPerLiquidityOutside: { v: '53899527' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21314,
        sign: false,
        bump: 254,
        liquidityChange: { v: '75527257557687655' },
        liquidityGross: { v: '75527257557687655' },
        sqrtPrice: { v: '2902715616241000000000000' },
        feeGrowthOutsideX: { v: '3912358147651707374' },
        feeGrowthOutsideY: { v: '18620948694680841909' },
        secondsPerLiquidityOutside: { v: '73069857' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21324,
        sign: true,
        bump: 253,
        liquidityChange: { v: '64830133718000000' },
        liquidityGross: { v: '64830133718000000' },
        sqrtPrice: { v: '2904167264348000000000000' },
        feeGrowthOutsideX: { v: '3929176794124169669' },
        feeGrowthOutsideY: { v: '18861296677865505407' },
        secondsPerLiquidityOutside: { v: '73842642' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21334,
        sign: true,
        bump: 255,
        liquidityChange: { v: '58542182796000000' },
        liquidityGross: { v: '58542182796000000' },
        sqrtPrice: { v: '2905619638428000000000000' },
        feeGrowthOutsideX: { v: '3946341709128543178' },
        feeGrowthOutsideY: { v: '19148881993760623666' },
        secondsPerLiquidityOutside: { v: '73953082' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21344,
        sign: false,
        bump: 255,
        liquidityChange: { v: '64830133718000000' },
        liquidityGross: { v: '64830133718000000' },
        sqrtPrice: { v: '2907072738839000000000000' },
        feeGrowthOutsideX: { v: '3980511015476638823' },
        feeGrowthOutsideY: { v: '19436622339962899962' },
        secondsPerLiquidityOutside: { v: '76230617' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21354,
        sign: false,
        bump: 253,
        liquidityChange: { v: '58542182796000000' },
        liquidityGross: { v: '58542182796000000' },
        sqrtPrice: { v: '2908526565940000000000000' },
        feeGrowthOutsideX: { v: '3997534117421881670' },
        feeGrowthOutsideY: { v: '19724503504582113673' },
        secondsPerLiquidityOutside: { v: '97222577' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 21638,
        sign: false,
        bump: 254,
        liquidityChange: { v: '19510634000000' },
        liquidityGross: { v: '19510634000000' },
        sqrtPrice: { v: '2950120179301000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22625,
        sign: true,
        bump: 255,
        liquidityChange: { v: '31020079146000000' },
        liquidityGross: { v: '31020079146000000' },
        sqrtPrice: { v: '3099353188709000000000000' },
        feeGrowthOutsideX: { v: '15957406093976056' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '2953345' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22637,
        sign: true,
        bump: 255,
        liquidityChange: { v: '1734846294331776' },
        liquidityGross: { v: '1734846294331776' },
        sqrtPrice: { v: '3101213265582000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22641,
        sign: false,
        bump: 255,
        liquidityChange: { v: '1734846294331776' },
        liquidityGross: { v: '1734846294331776' },
        sqrtPrice: { v: '3101833539250000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22645,
        sign: false,
        bump: 254,
        liquidityChange: { v: '31020079146000000' },
        liquidityGross: { v: '31020079146000000' },
        sqrtPrice: { v: '3102453936976000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22967,
        sign: true,
        bump: 253,
        liquidityChange: { v: '13929396473000000' },
        liquidityGross: { v: '13929396473000000' },
        sqrtPrice: { v: '3152805167661000000000000' },
        feeGrowthOutsideX: { v: '199253545398429788' },
        feeGrowthOutsideY: { v: '1826091649430369031' },
        secondsPerLiquidityOutside: { v: '1410138' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      },
      {
        index: 22987,
        sign: false,
        bump: 255,
        liquidityChange: { v: '13929396473000000' },
        liquidityGross: { v: '13929396473000000' },
        sqrtPrice: { v: '3155959391968000000000000' },
        feeGrowthOutsideX: { v: '149793645169900451' },
        feeGrowthOutsideY: { v: '1500035577892528916' },
        secondsPerLiquidityOutside: { v: '429313' },
        pool: '2SgUGxYDczrB6wUzXHPJH65pNhWkEzNMEx3km4xTYUTC'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 21637
  },
  HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -561,
        sign: true,
        bump: 255,
        liquidityChange: { v: '590198568000000' },
        liquidityGross: { v: '590198568000000' },
        sqrtPrice: { v: '972341112223000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      },
      {
        index: -558,
        sign: true,
        bump: 255,
        liquidityChange: { v: '125908335451000000' },
        liquidityGross: { v: '125908335451000000' },
        sqrtPrice: { v: '972486967036000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      },
      {
        index: 439,
        sign: false,
        bump: 255,
        liquidityChange: { v: '125908335451000000' },
        liquidityGross: { v: '125908335451000000' },
        sqrtPrice: { v: '1022191551770000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      },
      {
        index: 440,
        sign: false,
        bump: 253,
        liquidityChange: { v: '590198568000000' },
        liquidityGross: { v: '590198568000000' },
        sqrtPrice: { v: '1022242660071000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -561,
        sign: true,
        bump: 255,
        liquidityChange: { v: '590198568000000' },
        liquidityGross: { v: '590198568000000' },
        sqrtPrice: { v: '972341112223000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      },
      {
        index: -558,
        sign: true,
        bump: 255,
        liquidityChange: { v: '125908335451000000' },
        liquidityGross: { v: '125908335451000000' },
        sqrtPrice: { v: '972486967036000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      },
      {
        index: 439,
        sign: false,
        bump: 255,
        liquidityChange: { v: '125908335451000000' },
        liquidityGross: { v: '125908335451000000' },
        sqrtPrice: { v: '1022191551770000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      },
      {
        index: 440,
        sign: false,
        bump: 253,
        liquidityChange: { v: '590198568000000' },
        liquidityGross: { v: '590198568000000' },
        sqrtPrice: { v: '1022242660071000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'HbMbeaDH8xtB1a8WpwjNqcXBBGraKJjJ2xFkXEdAy1rY'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: -76
  },
  '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk': {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -101,
        sign: true,
        bump: 255,
        liquidityChange: { v: '10020131496000000' },
        liquidityGross: { v: '10020131496000000' },
        sqrtPrice: { v: '994962981025000000000000' },
        feeGrowthOutsideX: { v: '187490820900000269' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '3752316' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: -32,
        sign: true,
        bump: 255,
        liquidityChange: { v: '2200218431742000000' },
        liquidityGross: { v: '2200218431742000000' },
        sqrtPrice: { v: '998401359184000000000000' },
        feeGrowthOutsideX: { v: '358028854052243483' },
        feeGrowthOutsideY: { v: '83752030641637742' },
        secondsPerLiquidityOutside: { v: '173266424' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: -2,
        sign: true,
        bump: 254,
        liquidityChange: { v: '6433326239000000' },
        liquidityGross: { v: '6433326239000000' },
        sqrtPrice: { v: '999900009999000000000000' },
        feeGrowthOutsideX: { v: '137105338168776104' },
        feeGrowthOutsideY: { v: '67584578142170065' },
        secondsPerLiquidityOutside: { v: '147822277' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: 18,
        sign: false,
        bump: 255,
        liquidityChange: { v: '6433326239000000' },
        liquidityGross: { v: '6433326239000000' },
        sqrtPrice: { v: '1000900360084000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: 40,
        sign: false,
        bump: 255,
        liquidityChange: { v: '2200218431742000000' },
        liquidityGross: { v: '2200218431742000000' },
        sqrtPrice: { v: '1002001901140000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: 100,
        sign: false,
        bump: 255,
        liquidityChange: { v: '10020131496000000' },
        liquidityGross: { v: '10020131496000000' },
        sqrtPrice: { v: '1005012269622000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -101,
        sign: true,
        bump: 255,
        liquidityChange: { v: '10020131496000000' },
        liquidityGross: { v: '10020131496000000' },
        sqrtPrice: { v: '994962981025000000000000' },
        feeGrowthOutsideX: { v: '187490820900000269' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '3752316' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: -32,
        sign: true,
        bump: 255,
        liquidityChange: { v: '2200218431742000000' },
        liquidityGross: { v: '2200218431742000000' },
        sqrtPrice: { v: '998401359184000000000000' },
        feeGrowthOutsideX: { v: '358028854052243483' },
        feeGrowthOutsideY: { v: '83752030641637742' },
        secondsPerLiquidityOutside: { v: '173266424' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: -2,
        sign: true,
        bump: 254,
        liquidityChange: { v: '6433326239000000' },
        liquidityGross: { v: '6433326239000000' },
        sqrtPrice: { v: '999900009999000000000000' },
        feeGrowthOutsideX: { v: '137105338168776104' },
        feeGrowthOutsideY: { v: '67584578142170065' },
        secondsPerLiquidityOutside: { v: '147822277' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: 18,
        sign: false,
        bump: 255,
        liquidityChange: { v: '6433326239000000' },
        liquidityGross: { v: '6433326239000000' },
        sqrtPrice: { v: '1000900360084000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: 40,
        sign: false,
        bump: 255,
        liquidityChange: { v: '2200218431742000000' },
        liquidityGross: { v: '2200218431742000000' },
        sqrtPrice: { v: '1002001901140000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      },
      {
        index: 100,
        sign: false,
        bump: 255,
        liquidityChange: { v: '10020131496000000' },
        liquidityGross: { v: '10020131496000000' },
        sqrtPrice: { v: '1005012269622000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '4FkGNJMvKFk9PFwn8TBtk1ShUKege6D5Au87ezwLWiqk'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: -6
  },
  DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP: {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: 32195,
        sign: true,
        bump: 255,
        liquidityChange: { v: '94498730580100' },
        liquidityGross: { v: '94498730580100' },
        sqrtPrice: { v: '5001158158749000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      },
      {
        index: 34045,
        sign: true,
        bump: 255,
        liquidityChange: { v: '589310109056380' },
        liquidityGross: { v: '589310109056380' },
        sqrtPrice: { v: '5485810736957000000000000' },
        feeGrowthOutsideX: { v: '5577582182218590001' },
        feeGrowthOutsideY: { v: '129413360679929707923' },
        secondsPerLiquidityOutside: { v: '20911267000' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      },
      {
        index: 34655,
        sign: false,
        bump: 254,
        liquidityChange: { v: '589310109056380' },
        liquidityGross: { v: '589310109056380' },
        sqrtPrice: { v: '5655697067873000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      },
      {
        index: 35215,
        sign: false,
        bump: 255,
        liquidityChange: { v: '94498730580100' },
        liquidityGross: { v: '94498730580100' },
        sqrtPrice: { v: '5816286314688000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: 32195,
        sign: true,
        bump: 255,
        liquidityChange: { v: '94498730580100' },
        liquidityGross: { v: '94498730580100' },
        sqrtPrice: { v: '5001158158749000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      },
      {
        index: 34045,
        sign: true,
        bump: 255,
        liquidityChange: { v: '589310109056380' },
        liquidityGross: { v: '589310109056380' },
        sqrtPrice: { v: '5485810736957000000000000' },
        feeGrowthOutsideX: { v: '5577582182218590001' },
        feeGrowthOutsideY: { v: '129413360679929707923' },
        secondsPerLiquidityOutside: { v: '20911267000' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      },
      {
        index: 34655,
        sign: false,
        bump: 254,
        liquidityChange: { v: '589310109056380' },
        liquidityGross: { v: '589310109056380' },
        sqrtPrice: { v: '5655697067873000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      },
      {
        index: 35215,
        sign: false,
        bump: 255,
        liquidityChange: { v: '94498730580100' },
        liquidityGross: { v: '94498730580100' },
        sqrtPrice: { v: '5816286314688000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'DzCbrMZXNG3XpXuufhBp233LJXvV8Xq1C3q4ksrtbCPP'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 32195
  },
  EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j: {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: 105435,
        sign: true,
        bump: 254,
        liquidityChange: { v: '4128576977554' },
        liquidityGross: { v: '4128576977554' },
        sqrtPrice: { v: '194705162742102000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '10291217557851152804' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      },
      {
        index: 106640,
        sign: true,
        bump: 250,
        liquidityChange: { v: '20502919000000' },
        liquidityGross: { v: '20502919000000' },
        sqrtPrice: { v: '206796127390186000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '4124744329889005104096' },
        secondsPerLiquidityOutside: { v: '377911050729' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      },
      {
        index: 106740,
        sign: false,
        bump: 242,
        liquidityChange: { v: '20502919000000' },
        liquidityGross: { v: '20502919000000' },
        sqrtPrice: { v: '207832645337379000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '3621344613721556168041' },
        secondsPerLiquidityOutside: { v: '371265452559' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      },
      {
        index: 107445,
        sign: false,
        bump: 253,
        liquidityChange: { v: '4128576977554' },
        liquidityGross: { v: '4128576977554' },
        sqrtPrice: { v: '215289019841538000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: 105435,
        sign: true,
        bump: 254,
        liquidityChange: { v: '4128576977554' },
        liquidityGross: { v: '4128576977554' },
        sqrtPrice: { v: '194705162742102000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '10291217557851152804' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      },
      {
        index: 106640,
        sign: true,
        bump: 250,
        liquidityChange: { v: '20502919000000' },
        liquidityGross: { v: '20502919000000' },
        sqrtPrice: { v: '206796127390186000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '4124744329889005104096' },
        secondsPerLiquidityOutside: { v: '377911050729' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      },
      {
        index: 106740,
        sign: false,
        bump: 242,
        liquidityChange: { v: '20502919000000' },
        liquidityGross: { v: '20502919000000' },
        sqrtPrice: { v: '207832645337379000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '3621344613721556168041' },
        secondsPerLiquidityOutside: { v: '371265452559' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      },
      {
        index: 107445,
        sign: false,
        bump: 253,
        liquidityChange: { v: '4128576977554' },
        liquidityGross: { v: '4128576977554' },
        sqrtPrice: { v: '215289019841538000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'EWZW9aJmY2LX6ZyV5RU8waHWKF1aGaxzbuBuRQp6G4j'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 105440
  },
  FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -173,
        sign: true,
        bump: 255,
        liquidityChange: { v: '49927316951000000' },
        liquidityGross: { v: '49927316951000000' },
        sqrtPrice: { v: '991387732363000000000000' },
        feeGrowthOutsideX: { v: '403746941367134397' },
        feeGrowthOutsideY: { v: '549143465251870058' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      },
      {
        index: -50,
        sign: true,
        bump: 255,
        liquidityChange: { v: '263727075280000000' },
        liquidityGross: { v: '263727075280000000' },
        sqrtPrice: { v: '997503247077000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      },
      {
        index: 50,
        sign: false,
        bump: 254,
        liquidityChange: { v: '263727075280000000' },
        liquidityGross: { v: '263727075280000000' },
        sqrtPrice: { v: '1002503002301000000000000' },
        feeGrowthOutsideX: { v: '408650427618547368' },
        feeGrowthOutsideY: { v: '655770379551125852' },
        secondsPerLiquidityOutside: { v: '15403039' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      },
      {
        index: 231,
        sign: false,
        bump: 255,
        liquidityChange: { v: '49927316951000000' },
        liquidityGross: { v: '49927316951000000' },
        sqrtPrice: { v: '1011616374619000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -173,
        sign: true,
        bump: 255,
        liquidityChange: { v: '49927316951000000' },
        liquidityGross: { v: '49927316951000000' },
        sqrtPrice: { v: '991387732363000000000000' },
        feeGrowthOutsideX: { v: '403746941367134397' },
        feeGrowthOutsideY: { v: '549143465251870058' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      },
      {
        index: -50,
        sign: true,
        bump: 255,
        liquidityChange: { v: '263727075280000000' },
        liquidityGross: { v: '263727075280000000' },
        sqrtPrice: { v: '997503247077000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      },
      {
        index: 50,
        sign: false,
        bump: 254,
        liquidityChange: { v: '263727075280000000' },
        liquidityGross: { v: '263727075280000000' },
        sqrtPrice: { v: '1002503002301000000000000' },
        feeGrowthOutsideX: { v: '408650427618547368' },
        feeGrowthOutsideY: { v: '655770379551125852' },
        secondsPerLiquidityOutside: { v: '15403039' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      },
      {
        index: 231,
        sign: false,
        bump: 255,
        liquidityChange: { v: '49927316951000000' },
        liquidityGross: { v: '49927316951000000' },
        sqrtPrice: { v: '1011616374619000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'FejEVPJBH5TEbgcpupNuRyiMRoeaCQwPvtVU6w3i2xRc'
      }
    ],
    weeklyFactor: 0.0021975523356126585,
    currentTickIndex: 95
  },
  '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7': {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 134000000,
    ticksPreviousSnapshot: [
      {
        index: -13866,
        sign: true,
        bump: 253,
        liquidityChange: { v: '19999000000' },
        liquidityGross: { v: '19999000000' },
        sqrtPrice: { v: '499940925222000000000000' },
        feeGrowthOutsideX: { v: '213599064982292563' },
        feeGrowthOutsideY: { v: '207668686888298575' },
        secondsPerLiquidityOutside: { v: '363760' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -76,
        sign: true,
        bump: 252,
        liquidityChange: { v: '362566107000000' },
        liquidityGross: { v: '362566107000000' },
        sqrtPrice: { v: '996207400131000000000000' },
        feeGrowthOutsideX: { v: '500915968339967821' },
        feeGrowthOutsideY: { v: '488574176931961235' },
        secondsPerLiquidityOutside: { v: '5322723412974' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -13,
        sign: true,
        bump: 254,
        liquidityChange: { v: '192803378292727080' },
        liquidityGross: { v: '192803378292727080' },
        sqrtPrice: { v: '999350243681000000000000' },
        feeGrowthOutsideX: { v: '85376724399612411' },
        feeGrowthOutsideY: { v: '72369237901333250' },
        secondsPerLiquidityOutside: { v: '319663' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -12,
        sign: true,
        bump: 255,
        liquidityChange: { v: '6372778878213128188' },
        liquidityGross: { v: '6372778878213128188' },
        sqrtPrice: { v: '999400209944000000000000' },
        feeGrowthOutsideX: { v: '418333833999683896' },
        feeGrowthOutsideY: { v: '419769112472262101' },
        secondsPerLiquidityOutside: { v: '5322722859067' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -11,
        sign: true,
        bump: 255,
        liquidityChange: { v: '27275907834731057844' },
        liquidityGross: { v: '27275907834731057844' },
        sqrtPrice: { v: '999450178706000000000000' },
        feeGrowthOutsideX: { v: '478620333988690933' },
        feeGrowthOutsideY: { v: '488092671337749711' },
        secondsPerLiquidityOutside: { v: '5322723374308' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -10,
        sign: true,
        bump: 255,
        liquidityChange: { v: '978914223743127276' },
        liquidityGross: { v: '978914223743127276' },
        sqrtPrice: { v: '999500149965000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -8,
        sign: true,
        bump: 255,
        liquidityChange: { v: '1274221328248000000' },
        liquidityGross: { v: '1274221328248000000' },
        sqrtPrice: { v: '999600099980000000000000' },
        feeGrowthOutsideX: { v: '65313863728491766' },
        feeGrowthOutsideY: { v: '27202242057295828' },
        secondsPerLiquidityOutside: { v: '126342' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -5,
        sign: true,
        bump: 254,
        liquidityChange: { v: '41537248557250000000' },
        liquidityGross: { v: '41537248557250000000' },
        sqrtPrice: { v: '999750043743000000000000' },
        feeGrowthOutsideX: { v: '70926574366233578' },
        feeGrowthOutsideY: { v: '46157216286323845' },
        secondsPerLiquidityOutside: { v: '306831' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -1,
        sign: true,
        bump: 254,
        liquidityChange: { v: '400525773034566179756' },
        liquidityGross: { v: '400525773034566179756' },
        sqrtPrice: { v: '999950003749000000000000' },
        feeGrowthOutsideX: { v: '82137225201520821' },
        feeGrowthOutsideY: { v: '77163856052910435' },
        secondsPerLiquidityOutside: { v: '351472' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 1,
        sign: false,
        bump: 253,
        liquidityChange: { v: '400525773034566179756' },
        liquidityGross: { v: '400525773034566179756' },
        sqrtPrice: { v: '1000049998750000000000000' },
        feeGrowthOutsideX: { v: '156631229723302203' },
        feeGrowthOutsideY: { v: '161560224677096865' },
        secondsPerLiquidityOutside: { v: '371064' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 7,
        sign: false,
        bump: 254,
        liquidityChange: { v: '41730051935542727080' },
        liquidityGross: { v: '41730051935542727080' },
        sqrtPrice: { v: '1000350043751000000000000' },
        feeGrowthOutsideX: { v: '296402462198021231' },
        feeGrowthOutsideY: { v: '331078389544863715' },
        secondsPerLiquidityOutside: { v: '376268' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 8,
        sign: false,
        bump: 254,
        liquidityChange: { v: '1274221328248000000' },
        liquidityGross: { v: '1274221328248000000' },
        sqrtPrice: { v: '1000400060004000000000000' },
        feeGrowthOutsideX: { v: '301799925337245600' },
        feeGrowthOutsideY: { v: '341432135538877930' },
        secondsPerLiquidityOutside: { v: '402962' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 10,
        sign: false,
        bump: 255,
        liquidityChange: { v: '978914223743127276' },
        liquidityGross: { v: '978914223743127276' },
        sqrtPrice: { v: '1000500100010000000000000' },
        feeGrowthOutsideX: { v: '327897918623630033' },
        feeGrowthOutsideY: { v: '377457945460643840' },
        secondsPerLiquidityOutside: { v: '465206' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 11,
        sign: false,
        bump: 254,
        liquidityChange: { v: '27275907834731057844' },
        liquidityGross: { v: '27275907834731057844' },
        sqrtPrice: { v: '1000550123763000000000000' },
        feeGrowthOutsideX: { v: '498667686238796958' },
        feeGrowthOutsideY: { v: '508157503731597901' },
        secondsPerLiquidityOutside: { v: '5322723405704' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 12,
        sign: false,
        bump: 253,
        liquidityChange: { v: '6372778878213128188' },
        liquidityGross: { v: '6372778878213128188' },
        sqrtPrice: { v: '1000600150020000000000000' },
        feeGrowthOutsideX: { v: '49204835125377052' },
        feeGrowthOutsideY: { v: '49995280137942270' },
        secondsPerLiquidityOutside: { v: '343848' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 90,
        sign: false,
        bump: 255,
        liquidityChange: { v: '362566107000000' },
        liquidityGross: { v: '362566107000000' },
        sqrtPrice: { v: '1004509914204000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 152,
        sign: true,
        bump: 254,
        liquidityChange: { v: '10158584282000000' },
        liquidityGross: { v: '10158584282000000' },
        sqrtPrice: { v: '1007628570426000000000000' },
        feeGrowthOutsideX: { v: '154740569395442765' },
        feeGrowthOutsideY: { v: '107054983951501146' },
        secondsPerLiquidityOutside: { v: '6639419' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 172,
        sign: false,
        bump: 255,
        liquidityChange: { v: '10158584282000000' },
        liquidityGross: { v: '10158584282000000' },
        sqrtPrice: { v: '1008636652550000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 13862,
        sign: false,
        bump: 249,
        liquidityChange: { v: '19999000000' },
        liquidityGross: { v: '19999000000' },
        sqrtPrice: { v: '1999836339766000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -13866,
        sign: true,
        bump: 253,
        liquidityChange: { v: '19999000000' },
        liquidityGross: { v: '19999000000' },
        sqrtPrice: { v: '499940925222000000000000' },
        feeGrowthOutsideX: { v: '213599064982292563' },
        feeGrowthOutsideY: { v: '207668686888298575' },
        secondsPerLiquidityOutside: { v: '363760' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -76,
        sign: true,
        bump: 252,
        liquidityChange: { v: '362566107000000' },
        liquidityGross: { v: '362566107000000' },
        sqrtPrice: { v: '996207400131000000000000' },
        feeGrowthOutsideX: { v: '500915968339967821' },
        feeGrowthOutsideY: { v: '488574176931961235' },
        secondsPerLiquidityOutside: { v: '5322723412974' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -13,
        sign: true,
        bump: 254,
        liquidityChange: { v: '192803378292727080' },
        liquidityGross: { v: '192803378292727080' },
        sqrtPrice: { v: '999350243681000000000000' },
        feeGrowthOutsideX: { v: '85376724399612411' },
        feeGrowthOutsideY: { v: '72369237901333250' },
        secondsPerLiquidityOutside: { v: '319663' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -12,
        sign: true,
        bump: 255,
        liquidityChange: { v: '6372778878213128188' },
        liquidityGross: { v: '6372778878213128188' },
        sqrtPrice: { v: '999400209944000000000000' },
        feeGrowthOutsideX: { v: '418333833999683896' },
        feeGrowthOutsideY: { v: '419769112472262101' },
        secondsPerLiquidityOutside: { v: '5322722859067' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -11,
        sign: true,
        bump: 255,
        liquidityChange: { v: '27275907834731057844' },
        liquidityGross: { v: '27275907834731057844' },
        sqrtPrice: { v: '999450178706000000000000' },
        feeGrowthOutsideX: { v: '478620333988690933' },
        feeGrowthOutsideY: { v: '488092671337749711' },
        secondsPerLiquidityOutside: { v: '5322723374308' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -10,
        sign: true,
        bump: 255,
        liquidityChange: { v: '978914223743127276' },
        liquidityGross: { v: '978914223743127276' },
        sqrtPrice: { v: '999500149965000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -8,
        sign: true,
        bump: 255,
        liquidityChange: { v: '1274221328248000000' },
        liquidityGross: { v: '1274221328248000000' },
        sqrtPrice: { v: '999600099980000000000000' },
        feeGrowthOutsideX: { v: '65313863728491766' },
        feeGrowthOutsideY: { v: '27202242057295828' },
        secondsPerLiquidityOutside: { v: '126342' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -5,
        sign: true,
        bump: 254,
        liquidityChange: { v: '41537248557250000000' },
        liquidityGross: { v: '41537248557250000000' },
        sqrtPrice: { v: '999750043743000000000000' },
        feeGrowthOutsideX: { v: '70926574366233578' },
        feeGrowthOutsideY: { v: '46157216286323845' },
        secondsPerLiquidityOutside: { v: '306831' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: -1,
        sign: true,
        bump: 254,
        liquidityChange: { v: '400525773034566179756' },
        liquidityGross: { v: '400525773034566179756' },
        sqrtPrice: { v: '999950003749000000000000' },
        feeGrowthOutsideX: { v: '82137225201520821' },
        feeGrowthOutsideY: { v: '77163856052910435' },
        secondsPerLiquidityOutside: { v: '351472' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 1,
        sign: false,
        bump: 253,
        liquidityChange: { v: '400525773034566179756' },
        liquidityGross: { v: '400525773034566179756' },
        sqrtPrice: { v: '1000049998750000000000000' },
        feeGrowthOutsideX: { v: '156631229723302203' },
        feeGrowthOutsideY: { v: '161560224677096865' },
        secondsPerLiquidityOutside: { v: '371064' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 7,
        sign: false,
        bump: 254,
        liquidityChange: { v: '41730051935542727080' },
        liquidityGross: { v: '41730051935542727080' },
        sqrtPrice: { v: '1000350043751000000000000' },
        feeGrowthOutsideX: { v: '296402462198021231' },
        feeGrowthOutsideY: { v: '331078389544863715' },
        secondsPerLiquidityOutside: { v: '376268' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 8,
        sign: false,
        bump: 254,
        liquidityChange: { v: '1274221328248000000' },
        liquidityGross: { v: '1274221328248000000' },
        sqrtPrice: { v: '1000400060004000000000000' },
        feeGrowthOutsideX: { v: '301799925337245600' },
        feeGrowthOutsideY: { v: '341432135538877930' },
        secondsPerLiquidityOutside: { v: '402962' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 10,
        sign: false,
        bump: 255,
        liquidityChange: { v: '978914223743127276' },
        liquidityGross: { v: '978914223743127276' },
        sqrtPrice: { v: '1000500100010000000000000' },
        feeGrowthOutsideX: { v: '327897918623630033' },
        feeGrowthOutsideY: { v: '377457945460643840' },
        secondsPerLiquidityOutside: { v: '465206' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 11,
        sign: false,
        bump: 254,
        liquidityChange: { v: '27275907834731057844' },
        liquidityGross: { v: '27275907834731057844' },
        sqrtPrice: { v: '1000550123763000000000000' },
        feeGrowthOutsideX: { v: '498667686238796958' },
        feeGrowthOutsideY: { v: '508157503731597901' },
        secondsPerLiquidityOutside: { v: '5322723405704' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 12,
        sign: false,
        bump: 253,
        liquidityChange: { v: '6372778878213128188' },
        liquidityGross: { v: '6372778878213128188' },
        sqrtPrice: { v: '1000600150020000000000000' },
        feeGrowthOutsideX: { v: '451739722825393273' },
        feeGrowthOutsideY: { v: '463115040062067764' },
        secondsPerLiquidityOutside: { v: '5322723089683' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 90,
        sign: false,
        bump: 255,
        liquidityChange: { v: '362566107000000' },
        liquidityGross: { v: '362566107000000' },
        sqrtPrice: { v: '1004509914204000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 152,
        sign: true,
        bump: 254,
        liquidityChange: { v: '10158584282000000' },
        liquidityGross: { v: '10158584282000000' },
        sqrtPrice: { v: '1007628570426000000000000' },
        feeGrowthOutsideX: { v: '154740569395442765' },
        feeGrowthOutsideY: { v: '107054983951501146' },
        secondsPerLiquidityOutside: { v: '6639419' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 172,
        sign: false,
        bump: 255,
        liquidityChange: { v: '10158584282000000' },
        liquidityGross: { v: '10158584282000000' },
        sqrtPrice: { v: '1008636652550000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      },
      {
        index: 13862,
        sign: false,
        bump: 249,
        liquidityChange: { v: '19999000000' },
        liquidityGross: { v: '19999000000' },
        sqrtPrice: { v: '1999836339766000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '5dX3tkVDmbHBWMCQMerAHTmd9wsRvmtKLoQt6qv9fHy7'
      }
    ],
    weeklyFactor: 0.004231568817208016,
    currentTickIndex: 20
  },
  GmBMZ8BNeNR6mRFqu2ZaFvpxvGPXmc9Aa4a1GWFaxWMv: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [],
    ticksCurrentSnapshot: [],
    weeklyFactor: 0,
    currentTickIndex: -2804
  },
  '9bXJSJ3tGjkk8QVSykcGE6KnzdKznfjWP7YXicSRFTe8': {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: 46065,
        sign: true,
        bump: 255,
        liquidityChange: { v: '30468702370000000' },
        liquidityGross: { v: '30468702370000000' },
        sqrtPrice: { v: '10005499026037000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '9bXJSJ3tGjkk8QVSykcGE6KnzdKznfjWP7YXicSRFTe8'
      },
      {
        index: 46075,
        sign: false,
        bump: 253,
        liquidityChange: { v: '30468702370000000' },
        liquidityGross: { v: '30468702370000000' },
        sqrtPrice: { v: '10010502776189000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '9bXJSJ3tGjkk8QVSykcGE6KnzdKznfjWP7YXicSRFTe8'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: 46065,
        sign: true,
        bump: 255,
        liquidityChange: { v: '30468702370000000' },
        liquidityGross: { v: '30468702370000000' },
        sqrtPrice: { v: '10005499026037000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '9bXJSJ3tGjkk8QVSykcGE6KnzdKznfjWP7YXicSRFTe8'
      },
      {
        index: 46075,
        sign: false,
        bump: 253,
        liquidityChange: { v: '30468702370000000' },
        liquidityGross: { v: '30468702370000000' },
        sqrtPrice: { v: '10010502776189000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '9bXJSJ3tGjkk8QVSykcGE6KnzdKznfjWP7YXicSRFTe8'
      }
    ],
    weeklyFactor: 0.000040876196933771536,
    currentTickIndex: 46070
  },
  AXSXYioiHGFvQ1XF4zCvXjnVAcMY68WQ4RH5r5nAdah5: {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -50,
        sign: true,
        bump: 255,
        liquidityChange: { v: '80104041596429' },
        liquidityGross: { v: '80104041596429' },
        sqrtPrice: { v: '997503247077000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AXSXYioiHGFvQ1XF4zCvXjnVAcMY68WQ4RH5r5nAdah5'
      },
      {
        index: 50,
        sign: false,
        bump: 255,
        liquidityChange: { v: '80104041596429' },
        liquidityGross: { v: '80104041596429' },
        sqrtPrice: { v: '1002503002301000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AXSXYioiHGFvQ1XF4zCvXjnVAcMY68WQ4RH5r5nAdah5'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -50,
        sign: true,
        bump: 255,
        liquidityChange: { v: '80104041596429' },
        liquidityGross: { v: '80104041596429' },
        sqrtPrice: { v: '997503247077000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AXSXYioiHGFvQ1XF4zCvXjnVAcMY68WQ4RH5r5nAdah5'
      },
      {
        index: 50,
        sign: false,
        bump: 255,
        liquidityChange: { v: '80104041596429' },
        liquidityGross: { v: '80104041596429' },
        sqrtPrice: { v: '1002503002301000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'AXSXYioiHGFvQ1XF4zCvXjnVAcMY68WQ4RH5r5nAdah5'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: -25
  },
  '2keDsfcMY6hLvfrmzDAfnMSudMqYczPVcb8MSkK59P9r': {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -24090,
        sign: true,
        bump: 253,
        liquidityChange: { v: '4077639023000000' },
        liquidityGross: { v: '4077639023000000' },
        sqrtPrice: { v: '299859940410000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2keDsfcMY6hLvfrmzDAfnMSudMqYczPVcb8MSkK59P9r'
      },
      {
        index: -22390,
        sign: false,
        bump: 253,
        liquidityChange: { v: '4077639023000000' },
        liquidityGross: { v: '4077639023000000' },
        sqrtPrice: { v: '326461247365000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2keDsfcMY6hLvfrmzDAfnMSudMqYczPVcb8MSkK59P9r'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -24090,
        sign: true,
        bump: 253,
        liquidityChange: { v: '4077639023000000' },
        liquidityGross: { v: '4077639023000000' },
        sqrtPrice: { v: '299859940410000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2keDsfcMY6hLvfrmzDAfnMSudMqYczPVcb8MSkK59P9r'
      },
      {
        index: -22390,
        sign: false,
        bump: 253,
        liquidityChange: { v: '4077639023000000' },
        liquidityGross: { v: '4077639023000000' },
        sqrtPrice: { v: '326461247365000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '2keDsfcMY6hLvfrmzDAfnMSudMqYczPVcb8MSkK59P9r'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: -24090
  },
  '9fY5jLin2yYMK9Eee5diWzJRZqLaYgEUupUNsKVYAMhi': {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -17,
        sign: true,
        bump: 255,
        liquidityChange: { v: '74077865307471546' },
        liquidityGross: { v: '74077865307471546' },
        sqrtPrice: { v: '999150403608000000000000' },
        feeGrowthOutsideX: { v: '3929406641188796' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '2302' },
        pool: '9fY5jLin2yYMK9Eee5diWzJRZqLaYgEUupUNsKVYAMhi'
      },
      {
        index: 15,
        sign: false,
        bump: 255,
        liquidityChange: { v: '74077865307471546' },
        liquidityGross: { v: '74077865307471546' },
        sqrtPrice: { v: '1000750243793000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '9fY5jLin2yYMK9Eee5diWzJRZqLaYgEUupUNsKVYAMhi'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -17,
        sign: true,
        bump: 255,
        liquidityChange: { v: '74077865307471546' },
        liquidityGross: { v: '74077865307471546' },
        sqrtPrice: { v: '999150403608000000000000' },
        feeGrowthOutsideX: { v: '3929406641188796' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '2302' },
        pool: '9fY5jLin2yYMK9Eee5diWzJRZqLaYgEUupUNsKVYAMhi'
      },
      {
        index: 15,
        sign: false,
        bump: 255,
        liquidityChange: { v: '74077865307471546' },
        liquidityGross: { v: '74077865307471546' },
        sqrtPrice: { v: '1000750243793000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '9fY5jLin2yYMK9Eee5diWzJRZqLaYgEUupUNsKVYAMhi'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 10
  },
  A5U2LbZhwc6GFZtYft6MtbGHFhYyZ1pzCRQkz7D2b2YS: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -10,
        sign: true,
        bump: 253,
        liquidityChange: { v: '2662204475000000' },
        liquidityGross: { v: '2662204475000000' },
        sqrtPrice: { v: '999500149965000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'A5U2LbZhwc6GFZtYft6MtbGHFhYyZ1pzCRQkz7D2b2YS'
      },
      {
        index: 10,
        sign: false,
        bump: 253,
        liquidityChange: { v: '2662204475000000' },
        liquidityGross: { v: '2662204475000000' },
        sqrtPrice: { v: '1000500100010000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'A5U2LbZhwc6GFZtYft6MtbGHFhYyZ1pzCRQkz7D2b2YS'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -10,
        sign: true,
        bump: 253,
        liquidityChange: { v: '2662204475000000' },
        liquidityGross: { v: '2662204475000000' },
        sqrtPrice: { v: '999500149965000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'A5U2LbZhwc6GFZtYft6MtbGHFhYyZ1pzCRQkz7D2b2YS'
      },
      {
        index: 10,
        sign: false,
        bump: 253,
        liquidityChange: { v: '2662204475000000' },
        liquidityGross: { v: '2662204475000000' },
        sqrtPrice: { v: '1000500100010000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'A5U2LbZhwc6GFZtYft6MtbGHFhYyZ1pzCRQkz7D2b2YS'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 0
  },
  B2Mq1fpJ2bZYxxtF4yz6nNvLJLaYzM3zQsHcs2oDqk3z: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -12,
        sign: true,
        bump: 255,
        liquidityChange: { v: '4361705790000000' },
        liquidityGross: { v: '4361705790000000' },
        sqrtPrice: { v: '999400209944000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'B2Mq1fpJ2bZYxxtF4yz6nNvLJLaYzM3zQsHcs2oDqk3z'
      },
      {
        index: 1246,
        sign: false,
        bump: 255,
        liquidityChange: { v: '4361705790000000' },
        liquidityGross: { v: '4361705790000000' },
        sqrtPrice: { v: '1064278266283000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'B2Mq1fpJ2bZYxxtF4yz6nNvLJLaYzM3zQsHcs2oDqk3z'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -12,
        sign: true,
        bump: 255,
        liquidityChange: { v: '4361705790000000' },
        liquidityGross: { v: '4361705790000000' },
        sqrtPrice: { v: '999400209944000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'B2Mq1fpJ2bZYxxtF4yz6nNvLJLaYzM3zQsHcs2oDqk3z'
      },
      {
        index: 1246,
        sign: false,
        bump: 255,
        liquidityChange: { v: '4361705790000000' },
        liquidityGross: { v: '4361705790000000' },
        sqrtPrice: { v: '1064278266283000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: 'B2Mq1fpJ2bZYxxtF4yz6nNvLJLaYzM3zQsHcs2oDqk3z'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 370
  },
  '5yKHz86cvHocaQnxv4mPJjftA4w7BbJzQQr5rG9miyZ3': {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: 23310,
        sign: true,
        bump: 255,
        liquidityChange: { v: '6155101826600024' },
        liquidityGross: { v: '6155101826600024' },
        sqrtPrice: { v: '3207339343598000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '562410792' },
        pool: '5yKHz86cvHocaQnxv4mPJjftA4w7BbJzQQr5rG9miyZ3'
      },
      {
        index: 23410,
        sign: false,
        bump: 255,
        liquidityChange: { v: '6155101826600024' },
        liquidityGross: { v: '6155101826600024' },
        sqrtPrice: { v: '3223415393157000000000000' },
        feeGrowthOutsideX: { v: '2168979359460704739' },
        feeGrowthOutsideY: { v: '22430823061828086771' },
        secondsPerLiquidityOutside: { v: '1168442390' },
        pool: '5yKHz86cvHocaQnxv4mPJjftA4w7BbJzQQr5rG9miyZ3'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: 23310,
        sign: true,
        bump: 255,
        liquidityChange: { v: '6155101826600024' },
        liquidityGross: { v: '6155101826600024' },
        sqrtPrice: { v: '3207339343598000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '562410792' },
        pool: '5yKHz86cvHocaQnxv4mPJjftA4w7BbJzQQr5rG9miyZ3'
      },
      {
        index: 23410,
        sign: false,
        bump: 255,
        liquidityChange: { v: '6155101826600024' },
        liquidityGross: { v: '6155101826600024' },
        sqrtPrice: { v: '3223415393157000000000000' },
        feeGrowthOutsideX: { v: '2168979359460704739' },
        feeGrowthOutsideY: { v: '22430823061828086771' },
        secondsPerLiquidityOutside: { v: '1168442390' },
        pool: '5yKHz86cvHocaQnxv4mPJjftA4w7BbJzQQr5rG9miyZ3'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 26620
  },
  '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU': {
    feeTier: { fee: '500000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [
      {
        index: -221815,
        sign: true,
        bump: 255,
        liquidityChange: { v: '3616973000000' },
        liquidityGross: { v: '3616973000000' },
        sqrtPrice: { v: '15261221000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '29684607040363478029' },
        secondsPerLiquidityOutside: { v: '57122901' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 18970,
        sign: true,
        bump: 255,
        liquidityChange: { v: '10573842000000' },
        liquidityGross: { v: '10573842000000' },
        sqrtPrice: { v: '2581711569119000000000000' },
        feeGrowthOutsideX: { v: '41835391873583484217' },
        feeGrowthOutsideY: { v: '366740766139530626592' },
        secondsPerLiquidityOutside: { v: '1080783730' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 19855,
        sign: true,
        bump: 255,
        liquidityChange: { v: '75694022099482856' },
        liquidityGross: { v: '75694022099482856' },
        sqrtPrice: { v: '2698511610109000000000000' },
        feeGrowthOutsideX: { v: '90366227983609758211' },
        feeGrowthOutsideY: { v: '604732016411919209962' },
        secondsPerLiquidityOutside: { v: '3986073928' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 19955,
        sign: false,
        bump: 255,
        liquidityChange: { v: '75694022099482856' },
        liquidityGross: { v: '75694022099482856' },
        sqrtPrice: { v: '2712037277880000000000000' },
        feeGrowthOutsideX: { v: '90436022260829966898' },
        feeGrowthOutsideY: { v: '608464081786638272106' },
        secondsPerLiquidityOutside: { v: '15477853623' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 21710,
        sign: true,
        bump: 252,
        liquidityChange: { v: '1377710121282197' },
        liquidityGross: { v: '1377710121282197' },
        sqrtPrice: { v: '2960759218781000000000000' },
        feeGrowthOutsideX: { v: '102898856340671924301' },
        feeGrowthOutsideY: { v: '842873099618635632937' },
        secondsPerLiquidityOutside: { v: '23243704702' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 21820,
        sign: true,
        bump: 255,
        liquidityChange: { v: '2817478296589199' },
        liquidityGross: { v: '2817478296589199' },
        sqrtPrice: { v: '2977087439529000000000000' },
        feeGrowthOutsideX: { v: '32803388925530316579' },
        feeGrowthOutsideY: { v: '309423542885219195466' },
        secondsPerLiquidityOutside: { v: '22428035571' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22080,
        sign: false,
        bump: 253,
        liquidityChange: { v: '1377710121282197' },
        liquidityGross: { v: '1377710121282197' },
        sqrtPrice: { v: '3016040273486000000000000' },
        feeGrowthOutsideX: { v: '108863819701037256029' },
        feeGrowthOutsideY: { v: '909506361273027819391' },
        secondsPerLiquidityOutside: { v: '23309580404' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22540,
        sign: true,
        bump: 254,
        liquidityChange: { v: '145990777000000' },
        liquidityGross: { v: '145990777000000' },
        sqrtPrice: { v: '3086209544857000000000000' },
        feeGrowthOutsideX: { v: '109988455812244196055' },
        feeGrowthOutsideY: { v: '960330730487464070321' },
        secondsPerLiquidityOutside: { v: '23388123143' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22655,
        sign: true,
        bump: 255,
        liquidityChange: { v: '20723007000000' },
        liquidityGross: { v: '20723007000000' },
        sqrtPrice: { v: '3104005474215000000000000' },
        feeGrowthOutsideX: { v: '199507023787308243075' },
        feeGrowthOutsideY: { v: '1888713488373468597841' },
        secondsPerLiquidityOutside: { v: '23621390835' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22955,
        sign: true,
        bump: 255,
        liquidityChange: { v: '23399093329980540' },
        liquidityGross: { v: '23399093329980540' },
        sqrtPrice: { v: '3150914146472000000000000' },
        feeGrowthOutsideX: { v: '147023807517582809886' },
        feeGrowthOutsideY: { v: '1342549586279066079742' },
        secondsPerLiquidityOutside: { v: '23559006417' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 23055,
        sign: false,
        bump: 255,
        liquidityChange: { v: '23399093329980540' },
        liquidityGross: { v: '23399093329980540' },
        sqrtPrice: { v: '3166707377729000000000000' },
        feeGrowthOutsideX: { v: '159049469971003259597' },
        feeGrowthOutsideY: { v: '1466073600671833930083' },
        secondsPerLiquidityOutside: { v: '23590291899' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 23165,
        sign: false,
        bump: 255,
        liquidityChange: { v: '145990777000000' },
        liquidityGross: { v: '145990777000000' },
        sqrtPrice: { v: '3184171377093000000000000' },
        feeGrowthOutsideX: { v: '165660869875825972583' },
        feeGrowthOutsideY: { v: '1541362495700530697464' },
        secondsPerLiquidityOutside: { v: '23599791638' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 23275,
        sign: false,
        bump: 253,
        liquidityChange: { v: '20723007000000' },
        liquidityGross: { v: '20723007000000' },
        sqrtPrice: { v: '3201731688248000000000000' },
        feeGrowthOutsideX: { v: '199507023787308243075' },
        feeGrowthOutsideY: { v: '1912838905889937577659' },
        secondsPerLiquidityOutside: { v: '23632137592' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 24025,
        sign: true,
        bump: 252,
        liquidityChange: { v: '7934855790000000' },
        liquidityGross: { v: '7934855790000000' },
        sqrtPrice: { v: '3324070017921000000000000' },
        feeGrowthOutsideX: { v: '191577431698029350026' },
        feeGrowthOutsideY: { v: '1885655369414589468441' },
        secondsPerLiquidityOutside: { v: '23630215857' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 24125,
        sign: false,
        bump: 249,
        liquidityChange: { v: '7934855790000000' },
        liquidityGross: { v: '7934855790000000' },
        sqrtPrice: { v: '3340731153092000000000000' },
        feeGrowthOutsideX: { v: '194954945789972089659' },
        feeGrowthOutsideY: { v: '1926909465087635031945' },
        secondsPerLiquidityOutside: { v: '23634782390' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 26930,
        sign: false,
        bump: 253,
        liquidityChange: { v: '2817478296589199' },
        liquidityGross: { v: '2817478296589199' },
        sqrtPrice: { v: '3843689371070000000000000' },
        feeGrowthOutsideX: { v: '226656567211072842586' },
        feeGrowthOutsideY: { v: '2592888606333496926505' },
        secondsPerLiquidityOutside: { v: '23899375358' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 29960,
        sign: false,
        bump: 253,
        liquidityChange: { v: '10573842000000' },
        liquidityGross: { v: '10573842000000' },
        sqrtPrice: { v: '4472399674561000000000000' },
        feeGrowthOutsideX: { v: '246729695628804024154' },
        feeGrowthOutsideY: { v: '3244659956666715671135' },
        secondsPerLiquidityOutside: { v: '121104998768' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 221810,
        sign: false,
        bump: 254,
        liquidityChange: { v: '3616973000000' },
        liquidityGross: { v: '3616973000000' },
        sqrtPrice: { v: '65509176333123237000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      }
    ],
    ticksCurrentSnapshot: [
      {
        index: -221815,
        sign: true,
        bump: 255,
        liquidityChange: { v: '3616973000000' },
        liquidityGross: { v: '3616973000000' },
        sqrtPrice: { v: '15261221000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '29684607040363478029' },
        secondsPerLiquidityOutside: { v: '57122901' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 18970,
        sign: true,
        bump: 255,
        liquidityChange: { v: '10573842000000' },
        liquidityGross: { v: '10573842000000' },
        sqrtPrice: { v: '2581711569119000000000000' },
        feeGrowthOutsideX: { v: '41835391873583484217' },
        feeGrowthOutsideY: { v: '366740766139530626592' },
        secondsPerLiquidityOutside: { v: '1080783730' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 19855,
        sign: true,
        bump: 255,
        liquidityChange: { v: '75694022099482856' },
        liquidityGross: { v: '75694022099482856' },
        sqrtPrice: { v: '2698511610109000000000000' },
        feeGrowthOutsideX: { v: '90366227983609758211' },
        feeGrowthOutsideY: { v: '604732016411919209962' },
        secondsPerLiquidityOutside: { v: '3986073928' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 19955,
        sign: false,
        bump: 255,
        liquidityChange: { v: '75694022099482856' },
        liquidityGross: { v: '75694022099482856' },
        sqrtPrice: { v: '2712037277880000000000000' },
        feeGrowthOutsideX: { v: '90436022260829966898' },
        feeGrowthOutsideY: { v: '608464081786638272106' },
        secondsPerLiquidityOutside: { v: '15477853623' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 21710,
        sign: true,
        bump: 252,
        liquidityChange: { v: '1377710121282197' },
        liquidityGross: { v: '1377710121282197' },
        sqrtPrice: { v: '2960759218781000000000000' },
        feeGrowthOutsideX: { v: '102898856340671924301' },
        feeGrowthOutsideY: { v: '842873099618635632937' },
        secondsPerLiquidityOutside: { v: '23243704702' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 21820,
        sign: true,
        bump: 255,
        liquidityChange: { v: '2817478296589199' },
        liquidityGross: { v: '2817478296589199' },
        sqrtPrice: { v: '2977087439529000000000000' },
        feeGrowthOutsideX: { v: '32803388925530316579' },
        feeGrowthOutsideY: { v: '309423542885219195466' },
        secondsPerLiquidityOutside: { v: '22428035571' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22080,
        sign: false,
        bump: 253,
        liquidityChange: { v: '1377710121282197' },
        liquidityGross: { v: '1377710121282197' },
        sqrtPrice: { v: '3016040273486000000000000' },
        feeGrowthOutsideX: { v: '108863819701037256029' },
        feeGrowthOutsideY: { v: '909506361273027819391' },
        secondsPerLiquidityOutside: { v: '23309580404' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22540,
        sign: true,
        bump: 254,
        liquidityChange: { v: '145990777000000' },
        liquidityGross: { v: '145990777000000' },
        sqrtPrice: { v: '3086209544857000000000000' },
        feeGrowthOutsideX: { v: '109988455812244196055' },
        feeGrowthOutsideY: { v: '960330730487464070321' },
        secondsPerLiquidityOutside: { v: '23388123143' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22655,
        sign: true,
        bump: 255,
        liquidityChange: { v: '20723007000000' },
        liquidityGross: { v: '20723007000000' },
        sqrtPrice: { v: '3104005474215000000000000' },
        feeGrowthOutsideX: { v: '199507023787308243075' },
        feeGrowthOutsideY: { v: '1888713488373468597841' },
        secondsPerLiquidityOutside: { v: '23621390835' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 22955,
        sign: true,
        bump: 255,
        liquidityChange: { v: '23399093329980540' },
        liquidityGross: { v: '23399093329980540' },
        sqrtPrice: { v: '3150914146472000000000000' },
        feeGrowthOutsideX: { v: '147023807517582809886' },
        feeGrowthOutsideY: { v: '1342549586279066079742' },
        secondsPerLiquidityOutside: { v: '23559006417' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 23055,
        sign: false,
        bump: 255,
        liquidityChange: { v: '23399093329980540' },
        liquidityGross: { v: '23399093329980540' },
        sqrtPrice: { v: '3166707377729000000000000' },
        feeGrowthOutsideX: { v: '159049469971003259597' },
        feeGrowthOutsideY: { v: '1466073600671833930083' },
        secondsPerLiquidityOutside: { v: '23590291899' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 23165,
        sign: false,
        bump: 255,
        liquidityChange: { v: '145990777000000' },
        liquidityGross: { v: '145990777000000' },
        sqrtPrice: { v: '3184171377093000000000000' },
        feeGrowthOutsideX: { v: '165660869875825972583' },
        feeGrowthOutsideY: { v: '1541362495700530697464' },
        secondsPerLiquidityOutside: { v: '23599791638' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 23275,
        sign: false,
        bump: 253,
        liquidityChange: { v: '20723007000000' },
        liquidityGross: { v: '20723007000000' },
        sqrtPrice: { v: '3201731688248000000000000' },
        feeGrowthOutsideX: { v: '199507023787308243075' },
        feeGrowthOutsideY: { v: '1912838905889937577659' },
        secondsPerLiquidityOutside: { v: '23632137592' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 24025,
        sign: true,
        bump: 252,
        liquidityChange: { v: '7934855790000000' },
        liquidityGross: { v: '7934855790000000' },
        sqrtPrice: { v: '3324070017921000000000000' },
        feeGrowthOutsideX: { v: '191577431698029350026' },
        feeGrowthOutsideY: { v: '1885655369414589468441' },
        secondsPerLiquidityOutside: { v: '23630215857' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 24125,
        sign: false,
        bump: 249,
        liquidityChange: { v: '7934855790000000' },
        liquidityGross: { v: '7934855790000000' },
        sqrtPrice: { v: '3340731153092000000000000' },
        feeGrowthOutsideX: { v: '194954945789972089659' },
        feeGrowthOutsideY: { v: '1926909465087635031945' },
        secondsPerLiquidityOutside: { v: '23634782390' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 26930,
        sign: false,
        bump: 253,
        liquidityChange: { v: '2817478296589199' },
        liquidityGross: { v: '2817478296589199' },
        sqrtPrice: { v: '3843689371070000000000000' },
        feeGrowthOutsideX: { v: '226656567211072842586' },
        feeGrowthOutsideY: { v: '2592888606333496926505' },
        secondsPerLiquidityOutside: { v: '23899375358' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 29960,
        sign: false,
        bump: 253,
        liquidityChange: { v: '10573842000000' },
        liquidityGross: { v: '10573842000000' },
        sqrtPrice: { v: '4472399674561000000000000' },
        feeGrowthOutsideX: { v: '246729695628804024154' },
        feeGrowthOutsideY: { v: '3244659956666715671135' },
        secondsPerLiquidityOutside: { v: '121104998768' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      },
      {
        index: 221810,
        sign: false,
        bump: 254,
        liquidityChange: { v: '3616973000000' },
        liquidityGross: { v: '3616973000000' },
        sqrtPrice: { v: '65509176333123237000000000000' },
        feeGrowthOutsideX: { v: '0' },
        feeGrowthOutsideY: { v: '0' },
        secondsPerLiquidityOutside: { v: '0' },
        pool: '6rvpVhL9fxm2WLMefNRaLwv6aNdivZadMi56teWfSkuU'
      }
    ],
    weeklyFactor: 0,
    currentTickIndex: 30870
  },
  BGz6pBLvc4nuGNsbXYoAE7z466kSjZaoXKJMnEkZWkyD: {
    feeTier: { fee: '100000000' },
    volumeX: 0,
    volumeY: 0,
    ticksPreviousSnapshot: [],
    ticksCurrentSnapshot: [],
    weeklyFactor: 0,
    currentTickIndex: -33
  }
}
