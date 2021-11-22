import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Staker as StakerIdl } from '../sdk-staker/src/idl/staker'
import { Network, Staker } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { Decimal } from '../sdk-staker/src/staker'
import { STAKER_SEED } from '../sdk-staker/src/utils'
import { createToken, tou64, getTime } from './utils'
import { createToken as createTkn } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { signAndSend } from '../sdk-staker/lib/utils'
import { DENOMINATOR } from '@invariant-labs/sdk'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { sleep } from '@invariant-labs/sdk'

describe('Withdraw tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const program = anchor.workspace.Staker as Program<StakerIdl>
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  let stakerAuthority: PublicKey
  const mintAuthority = Keypair.generate()
  let nonce: number
  let staker: Staker
  let market
  let pool
  let amm
  let incentiveAccount
  let incentiveToken
  let founderAccount
  let founderTokenAcc
  let incentiveTokenAcc
  let ownerTokenAcc
  let amount
  let pair
  let positionOwner
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

    incentiveAccount = Keypair.generate()
    positionOwner = Keypair.generate()
    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(positionOwner.publicKey, 1e9),
      await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    ])

    // create founder account
    founderAccount = Keypair.generate()
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
    amount = new anchor.BN(100 * 1e12)
    await incentiveToken.mintTo(founderTokenAcc, wallet, [], tou64(amount))

    //create amm and pool
    const admin = Keypair.generate()
    market = new Market(0, provider.wallet, connection, anchor.workspace.Amm.programId)

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey)

    // create pool

    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    await market.createFeeTier(feeTier, wallet)
    await market.create({
      pair,
      signer: admin,
      feeTier
    })
    pool = await pair.getAddress(anchor.workspace.Amm.programId)
    amm = anchor.workspace.Amm.programId

    //create tokens
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })

  it('Withdraw', async () => {
    //create incentive

    const currenTime = getTime()
    const reward: Decimal = { v: new BN(100).mul(DENOMINATOR) }
    const startTime = currenTime.add(new BN(0))
    const endTime = currenTime.add(new BN(40000))

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
    const lowerTick = -30

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

    //stake
    const ixUpdate = await market.updateSecondsPerLiquidityInstruction({
      pair: pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      postion: position,
      index
    })

    const ixStake = await staker.stakeInstruction({
      index: index,
      position: position,
      incentive: incentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      amm: amm
    })
    await signAndSend(new Transaction().add(ixUpdate).add(ixStake), [positionOwner], connection)

    // Create owner
    const trader = Keypair.generate()
    await connection.requestAirdrop(trader.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await tokenX.createAccount(trader.publicKey)
    const accountY = await tokenY.createAccount(trader.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    await sleep(4000)

    // Swap
    const targetPrice = DENOMINATOR.muln(100).divn(110)

    const tx = await market.swapTransaction(
      pair,
      true,
      amount,
      targetPrice,
      accountX,
      accountY,
      trader.publicKey
    )
    await signAndSend(tx, [trader], connection)

    //withdraw
    const ixWithdraw = await staker.withdrawInstruction({
      incentive: incentiveAccount.publicKey,
      position: position,
      owner: positionOwner.publicKey,
      incentiveTokenAcc: incentiveTokenAcc,
      ownerTokenAcc: ownerTokenAcc,
      amm: amm,
      index: index,
      nonce: nonce
    })
    await signAndSend(new Transaction().add(ixUpdate).add(ixWithdraw), [positionOwner], connection)

    const balanceAfter = (await incentiveToken.getAccountInfo(ownerTokenAcc)).amount
    console.log(balanceAfter.toString())
    const rew = new BN(15000000000)
    assert.ok(rew.eq(balanceAfter))
  })
})
