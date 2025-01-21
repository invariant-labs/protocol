import * as anchor from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { assert } from 'chai'
import {
  Market,
  Pair,
  calculatePriceSqrt,
  LIQUIDITY_DENOMINATOR,
  Network
} from '@invariant-labs/sdk'
import { Provider, BN } from '@project-serum/anchor'
import { Token, u64, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createToken, initMarket } from './testUtils'
import { fromFee, assertThrowsAsync, tou64 } from '@invariant-labs/sdk/src/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'

describe('remove pool', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = { fee: fromFee(new BN(20)), tickSpacing: 4 }
  let market: Market
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let initTick: number
  let xOwnerAmount: u64
  let yOwnerAmount: u64
  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    // Request airdrops
    await Promise.all([
      connection.requestAirdrop(wallet.publicKey, 1e9),
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])
    // Create pair
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('#init()', async () => {
    initTick = -23028
    await initMarket(market, [pair], admin, initTick)
  })

  it('#removeDefunctPool()', async () => {
    const poolState = await market.getPool(pair)

    await market.removeDefunctPool({ pair, admin: admin.publicKey }, admin)
    await assertThrowsAsync(market.getPool(pair), 'Error: Account does not exist')
    await assertThrowsAsync(
      market.program.account.tickmap.fetch(poolState.tickmap),
      'Error: Account does not exist'
    )

    await assertThrowsAsync(
      tokenX.getAccountInfo(poolState.tokenXReserve),
      'Error: Failed to find account'
    )
    await assertThrowsAsync(
      tokenY.getAccountInfo(poolState.tokenYReserve),
      'Error: Failed to find account'
    )
  })

  it('#removeDefunctPool() cannot as not admin', async () => {
    await market.createPool({
      pair,
      payer: admin,
      initTick
    })

    await assertThrowsAsync(
      market.removeDefunctPool(
        {
          pair,
          admin: positionOwner.publicKey
        },
        positionOwner
      ),
      'custom program error: 0x1787'
    )
  })

  it('#removeDefunctPool() cannot with existing position', async () => {
    await market.createPositionList(positionOwner.publicKey, positionOwner)

    // checks position list
    const positionList = await market.getPositionList(positionOwner.publicKey)
    assert.equal(positionList.head, 0)

    const lowerTick = -22980
    const upperTick = 0

    await market.createTick(
      {
        pair,
        index: lowerTick,
        payer: admin.publicKey
      },
      admin
    )

    await market.createTick(
      {
        pair,
        index: upperTick,
        payer: admin.publicKey
      },
      admin
    )

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    xOwnerAmount = tou64(1e10)
    yOwnerAmount = tou64(1e10)

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

    const liquidityDelta = { v: LIQUIDITY_DENOMINATOR.muln(10_000) }
    const positionIndex = 0
    await market.initPosition(
      {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick,
        upperTick,
        liquidityDelta,
        knownPrice: calculatePriceSqrt(initTick),
        slippage: { v: new BN(0) }
      },
      positionOwner
    )
    await market.getPosition(positionOwner.publicKey, positionIndex)

    await assertThrowsAsync(
      market.removeDefunctPool(
        {
          pair,
          admin: admin.publicKey
        },
        admin
      ),
      'custom program error: 0x178b'
    )
  })

  it('#removeDefunctPool() after removing all positions', async () => {
    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    await market.removePosition(
      {
        pair,
        index: 0,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount
      },
      positionOwner
    )
    const poolState = await market.getPool(pair)

    await market.removeDefunctPool({ pair, admin: admin.publicKey }, admin)
    await assertThrowsAsync(market.getPool(pair), 'Error: Account does not exist')
    await assertThrowsAsync(
      market.program.account.tickmap.fetch(poolState.tickmap),
      'Error: Account does not exist'
    )

    await assertThrowsAsync(
      tokenX.getAccountInfo(poolState.tokenXReserve),
      'Error: Failed to find account'
    )
    await assertThrowsAsync(
      tokenY.getAccountInfo(poolState.tokenYReserve),
      'Error: Failed to find account'
    )
  })
})
