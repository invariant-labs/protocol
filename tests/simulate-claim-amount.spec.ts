import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Network, Pair, DENOMINATOR } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { createToken as createTkn, createToken } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { signAndSend, toDecimal } from '../sdk-staker/lib/utils'
import { assert } from 'chai'
import { fromFee, calculateClaimAmount, tou64 } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/src/market'

describe('Withdraw tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const incentiveAccount = Keypair.generate()
  const positionOwner = Keypair.generate()
  const founderAccount = Keypair.generate()
  const admin = Keypair.generate()
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  let market: Market
  let pool: PublicKey
  let amm: PublicKey
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
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin, protocolFee)
    await market.createFeeTier(feeTier, admin)
    await market.create({
      pair,
      signer: admin
    })

    pool = await pair.getAddress(anchor.workspace.Amm.programId)
    amm = anchor.workspace.Amm.programId

    // create tokens
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })
  it('Claim', async () => {
    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 50
    const lowerTick = -50

    await market.createTick(pair, upperTick, wallet)
    await market.createTick(pair, lowerTick, wallet)

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

    // Create owner
    const trader = Keypair.generate()
    await connection.requestAirdrop(trader.publicKey, 1e9)
    const amount = new BN(10000)

    const accountX = await tokenX.createAccount(trader.publicKey)
    const accountY = await tokenY.createAccount(trader.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(amount))
    // Swap
    const poolDataBefore = await market.get(pair)

    const tx = await market.swapTransaction({
      pair,
      XtoY: true,
      amount: new BN(1000),
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    })
    await signAndSend(tx, [trader], connection)
    const tx2 = await market.swapTransaction({
      pair,
      XtoY: false,
      amount: new BN(2000),
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    })
    await signAndSend(tx2, [trader], connection)
    const index = 0
    const positionStruct = await market.getPosition(positionOwner.publicKey, index)
    const tickUpper = await market.getTick(pair, 50)
    const tickLower = await market.getTick(pair, -50)
    const createdPool = await market.get(pair)

    // calculate claim amount
    const [tokens_owed_x_total, tokens_owed_y_total] = calculateClaimAmount({
      position: positionStruct,
      tickLower: tickLower,
      tickUpper: tickUpper,
      tickCurrent: createdPool.currentTickIndex,
      feeGrowthGlobalX: createdPool.feeGrowthGlobalX,
      feeGrowthGlobalY: createdPool.feeGrowthGlobalY
    })
    // assert.ok(tokens_owed_x_total.eq(new BN(5400000000000)))
    // assert.ok(tokens_owed_y_total.eq(new BN(10800000000000)))
  })
})
