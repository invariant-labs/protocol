import * as anchor from '@project-serum/anchor'
import { Provider, Program, BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { assertThrowsAsync, createToken, createUserWithTokens } from './testUtils'
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
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { toDecimal } from '@invariant-labs/sdk/src/utils'
import { Decimal } from '@invariant-labs/sdk/src/market'

describe('target', () => {
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
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let programAuthority: PublicKey
  let nonce: number

  before(async () => {
    // Request airdrops
    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9)
    ])
    // Create tokens
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin, protocolFee)
    await market.build()
    await market.createFeeTier(pair.feeTier, admin)
  })
  it('#create()', async () => {
    await market.create({
      pair,
      signer: admin
    })

    const createdPool = await market.get(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(pair.feeTier.fee))
    assert.equal(createdPool.tickSpacing, pair.feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex == 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.v.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every((v) => v == 0))
  })

  it('#swap by target', async () => {
    // Deposit
    const upperTick = 30
    const upperIx = await market.createTickInstruction(pair, upperTick, wallet.publicKey)
    await signAndSend(new Transaction().add(upperIx), [wallet], connection)

    const lowerTick = -30
    const lowerIx = await market.createTickInstruction(pair, lowerTick, wallet.publicKey)
    await signAndSend(new Transaction().add(lowerIx), [wallet], connection)

    assert.ok(await market.isInitialized(pair, lowerTick))
    assert.ok(await market.isInitialized(pair, upperTick))

    const mintAmount = new BN(10).pow(new BN(10))

    const { owner, userAccountX, userAccountY } = await createUserWithTokens(
      pair,
      connection,
      mintAuthority,
      mintAmount
    )
    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

    await market.initPosition(
      {
        pair,
        owner: owner.publicKey,
        userTokenX: userAccountX,
        userTokenY: userAccountY,
        lowerTick,
        upperTick,
        liquidityDelta
      },
      owner
    )

    assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta.v))

    // Create owner
    const swapper = Keypair.generate()
    await connection.requestAirdrop(swapper.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await tokenX.createAccount(swapper.publicKey)
    const accountY = await tokenY.createAccount(swapper.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(mintAmount))

    // Swap
    const poolDataBefore = await market.get(pair)
    const reservesBefore = await market.getReserveBalances(pair, wallet)

    await market.swap(
      {
        pair,
        XtoY: true,
        amount,
        knownPrice: poolDataBefore.sqrtPrice,
        slippage: toDecimal(1, 2),
        accountX,
        accountY,
        byAmountIn: false
      },
      swapper
    )

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

    assert.ok(amountX.eq(mintAmount.sub(amount).subn(8)))
    assert.ok(amountY.eq(amount))
    assert.ok(reserveXDelta.eq(amount.addn(8)))
    assert.ok(reserveYDelta.eq(amount))

    assert.ok(poolData.feeGrowthGlobalX.v.eqn(5405405)) // 0.6 % of amount - protocol fee
    assert.ok(poolData.feeGrowthGlobalY.v.eqn(0))
    assert.ok(poolData.feeProtocolTokenX.v.eq(new BN(600600600600)))
    assert.ok(poolData.feeProtocolTokenY.v.eqn(0))
  })
})
