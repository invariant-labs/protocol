import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Market, Network, Pair, SEED, DENOMINATOR, TICK_LIMIT, tou64 } from '@invariant-labs/sdk'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createToken } from './testUtils'
import { assert } from 'chai'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'

describe('timestamp', () => {
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
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e11),
      await connection.requestAirdrop(admin.publicKey, 1e11)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin, { v: fromFee(new BN(10000)) })
    await market.createFeeTier(feeTier, admin)
  })
  it('#create()', async () => {
    const currentTimestamp = new BN(new Date().valueOf() / 1000).toString()
    await market.create({
      pair,
      signer: admin
    })

    const createdPool = await market.get(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex == 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.eqn(0))
    assert.ok(createdPool.secondsPerLiquidityGlobal.v.eqn(0))

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every(v => v == 0))
  })

  // TODO: why is this commented?
  // it('#timestamp', async () => {
  //     const mintAmount = tou64(new BN(10).pow(new BN(10)))

  //     const upperTick = 10
  //     await market.createTick(pair, upperTick, wallet)
  //     const midTick = -20
  //     await market.createTick(pair, midTick, wallet)
  //     const lowerTick = -30
  //     await market.createTick(pair, lowerTick, wallet)

  //     const positionOwner1 = Keypair.generate()
  //     await connection.requestAirdrop(positionOwner1.publicKey, 1e9)
  //     const user1TokenXAccount = await tokenX.createAccount(positionOwner1.publicKey)
  //     const user1TokenYAccount = await tokenY.createAccount(positionOwner1.publicKey)

  //     await tokenX.mintTo(user1TokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
  //     await tokenY.mintTo(user1TokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
  //     const liquidityDelta1 = { v: new BN(1000000).mul(DENOMINATOR)}

  //     await market.createPositionList(positionOwner1)
  //     await market.initPosition(
  //         {
  //             pair,
  //             owner: positionOwner1.publicKey,
  //             userTokenX: user1TokenXAccount,
  //             userTokenY: user1TokenYAccount,
  //             lowerTick: midTick,
  //             upperTick,
  //             liquidityDelta: liquidityDelta1
  //         },
  //         positionOwner1
  //     )

  //     assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta1.v))

  //     const positionOwner2 = Keypair.generate()
  //     await connection.requestAirdrop(positionOwner2.publicKey, 1e9)
  //     const user2TokenXAccount = await tokenX.createAccount(positionOwner2.publicKey)
  //     const user2TokenYAccount = await tokenY.createAccount(positionOwner2.publicKey)

  //     await tokenX.mintTo(user2TokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
  //     await tokenY.mintTo(user2TokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
  //     const liquidityDelta2 = { v: new BN(1000000).mul(DENOMINATOR)}

  //     await market.createPositionList(positionOwner2)

  //     await market.initPosition(
  //         {
  //             pair,
  //             owner: positionOwner2.publicKey,
  //             userTokenX: user2TokenXAccount,
  //             userTokenY: user2TokenYAccount,
  //             lowerTick,
  //             upperTick: midTick,
  //             liquidityDelta: liquidityDelta2
  //         },
  //         positionOwner2
  //     )

  //     assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta1.v))

  //     const swapper = Keypair.generate()
  //     await connection.requestAirdrop(swapper.publicKey, 1e10)

  //     const amount = new BN(1500)
  //     const accountX = await tokenX.createAccount(swapper.publicKey)
  //     const accountY = await tokenY.createAccount(swapper.publicKey)

  //     await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

  //     const poolDataBefore = await market.get(pair)
  //     const targetPrice = DENOMINATOR.muln(100).divn(110)
  //     const reservesBeforeSwap = await market.getReserveBalances(pair, wallet)

  //     await market.swap(pair, true, amount, targetPrice, accountX, accountY, swapper)

  //     const poolDataAfter = await market.get(pair)
  //     assert.ok(poolDataAfter.liquidity.v.eq(liquidityDelta2.v))
  //     assert.ok(poolDataAfter.currentTickIndex == lowerTick)
  //     assert.ok(poolDataAfter.sqrtPrice.v.lt(poolDataBefore.sqrtPrice.v))
  // })
})
