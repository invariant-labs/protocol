import * as anchor from '@project-serum/anchor'
import { Provider, Program, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'
import {
  Market,
  Pair,
  SEED,
  tou64,
  DENOMINATOR,
  signAndSend,
  TICK_LIMIT,
  Network
} from '@invariant-labs/sdk'
import { FeeTier, Decimal } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { calculateAveragePrice, SimulateSwapPrice, toDecimal } from '@invariant-labs/sdk/src/utils'

describe('simulate-swap', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let programAuthority: PublicKey
  let nonce: number

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    const swaplineProgram = anchor.workspace.Amm as Program
    const [_programAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(SEED)],
      swaplineProgram.programId
    )
    nonce = _nonce
    programAuthority = _programAuthority

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin, protocolFee)
    await market.createFeeTier(feeTier, admin)
  })
  it('#create()', async () => {
    await market.create({ pair, signer: admin, initTick: 1000 })

    const createdPool = await market.get(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(new BN(1051268468360)))
    assert.ok(createdPool.currentTickIndex == 1000)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v == 0))
  })
  it('#swap()', async () => {
    for (let i = 900; i <= 1010; i += 10) await market.createTick(pair, i, wallet)

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    const mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    await market.createPositionList(positionOwner)
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: 910,
        upperTick: 960,
        liquidityDelta: { v: new BN(1550000).mul(DENOMINATOR) }
      },
      positionOwner
    )
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: 950,
        upperTick: 990,
        liquidityDelta: { v: new BN(1220000).mul(DENOMINATOR) }
      },
      positionOwner
    )
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: 980,
        upperTick: 1010,
        liquidityDelta: { v: new BN(1970000).mul(DENOMINATOR) }
      },
      positionOwner
    )

    const swapper = Keypair.generate()
    await connection.requestAirdrop(swapper.publicKey, 1e9)
    const amount = new BN(2000)

    const accountX = await tokenX.createAccount(swapper.publicKey)
    const accountY = await tokenY.createAccount(swapper.publicKey)

    const { tokenYReserve } = await market.get(pair)
    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    const poolDataBefore = await market.get(pair)
    const reservesBefore = await market.getReserveBalances(pair, wallet)
    const tick = await market.getTick(pair, 1000)
    const tickmap = await market.getTickmap(pair)
    const simulateSwapPriceParameters: SimulateSwapPrice = {
      xToY: true,
      byAmountIn: true,
      swapAmount: amount,
      currentPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      tickmap,
      pool: poolDataBefore,
      market: market,
      pair: pair
    }

    const estimatedMeanPrice = calculateAveragePrice(simulateSwapPriceParameters)
    assert.ok(estimatedMeanPrice.v.eq(new BN(1103994154149)))
  })
})
