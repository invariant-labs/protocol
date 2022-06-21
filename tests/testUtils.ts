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
import { ApyPoolParams } from '@invariant-labs/sdk/lib/utils'

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

export const dataApy: ApyPoolParams = {
  feeTier: { fee: new BN('b2d05e00', 'hex') },
  volumeX: 0,
  volumeY: 100000000,
  ticksPreviousSnapshot: [
    {
      index: -23550,
      sign: true,
      bump: 249,
      liquidityChange: { v: new BN('02d1c1a563edbe65', 'hex') },
      liquidityGross: { v: new BN('02d1c1a563edbe65', 'hex') },
      sqrtPrice: { v: new BN('413c4b06c166eb93c000', 'hex') },
      feeGrowthOutsideX: { v: new BN('4544f377d876ce6c23', 'hex') },
      feeGrowthOutsideY: { v: new BN('047f4d3b047bd73a21', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('5fa579', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -23040,
      sign: true,
      bump: 255,
      liquidityChange: { v: new BN('02b350b64e63d028', 'hex') },
      liquidityGross: { v: new BN('02b350b64e63d028', 'hex') },
      sqrtPrice: { v: new BN('42eb9ad66f1962502000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -13560,
      sign: false,
      bump: 255,
      liquidityChange: { v: new BN('02d1c1a563edbe65', 'hex') },
      liquidityGross: { v: new BN('02d1c1a563edbe65', 'hex') },
      sqrtPrice: { v: new BN('6b7fad71fb273b6c3000', 'hex') },
      feeGrowthOutsideX: { v: new BN('01848b7fc2aca555fb', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('3544ed', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -9690,
      sign: false,
      bump: 255,
      liquidityChange: { v: new BN('02b350b64e63d028', 'hex') },
      liquidityGross: { v: new BN('02b350b64e63d028', 'hex') },
      sqrtPrice: { v: new BN('82728375f12782274000', 'hex') },
      feeGrowthOutsideX: { v: new BN('70cd1f1cc611e1cf', 'hex') },
      feeGrowthOutsideY: { v: new BN('39b7a98d6b75312a', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('5fa579', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -6720,
      sign: true,
      bump: 255,
      liquidityChange: { v: new BN('a3fa3bf1b23293', 'hex') },
      liquidityGross: { v: new BN('a3fa3bf1b23293', 'hex') },
      sqrtPrice: { v: new BN('9754726db32b7273b000', 'hex') },
      feeGrowthOutsideX: { v: new BN('70cd1f1cc611e1cf', 'hex') },
      feeGrowthOutsideY: { v: new BN('39b7a98d6b75312a', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('5fa579', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -6660,
      sign: true,
      bump: 252,
      liquidityChange: { v: new BN('025d12dad50ea041', 'hex') },
      liquidityGross: { v: new BN('025d12dad50ea041', 'hex') },
      sqrtPrice: { v: new BN('97c8d64600848589d000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: 23040,
      sign: false,
      bump: 255,
      liquidityChange: { v: new BN('a3fa3bf1b23293', 'hex') },
      liquidityGross: { v: new BN('a3fa3bf1b23293', 'hex') },
      sqrtPrice: { v: new BN('029e12dadf1a00d40fd000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: 30210,
      sign: false,
      bump: 253,
      liquidityChange: { v: new BN('025d12dad50ea041', 'hex') },
      liquidityGross: { v: new BN('025d12dad50ea041', 'hex') },
      sqrtPrice: { v: new BN('03befac15258ffa9b36000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    }
  ],
  ticksCurrentSnapshot: [
    {
      index: -23550,
      sign: true,
      bump: 249,
      liquidityChange: { v: new BN('02d1c1a563edbe65', 'hex') },
      liquidityGross: { v: new BN('02d1c1a563edbe65', 'hex') },
      sqrtPrice: { v: new BN('413c4b06c166eb93c000', 'hex') },
      feeGrowthOutsideX: { v: new BN('4544f377d876ce6c23', 'hex') },
      feeGrowthOutsideY: { v: new BN('047f4d3b047bd73a21', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('5fa579', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -23040,
      sign: true,
      bump: 255,
      liquidityChange: { v: new BN('02b350b64e63d028', 'hex') },
      liquidityGross: { v: new BN('02b350b64e63d028', 'hex') },
      sqrtPrice: { v: new BN('42eb9ad66f1962502000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -13560,
      sign: false,
      bump: 255,
      liquidityChange: { v: new BN('02d1c1a563edbe65', 'hex') },
      liquidityGross: { v: new BN('02d1c1a563edbe65', 'hex') },
      sqrtPrice: { v: new BN('6b7fad71fb273b6c3000', 'hex') },
      feeGrowthOutsideX: { v: new BN('01848b7fc2aca555fb', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('3544ed', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -9690,
      sign: false,
      bump: 255,
      liquidityChange: { v: new BN('02b350b64e63d028', 'hex') },
      liquidityGross: { v: new BN('02b350b64e63d028', 'hex') },
      sqrtPrice: { v: new BN('82728375f12782274000', 'hex') },
      feeGrowthOutsideX: { v: new BN('70cd1f1cc611e1cf', 'hex') },
      feeGrowthOutsideY: { v: new BN('39b7a98d6b75312a', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('5fa579', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -6720,
      sign: true,
      bump: 255,
      liquidityChange: { v: new BN('a3fa3bf1b23293', 'hex') },
      liquidityGross: { v: new BN('a3fa3bf1b23293', 'hex') },
      sqrtPrice: { v: new BN('9754726db32b7273b000', 'hex') },
      feeGrowthOutsideX: { v: new BN('70cd1f1cc611e1cf', 'hex') },
      feeGrowthOutsideY: { v: new BN('39b7a98d6b75312a', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('5fa579', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: -6660,
      sign: true,
      bump: 252,
      liquidityChange: { v: new BN('025d12dad50ea041', 'hex') },
      liquidityGross: { v: new BN('025d12dad50ea041', 'hex') },
      sqrtPrice: { v: new BN('97c8d64600848589d000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: 23040,
      sign: false,
      bump: 255,
      liquidityChange: { v: new BN('a3fa3bf1b23293', 'hex') },
      liquidityGross: { v: new BN('a3fa3bf1b23293', 'hex') },
      sqrtPrice: { v: new BN('029e12dadf1a00d40fd000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    },
    {
      index: 30210,
      sign: false,
      bump: 253,
      liquidityChange: { v: new BN('025d12dad50ea041', 'hex') },
      liquidityGross: { v: new BN('025d12dad50ea041', 'hex') },
      sqrtPrice: { v: new BN('03befac15258ffa9b36000', 'hex') },
      feeGrowthOutsideX: { v: new BN('00', 'hex') },
      feeGrowthOutsideY: { v: new BN('00', 'hex') },
      secondsPerLiquidityOutside: { v: new BN('00', 'hex') },
      pool: new PublicKey('0')
    }
  ],
  weeklyFactor: 0.0001722669807333221,
  currentTickIndex: -14580
}

//let temp = {"AvNeVrKZy1FaEG9suboRXNPgmnMwomiU5EvkF6jGxGrX":{"feeTier":{"fee":"b2d05e00"},"volumeX":0,"volumeY":100000000,"ticksPreviousSnapshot":[{"index":-23550,"sign":true,"bump":249,"liquidityChange":{"v":"02d1c1a563edbe65"},"liquidityGross":{"v":"02d1c1a563edbe65"},"sqrtPrice":{"v":"413c4b06c166eb93c000"},"feeGrowthOutsideX":{"v":"4544f377d876ce6c23"},"feeGrowthOutsideY":{"v":"047f4d3b047bd73a21"},"secondsPerLiquidityOutside":{"v":"5fa579"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-23040,"sign":true,"bump":255,"liquidityChange":{"v":"02b350b64e63d028"},"liquidityGross":{"v":"02b350b64e63d028"},"sqrtPrice":{"v":"42eb9ad66f1962502000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-13560,"sign":false,"bump":255,"liquidityChange":{"v":"02d1c1a563edbe65"},"liquidityGross":{"v":"02d1c1a563edbe65"},"sqrtPrice":{"v":"6b7fad71fb273b6c3000"},"feeGrowthOutsideX":{"v":"01848b7fc2aca555fb"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"3544ed"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-9690,"sign":false,"bump":255,"liquidityChange":{"v":"02b350b64e63d028"},"liquidityGross":{"v":"02b350b64e63d028"},"sqrtPrice":{"v":"82728375f12782274000"},"feeGrowthOutsideX":{"v":"70cd1f1cc611e1cf"},"feeGrowthOutsideY":{"v":"39b7a98d6b75312a"},"secondsPerLiquidityOutside":{"v":"5fa579"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-6720,"sign":true,"bump":255,"liquidityChange":{"v":"a3fa3bf1b23293"},"liquidityGross":{"v":"a3fa3bf1b23293"},"sqrtPrice":{"v":"9754726db32b7273b000"},"feeGrowthOutsideX":{"v":"70cd1f1cc611e1cf"},"feeGrowthOutsideY":{"v":"39b7a98d6b75312a"},"secondsPerLiquidityOutside":{"v":"5fa579"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-6660,"sign":true,"bump":252,"liquidityChange":{"v":"025d12dad50ea041"},"liquidityGross":{"v":"025d12dad50ea041"},"sqrtPrice":{"v":"97c8d64600848589d000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":23040,"sign":false,"bump":255,"liquidityChange":{"v":"a3fa3bf1b23293"},"liquidityGross":{"v":"a3fa3bf1b23293"},"sqrtPrice":{"v":"029e12dadf1a00d40fd000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":30210,"sign":false,"bump":253,"liquidityChange":{"v":"025d12dad50ea041"},"liquidityGross":{"v":"025d12dad50ea041"},"sqrtPrice":{"v":"03befac15258ffa9b36000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}}],"ticksCurrentSnapshot":[{"index":-23550,"sign":true,"bump":249,"liquidityChange":{"v":"02d1c1a563edbe65"},"liquidityGross":{"v":"02d1c1a563edbe65"},"sqrtPrice":{"v":"413c4b06c166eb93c000"},"feeGrowthOutsideX":{"v":"4544f377d876ce6c23"},"feeGrowthOutsideY":{"v":"047f4d3b047bd73a21"},"secondsPerLiquidityOutside":{"v":"5fa579"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-23040,"sign":true,"bump":255,"liquidityChange":{"v":"02b350b64e63d028"},"liquidityGross":{"v":"02b350b64e63d028"},"sqrtPrice":{"v":"42eb9ad66f1962502000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-13560,"sign":false,"bump":255,"liquidityChange":{"v":"02d1c1a563edbe65"},"liquidityGross":{"v":"02d1c1a563edbe65"},"sqrtPrice":{"v":"6b7fad71fb273b6c3000"},"feeGrowthOutsideX":{"v":"01848b7fc2aca555fb"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"3544ed"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-9690,"sign":false,"bump":255,"liquidityChange":{"v":"02b350b64e63d028"},"liquidityGross":{"v":"02b350b64e63d028"},"sqrtPrice":{"v":"82728375f12782274000"},"feeGrowthOutsideX":{"v":"70cd1f1cc611e1cf"},"feeGrowthOutsideY":{"v":"39b7a98d6b75312a"},"secondsPerLiquidityOutside":{"v":"5fa579"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-6720,"sign":true,"bump":255,"liquidityChange":{"v":"a3fa3bf1b23293"},"liquidityGross":{"v":"a3fa3bf1b23293"},"sqrtPrice":{"v":"9754726db32b7273b000"},"feeGrowthOutsideX":{"v":"70cd1f1cc611e1cf"},"feeGrowthOutsideY":{"v":"39b7a98d6b75312a"},"secondsPerLiquidityOutside":{"v":"5fa579"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":-6660,"sign":true,"bump":252,"liquidityChange":{"v":"025d12dad50ea041"},"liquidityGross":{"v":"025d12dad50ea041"},"sqrtPrice":{"v":"97c8d64600848589d000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":23040,"sign":false,"bump":255,"liquidityChange":{"v":"a3fa3bf1b23293"},"liquidityGross":{"v":"a3fa3bf1b23293"},"sqrtPrice":{"v":"029e12dadf1a00d40fd000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}},{"index":30210,"sign":false,"bump":253,"liquidityChange":{"v":"025d12dad50ea041"},"liquidityGross":{"v":"025d12dad50ea041"},"sqrtPrice":{"v":"03befac15258ffa9b36000"},"feeGrowthOutsideX":{"v":"00"},"feeGrowthOutsideY":{"v":"00"},"secondsPerLiquidityOutside":{"v":"00"},"pool":{"_bn":"936570e58056596455bbb22631e5fcfdd7ac1978ba3a6a6a705b79acc211225c"}}],"weeklyFactor":0.0001722669807333221,"currentTickIndex":-14580}
