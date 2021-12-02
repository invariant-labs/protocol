import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { eqDecimal, createToken, tou64 } from './utils'
import { createToken as createTkn } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { signAndSend } from '../sdk-staker/lib/utils'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'

describe('Stake tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
  let stakerAuthority: PublicKey
  const mintAuthority = Keypair.generate()
  const incentiveAccount = Keypair.generate()
  const founderAccount = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  let nonce: number
  let staker: Staker
  let market: Market
  let pool: PublicKey
  let amm: PublicKey
  let incentiveToken: Token
  let founderTokenAcc: PublicKey
  let incentiveTokenAcc: PublicKey
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

    //mint to founder acc
    amount = new anchor.BN(100 * 1e6)
    await incentiveToken.mintTo(founderTokenAcc, wallet, [], tou64(amount))

    //create amm and pool

    market = new Market(0, provider.wallet, connection, anchor.workspace.Amm.programId)

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool
    const fee = 600
    const tickSpacing = 10

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    await market.createState(admin, protocolFee)
    await market.createFeeTier(feeTier, admin)
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

  it('Stake', async () => {
    //create incentive
    const seconds = new Date().valueOf() / 1000
    const currenTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime = currenTime.add(new BN(0))
    const endTime = currenTime.add(new BN(31_000_000))

    const ix = await staker.createIncentiveInstruction({
      reward,
      startTime,
      endTime,
      incentive: incentiveAccount,
      pool: pool,
      founder: founderAccount,
      incentiveTokenAcc: incentiveTokenAcc,
      founderTokenAcc: founderTokenAcc,
      amm: amm
    })
    await signAndSend(new Transaction().add(ix), [incentiveAccount, founderAccount], connection)

    //create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 10
    const lowerTick = -20

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

    let index = 0

    const { positionAddress: position, positionBump: bump } = await market.getPositionAddress(
      positionOwner.publicKey,
      index
    )
    let positionStructBefore = await market.getPosition(positionOwner.publicKey, index)
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    //stake
    const ixUpdate = await market.updateSecondsPerLiquidityInstruction({
      pair: pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index
    })

    const ixStake = await staker.stakeInstruction({
      pool: poolAddress,
      id: positionId,
      index: index,
      position: position,
      incentive: incentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      amm: amm
    })
    await signAndSend(new Transaction().add(ixUpdate).add(ixStake), [positionOwner], connection)

    const stake = await staker.getStake(incentiveAccount.publicKey, poolAddress, positionId)
    let positionStructAfter = await market.getPosition(positionOwner.publicKey, index)
    const liquidity: Decimal = { v: new BN(liquidityDelta.v) }

    assert.ok(stake.position.equals(position))
    assert.ok(stake.incentive.equals(incentiveAccount.publicKey))
    assert.ok(
      eqDecimal(stake.secondsPerLiquidityInitial, positionStructAfter.secondsPerLiquidityInside)
    )
    assert.ok(eqDecimal(stake.liquidity, liquidity))
  })
})
