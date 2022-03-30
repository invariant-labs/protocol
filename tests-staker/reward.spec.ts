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
  // it('test 1', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(1637002223) },
  //     endTime: { v: new BN(1640002223) },
  //     liquidity: { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(4000000).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(10000000).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(1637002232) }
  //   })
  //   console.log(result.toString())
  //   assert.ok(result.eq(new BN(2)))
  //   assert.ok(secondsInside.eq(new BN(6)))
  // })
  // it('test 2', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(0) },
  //     endTime: { v: new BN(100) },
  //     liquidity: { v: new BN(2000000).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(10000000).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(35000000).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(50) }
  //   })
  //   assert.ok(result.eq(new BN(500)))
  //   assert.ok(secondsInside.eq(new BN(50)))
  // })
  // it('test 3', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(10).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(120) }
  //   })
  //   assert.ok(result.eq(new BN(200)))
  //   assert.ok(secondsInside.eq(new BN(20)))
  // })
  // it('test 4', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(100).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(1).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(300) }
  //   })
  //   assert.ok(result.eq(new BN(500)))
  //   assert.ok(secondsInside.eq(new BN(100)))
  // })
  // it('test 5', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(100).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(1).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(201) }
  //   })
  //   assert.ok(result.eq(new BN(990)))
  //   assert.ok(secondsInside.eq(new BN(100)))
  // })
  // it('test 6', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(10) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(120) }
  //   })
  //   assert.ok(result.eq(new BN(111)))
  //   assert.ok(secondsInside.eq(new BN(10)))
  // })
  // it('test 7', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(0) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(120) }
  //   })
  //   assert.ok(result.eq(new BN(0)))
  //   assert.ok(secondsInside.eq(new BN(10)))
  // })
  // it('test 8', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(2).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(120) }
  //   })
  //   assert.ok(result.eq(new BN(0)))
  //   assert.ok(secondsInside.eq(new BN(0)))
  // })
  // it('test 9', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(0).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(0).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(120) }
  //   })
  //   assert.ok(result.eq(new BN(0)))
  //   assert.ok(secondsInside.eq(new BN(0)))
  // })
  // it('test 10', () => {
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(1000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(100) },
  //     endTime: { v: new BN(200) },
  //     liquidity: { v: new BN(5).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(2).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(2).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(99) }
  //   })
  //   assert.ok(result.eq(new BN(0)))
  //   assert.ok(secondsInside.eq(new BN(0)))
  // })
  // it('test 11', () => {
  //   //result should be less than 1 token
  //   const { secondsInside, result } = calculateReward({
  //     totalRewardUnclaimed: { v: new BN(100000) },
  //     totalSecondsClaimed: { v: new BN(0) },
  //     startTime: { v: new BN(1637002223) },
  //     endTime: { v: new BN(1637002223) },
  //     liquidity: { v: new BN(1000000).mul(LIQUIDITY_DENOMINATOR) },
  //     secondsPerLiquidityInsideInitial: { v: new BN(4000000).mul(DENOMINATOR) },
  //     secondsPerLiquidityInside: { v: new BN(10000000).mul(DENOMINATOR) },
  //     currentTime: { v: new BN(1637002232) }
  //   })
  //   assert.ok(result.eq(new BN(0)))
  //   assert.ok(secondsInside.eq(new BN(6)))
  // })
})
