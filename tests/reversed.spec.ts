import * as anchor from '@project-serum/anchor'
import { Provider, Program, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey } from '@solana/web3.js'
import { assert } from 'chai'
import { createToken } from './testUtils'
import { Market, Pair, SEED, tou64, DENOMINATOR, TICK_LIMIT, Network } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { Decimal } from '@invariant-labs/sdk/src/market'

describe('reversed', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const admin = Keypair.generate()
  const market = new Market(
    Network.LOCAL,
    provider.wallet,
    connection,
    anchor.workspace.Amm.programId
  )
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  const protocolFee: Decimal = { v: fromFee(new BN(10000))}
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let programAuthority: PublicKey
  let nonce: number

  before(async () => {
    // Request airdrops
    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
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
  })
  it('#createState()', async () => {
    await market.createState(admin, protocolFee)
  })
  it('#createFeeTier()', async () => {
    await market.createFeeTier(feeTier, wallet)
  })
  it('#create()', async () => {
    // 0.6% / 10
    await market.create({
      pair,
      signer: admin,
      feeTier,
    })

    const createdPool = await market.get(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex == 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.v.eqn(0))
    assert.ok(createdPool.authority.equals(programAuthority))
    assert.equal(createdPool.nonce, nonce)

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every((v) => v == 0))
  })
  it('#swap() Y for X', async () => {
    // create ticks and owner
    for (let i = -100; i <= 90; i += 10) await market.createTick(pair, i, wallet)

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    const mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

    // Deposit
    const upperTick = 20
    const middleTick = 10
    const lowerTick = -10

    await market.createPositionList(positionOwner)
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      positionOwner
    )

    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: middleTick,
        upperTick: upperTick + 20,
        liquidityDelta
      },
      positionOwner
    )
    assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta.v))

    // Prepare swapper
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)

    const { tokenXReserve } = await market.get(pair)
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(amount))
    await tokenX.mintTo(tokenXReserve, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    // Swap
    const poolDataBefore = await market.get(pair)
    const reservesBefore = await market.getReserveBalances(pair, wallet)

    const targetPrice = DENOMINATOR.muln(110).divn(100)
    await market.swap(pair, false, amount, targetPrice, accountX, accountY, owner)

    // Check pool
    const poolData = await market.get(pair)
    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v.muln(2)))
    assert.equal(poolData.currentTickIndex, middleTick)
    assert.ok(poolData.sqrtPrice.v.gt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reservesAfter = await market.getReserveBalances(pair, wallet)
    const reserveXDelta = reservesBefore.x.sub(reservesAfter.x)
    const reserveYDelta = reservesAfter.y.sub(reservesBefore.y)

    assert.ok(amountX.eq(amount.subn(7)))
    assert.ok(amountY.eqn(0))
    assert.ok(reserveXDelta.eq(amount.subn(7)))
    assert.ok(reserveYDelta.eq(amount))

    assert.ok(poolData.feeGrowthGlobalX.v.eqn(0))
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(4042169)) // 0.6 % of amount - protocol fee
    assert.ok(poolData.feeProtocolTokenX.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenY.v.eq(new BN(598199800000)))

    // Check ticks
    const lowerTickData = await market.getTick(pair, lowerTick)
    const middleTickData = await market.getTick(pair, middleTick)
    const upperTickData = await market.getTick(pair, upperTick)

    assert.ok(upperTickData.liquidityChange.v.eq(liquidityDelta.v))
    assert.ok(middleTickData.liquidityChange.v.eq(liquidityDelta.v))
    assert.ok(lowerTickData.liquidityChange.v.eq(liquidityDelta.v))

    assert.ok(upperTickData.feeGrowthOutsideY.v.eqn(0))
    assert.ok(middleTickData.feeGrowthOutsideY.v.eqn(2700540))
    assert.ok(lowerTickData.feeGrowthOutsideY.v.eqn(0))
  })
})
