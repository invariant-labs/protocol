import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair, sleep, PRICE_DENOMINATOR, LIQUIDITY_DENOMINATOR } from '@invariant-labs/sdk'
import { Network } from '../staker-sdk/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { createToken, getTime, signAndSend, almostEqual } from './testUtils'
import { createToken as createTkn, initMarket } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { toDecimal } from '../staker-sdk/lib/utils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, TransferPositionOwnership } from '@invariant-labs/sdk/lib/market'
import { InitPosition, Swap, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { CreateIncentive, CreateStake, Withdraw, Decimal, Staker } from '../staker-sdk/src/staker'
import { assert } from 'chai'
import { tou64 } from '@invariant-labs/sdk/src/utils'

describe('Withdraw with transfer position ownership', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const incentiveAccount = Keypair.generate()
  const positionOwner = Keypair.generate()
  const founderAccount = Keypair.generate()
  const positionRecipient = Keypair.generate()
  const admin = Keypair.generate()
  const epsilon = new BN(100)
  let nonce: number
  let staker: Staker
  let market: Market
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAccount: PublicKey
  let incentiveTokenAccount: Keypair
  let positionRecipientTokenAccount: PublicKey
  let amount: BN
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    // create staker

    staker = await Staker.build(Network.LOCAL, provider.wallet, connection)

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9),
      connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    ])

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()
    positionRecipientTokenAccount = await incentiveToken.createAccount(positionRecipient.publicKey)

    // mint to founder acc
    amount = new anchor.BN(5000 * 1e12)
    await incentiveToken.mintTo(founderTokenAccount, wallet, [], tou64(amount))

    // create invariant and pool
    market = await Market.build(
      0,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    const tokens = await Promise.all([
      createTkn(connection, wallet, mintAuthority),
      createTkn(connection, wallet, mintAuthority),
      connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool
    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
    invariant = anchor.workspace.Invariant.programId

    // create tokens
  })

  it('#init()', async () => {
    await initMarket(market, [pair], admin)
    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
  })

  it('Withdraw', async () => {
    // create incentive
    const currentTime = getTime()
    const reward: Decimal = { v: new BN(1000) }
    const startTime = { v: currentTime.add(new BN(0)) }
    const endTime = { v: currentTime.add(new BN(20)) }

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime,
      endTime,
      pool,
      founder: founderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: founderTokenAccount,
      invariant
    }
    const createTx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        incentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      createTx,
      [founderAccount, incentiveAccount, incentiveTokenAccount],
      staker.connection
    )
    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 10
    const lowerTick = -30

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(2000000000000).mul(LIQUIDITY_DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownPrice: { v: PRICE_DENOMINATOR },
      slippage: { v: new BN(0) }
    }
    await market.initPosition(initPositionVars, positionOwner)

    const index = 0

    const { positionAddress: position } = await market.getPositionAddress(
      positionOwner.publicKey,
      index
    )
    // wait for some seconds per liquidity
    await sleep(10000)

    const positionStructBefore = await market.getPosition(positionOwner.publicKey, index)
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    // stake
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: positionId,
      index,
      position,
      incentive: incentiveAccount.publicKey,
      owner: positionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    const updateIx = await market.updateSecondsPerLiquidityInstruction(update)
    const stakeIx = await staker.createStakeIx(createStake)
    const tx = new Transaction().add(updateIx).add(stakeIx)

    await signAndSend(tx, [positionOwner], staker.connection)

    //change ownership

    // prepare recipient
    await connection.requestAirdrop(positionRecipient.publicKey, 1e9)
    await sleep(2000)
    await market.createPositionList(positionRecipient.publicKey, positionRecipient)

    const transferPositionOwnershipVars: TransferPositionOwnership = {
      index: index,
      owner: positionOwner.publicKey,
      recipient: positionRecipient.publicKey
    }
    await market.transferPositionOwnership(transferPositionOwnershipVars, positionOwner)

    const recipientPosition = await market.getPosition(positionRecipient.publicKey, 0)
    const recipientPositionId = recipientPosition.id

    const { positionAddress: recipientPositionAddress } = await market.getPositionAddress(
      positionRecipient.publicKey,
      index
    )

    // Create trader
    const trader = Keypair.generate()
    await connection.requestAirdrop(trader.publicKey, 1e9)
    const amount = new BN(1000)

    const accountX = await tokenX.createAccount(trader.publicKey)
    const accountY = await tokenY.createAccount(trader.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))

    //Swap
    const poolDataBefore = await market.getPool(pair)

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount,
      estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    }

    await market.swap(swapVars, trader)

    await sleep(10000)

    const updateRecipient: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionRecipient.publicKey,
      signer: positionRecipient.publicKey,
      lowerTickIndex: lowerTick,
      upperTickIndex: upperTick,
      index
    }
    // withdraw
    const withdraw: Withdraw = {
      incentive: incentiveAccount.publicKey,
      pool: poolAddress,
      id: recipientPositionId,
      position: recipientPositionAddress,
      owner: positionRecipient.publicKey,
      incentiveTokenAccount: incentiveTokenAccount.publicKey,
      ownerTokenAcc: positionRecipientTokenAccount,
      index
    }
    const updateRecipientIx = await market.updateSecondsPerLiquidityInstruction(updateRecipient)
    const withdrawIx = await staker.withdrawIx(withdraw)
    const withdrawTx = new Transaction().add(updateRecipientIx).add(withdrawIx)
    await signAndSend(withdrawTx, [positionRecipient], staker.connection)

    // should be around half of reward
    const balanceAfter = (await incentiveToken.getAccountInfo(positionRecipientTokenAccount)).amount
    assert.ok(almostEqual(balanceAfter, new BN('500'), epsilon))
  })
})
