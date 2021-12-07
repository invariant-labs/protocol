import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { createToken, tou64 } from '../tests-staker/utils'
import { createToken as createTkn } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { signAndSend, toDecimal } from '../sdk-staker/lib/utils'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { assert } from 'chai'
import {
  fromFee,
  calculateFeeGrowthInside,
  calculateClaimAmount
} from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'

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
  let nonce: number
  let staker: Staker
  let market: Market
  let pool: PublicKey
  let amm: PublicKey
  let incentiveToken: Token
  let founderTokenAcc: PublicKey
  let incentiveTokenAcc: PublicKey
  let ownerTokenAcc: PublicKey
  let stakerAuthority: PublicKey
  let amount: BN
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    //create staker
    const [_mintAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [STAKER_SEED],
      program.programId
    )
    stakerAuthority = _mintAuthority
    nonce = _nonce
    staker = new Staker(connection, Network.LOCAL, provider.wallet, program.programId)

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(positionOwner.publicKey, 1e9),
      await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    ])

    //create token
    incentiveToken = await createToken({
      connection: connection,
      payer: wallet,
      mintAuthority: wallet.publicKey
    })
    //add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    //create taken acc for founder and staker
    founderTokenAcc = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAcc = await incentiveToken.createAccount(stakerAuthority)
    ownerTokenAcc = await incentiveToken.createAccount(positionOwner.publicKey)

    //mint to founder acc
    amount = new anchor.BN(5000 * 1e12)
    await incentiveToken.mintTo(founderTokenAcc, wallet, [], tou64(amount))

    //create amm and pool
    market = new Market(0, provider.wallet, connection, anchor.workspace.Amm.programId)

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    await market.createState(admin, protocolFee)
    await market.createFeeTier(feeTier, wallet)
    await market.create({
      pair,
      signer: admin
    })
    pool = await pair.getAddress(anchor.workspace.Amm.programId)
    amm = anchor.workspace.Amm.programId

    //create tokens
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('Claim', async () => {
    //create position
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

    //calculate fee growth inside
    const [fee_growth_inside_x, fee_growth_inside_y] = calculateFeeGrowthInside({
      tickUpper: tickUpper,
      tickLower: tickLower,
      tickCurrent: createdPool.currentTickIndex,
      feeGrowthGlobalX: createdPool.feeGrowthGlobalX,
      feeGrowthGlobalY: createdPool.feeGrowthGlobalY
    })

    //calculate claim amount
    const [tokens_owed_x_total, tokens_owed_y_total] = calculateClaimAmount({
      position: positionStruct,
      feeGrowthInsideX: { v: fee_growth_inside_x },
      feeGrowthInsideY: { v: fee_growth_inside_y }
    })

    assert.ok(tokens_owed_x_total.eq(new BN(5400000)))
    assert.ok(tokens_owed_y_total.eq(new BN(10800000)))
  })
})
