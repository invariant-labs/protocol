import { BN, Provider } from '@project-serum/anchor'
import { assert, expect } from 'chai'
import {
  calculateReward,
  DENOMINATOR,
  LIQUIDITY_DENOMINATOR,
  CalculateReward
} from '../staker-sdk/src/utils'
import * as anchor from '@project-serum/anchor'
import { Market, Pair } from '@invariant-labs/sdk'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { CreateIncentive, Decimal, Staker } from '../staker-sdk/src/staker'
import { createToken, tou64, signAndSend, getTime } from './testUtils'
import { createToken as createTkn, initEverything } from '../tests/testUtils'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { Token } from '@solana/spl-token'
import { Network } from '../staker-sdk/lib'
describe('Calculate Reward tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  //@ts-expect-error
  const wallet = provider.wallet.payer as Account
  const mintAuthority = Keypair.generate()
  const founderAccount = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  let staker: Staker
  let pool: PublicKey
  let invariant: PublicKey
  let incentiveToken: Token
  let founderTokenAccount: PublicKey
  let incentiveTokenAccount: Keypair
  let amount: BN
  let pair: Pair

  beforeEach(async () => {
    staker = await Staker.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Staker.programId
    )

    // create incentive token and add airdrop
    incentiveToken = await createToken(connection, wallet, wallet)
    await connection.requestAirdrop(founderAccount.publicKey, 10e9)

    founderTokenAccount = await incentiveToken.createAccount(founderAccount.publicKey)
    incentiveTokenAccount = Keypair.generate()

    amount = new anchor.BN(100 * 1e6)
    await incentiveToken.mintTo(founderTokenAccount, wallet, [], tou64(amount))

    // create market
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
    invariant = anchor.workspace.Invariant.programId

    // create Incentive
  })

  it('#init()', async () => {
    await initEverything(market, [pair], admin)
    pool = await pair.getAddress(anchor.workspace.Invariant.programId)
    const incentiveAccount = Keypair.generate()
    const currentTime = new BN(getTime())
    const reward: Decimal = { v: new BN(10) }
    const startTimeCreate: Decimal = { v: currentTime.add(new BN(0)) }
    const endTimeCreate: Decimal = { v: currentTime.add(new BN(31_000_000)) }

    const createIncentiveVars: CreateIncentive = {
      reward,
      startTime: startTimeCreate,
      endTime: endTimeCreate,
      pool,
      founder: founderAccount.publicKey,
      incentiveToken: incentiveToken.publicKey,
      founderTokenAccount: founderTokenAccount,
      invariant
    }

    const tx = new Transaction().add(
      await staker.createIncentiveIx(
        createIncentiveVars,
        incentiveAccount.publicKey,
        incentiveTokenAccount.publicKey
      )
    )

    await signAndSend(
      tx,
      [founderAccount, incentiveAccount, incentiveTokenAccount],
      staker.connection
    )
  })

  it('check amount', async () => {
    const totalRewardUnclaimed: Decimal = { v: new BN(1000000) }
    const totalSecondsClaimed: Decimal = { v: new BN(0) }
    const startTime: Decimal = { v: getTime().add(new BN(1)) }
    const endTime: Decimal = { v: getTime().add(new BN(3000001)) }
    const liquidity: Decimal = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }
    const secondsPerLiquidityInsideInitial: Decimal = { v: new BN(4000000).mul(DENOMINATOR) }
    const secondsPerLiquidityInside: Decimal = { v: new BN(10000000).mul(DENOMINATOR) }

    const rewardVars: CalculateReward = {
      totalRewardUnclaimed,
      totalSecondsClaimed,
      startTime,
      endTime,
      liquidity,
      secondsPerLiquidityInsideInitial,
      secondsPerLiquidityInside,
      currentTime: { v: getTime().add(new BN(9)) }
    }

    const { result, secondsInside } = await calculateReward(rewardVars)
    console.log(result.toString())
    console.log(secondsInside.toString())
  })
  it('check time error', async () => {
    const seconds = new Date().valueOf() / 1000
    const totalRewardUnclaimed: Decimal = { v: new BN(1000000) }
    const totalSecondsClaimed: Decimal = { v: new BN(0) }
    const startTime: Decimal = { v: new BN(Math.floor(seconds + 1)) }
    const endTime: Decimal = { v: new BN(Math.floor(seconds + 3000001)) }
    const liquidity: Decimal = { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) }
    const secondsPerLiquidityInsideInitial: Decimal = { v: new BN(4000000).mul(DENOMINATOR) }
    const secondsPerLiquidityInside: Decimal = { v: new BN(10000000).mul(DENOMINATOR) }

    const rewardVars: CalculateReward = {
      totalRewardUnclaimed,
      totalSecondsClaimed,
      startTime,
      endTime,
      liquidity,
      secondsPerLiquidityInsideInitial,
      secondsPerLiquidityInside,
      currentTime: { v: getTime() }
    }

    assert.ifError("Error: The indasdascentive didn't start yet!")
  })
})
