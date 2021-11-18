import * as anchor from '@project-serum/anchor'
import { Provider, Program, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { assertThrowsAsync, createToken } from './testUtils'
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
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, Decimal } from '@invariant-labs/sdk/lib/market'

describe('withdraw', () => {
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
      feeTier
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
  it('#withdraw', async () => {
    // Deposit
    const upperTick = 10
    const upperIx = await market.createTickInstruction(pair, upperTick, wallet.publicKey)
    await signAndSend(new Transaction().add(upperIx), [wallet], connection)

    const lowerTick = -20
    const lowerIx = await market.createTickInstruction(pair, lowerTick, wallet.publicKey)
    await signAndSend(new Transaction().add(lowerIx), [wallet], connection)

    assert.ok(await market.isInitialized(pair, lowerTick))
    assert.ok(await market.isInitialized(pair, upperTick))

    const positionOwner = Keypair.generate()
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    const mintAmount = tou64(new BN(10).pow(new BN(10)))
    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

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

    assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    const owner = Keypair.generate()
    await connection.requestAirdrop(owner.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await tokenX.createAccount(owner.publicKey)
    const accountY = await tokenY.createAccount(owner.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    // Swap
    const poolDataBefore = await market.get(pair)
    const targetPrice = DENOMINATOR.muln(100).divn(110)
    const reservesBefore = await market.getReserveBalances(pair, wallet)

    await market.swap(pair, true, amount, targetPrice, accountX, accountY, owner)

    // Check pool
    const poolData = await market.get(pair)
    assert.ok(poolData.liquidity.v.eq(poolDataBefore.liquidity.v))
    assert.equal(poolData.currentTickIndex, lowerTick)
    assert.ok(poolData.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))

    // Check amounts and fees
    const amountX = (await tokenX.getAccountInfo(accountX)).amount
    const amountY = (await tokenY.getAccountInfo(accountY)).amount
    const reservesAfter = await market.getReserveBalances(pair, wallet)
    const reserveXDelta = reservesAfter.x.sub(reservesBefore.x)
    const reserveYDelta = reservesBefore.y.sub(reservesAfter.y)

    assert.ok(amountX.eqn(0))
    assert.ok(amountY.eq(amount.subn(7)))
    assert.ok(reserveXDelta.eq(amount))
    assert.ok(reserveYDelta.eq(amount.subn(7)))

    assert.ok(poolData.feeGrowthGlobalX.v.eqn(5400000)) // 0.6 % of amount - protocol fee
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenX.v.eq(new BN(600000013280)))
    assert.ok(poolData.feeProtocolTokenY.v.eqn(0))

    // Remove position
    const reservesBeforeRemove = await market.getReserveBalances(pair, wallet)

    const ix = await market.removePositionInstruction(
      pair,
      positionOwner.publicKey,
      0,
      userTokenXAccount,
      userTokenYAccount
    )
    await signAndSend(new Transaction().add(ix), [positionOwner], connection)

    // Check position after remove
    const positionList = await market.getPositionList(positionOwner.publicKey)
    assert.equal(positionList.head, 0)

    // Check amounts tokens
    const reservesAfterRemove = await market.getReserveBalances(pair, wallet)
    const expectedWithdrawnX = new BN(1493)
    const expectedWithdrawnY = new BN(6)
    const expectedFeeX = new BN(5)

    assert.ok(
      reservesBeforeRemove.x.sub(reservesAfterRemove.x).eq(expectedWithdrawnX.add(expectedFeeX))
    )
    assert.ok(reservesBeforeRemove.y.sub(reservesAfterRemove.y).eq(expectedWithdrawnY))

    assertThrowsAsync(market.getTick(pair, upperTick))
    assertThrowsAsync(market.getTick(pair, lowerTick))

    assert.isFalse(await market.isInitialized(pair, lowerTick))
    assert.isFalse(await market.isInitialized(pair, upperTick))
  })
})
