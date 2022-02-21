import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Pair, sleep } from '@invariant-labs/sdk/src'
import { Network } from '../sdk-staker/src'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import { CreateIncentive, Decimal, Staker } from '../sdk-staker/src/staker'
import {
  createToken,
  tou64,
  createSomePositionsAndStakes,
  signAndSend,
  createToken as createTkn
} from './testUtils'

import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { CreateFeeTier, CreatePool, FeeTier } from '@invariant-labs/sdk/src/market'

// To run this test you have change WEEK to 3 sec in staker program

describe('Remove all takes', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const incentiveAccount = Keypair.generate()
  const founderAccount = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  let staker: Staker
  let market: Market
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAccount: PublicKey
  let incentiveTokenAccount: Keypair
  let amount: BN
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    // create staker
    staker = await Staker.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Staker.programId
    )

    await Promise.all([
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(positionOwner.publicKey, 1e9),
      await connection.requestAirdrop(incentiveAccount.publicKey, 10e9)
    ])

    // create token
    incentiveToken = await createToken(connection, wallet, wallet)
    // add SOL to founder acc
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    // create taken acc for founder and staker
    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()

    // mint to founder acc
    amount = new anchor.BN(100 * 1e6)
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
      await connection.requestAirdrop(admin.publicKey, 1e9)
    ])

    // create pool
    const feeTier: FeeTier = {
      fee: fromFee(new BN(600)),
      tickSpacing: 10
    }

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)

    const createPoolVars: CreatePool = {
      pair,
      payer: admin
    }
    await market.createPool(createPoolVars)

    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
    invariant = anchor.workspace.Invariant.programId
  })

  it('Remove', async () => {
    // create incentive
    const duration = 30
    const seconds = new Date().valueOf() / 1000
    const currentTime = new BN(Math.floor(seconds))
    const reward: Decimal = { v: new BN(10) }
    const startTime = currentTime.add(new BN(0))
    const endTime = currentTime.add(new BN(duration))

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

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    // create some positions and stakes
    const begin = new Date().valueOf() / 1000
    const numOfStakes = 24
    await createSomePositionsAndStakes(
      market,
      staker,
      pair,
      positionOwner,
      userTokenXAccount,
      userTokenYAccount,
      incentiveAccount.publicKey,
      numOfStakes
    )
    const end = new Date().valueOf() / 1000

    const incentiveBefore = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(incentiveBefore.numOfStakes.eq(new BN(numOfStakes)))

    // wait for the end of incentive
    const delay = (duration - (end - begin) + 5) * 1000
    await sleep(delay)

    const stakes = await staker.getAllIncentiveStakes(incentiveAccount.publicKey)

    let tx = new Transaction()
    const stringTx: string[] = []

    // put max 18 Ix per Tx, sign and return array of tx hashes

    for (let i = 0; i < stakes.length; i++) {
      const removeIx = await staker.removeStakeIx(
        stakes[i].publicKey,
        incentiveAccount.publicKey,
        founderAccount.publicKey
      )
      tx.add(removeIx)
      if ((i + 1) % 18 === 0 || i + 1 === stakes.length) {
        stringTx.push(await signAndSend(tx, [founderAccount], staker.connection))
        tx = new Transaction()
      }
    }

    const incentiveAfter = await staker.getIncentive(incentiveAccount.publicKey)
    assert.ok(incentiveAfter.numOfStakes.eq(new BN('0')))
  })
})
