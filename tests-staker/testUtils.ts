import * as anchor from '@project-serum/anchor'
import { Decimal, LiquidityMining, Stake } from '../sdk-staker/src/staker'
import {
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmRawTransaction,
  Transaction
} from '@solana/web3.js'
import { Token, u64 } from '@solana/spl-token'
import { TokenInstructions } from '@project-serum/serum'
import { BN, Provider } from '@project-serum/anchor'
import {
  CreateIncentive,
  CreateStake,
  EndIncentive,
  RemoveStake,
  Withdraw
} from '../sdk-staker/lib/staker'
//import { signAndSend } from '../sdk-staker/lib/utils'
import { InitPosition, UpdateSecondsPerLiquidity, Market } from '@invariant-labs/sdk/src/market'
import { DENOMINATOR, Pair } from '@invariant-labs/sdk'

export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xa4',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers'
}

export enum ERRORS_STAKER {
  ZERO_AMOUNT = '0x1773', // 0
  START_IN_PAST = '0x1775', // 1
  TO_LONG_DURATION = '0x1774', // 2
  ENDED = '0x1776' // 3
}

export const signAndSend = async (
  tx: Transaction,
  signers: Keypair[],
  connection: Connection,
  opts?: ConfirmOptions
) => {
  tx.setSigners(...signers.map(s => s.publicKey))
  const blockhash = await connection.getRecentBlockhash(
    opts?.commitment ?? Provider.defaultOptions().commitment
  )
  tx.recentBlockhash = blockhash.blockhash
  tx.partialSign(...signers)
  const rawTx = tx.serialize()
  return await sendAndConfirmRawTransaction(connection, rawTx)
}

export const eqDecimal = (a: Decimal, b: Decimal) => {
  return a.v.eq(b.v)
}

export const tou64 = amount => {
  // eslint-disable-next-line new-cap
  return new u64(amount.toString())
}

export const getTime = () => {
  const seconds = new Date().valueOf() / 1000
  const currentTime = new BN(Math.floor(seconds))
  return currentTime
}

export async function assertThrowsAsync(fn: Promise<any>, word?: string) {
  try {
    await fn
  } catch (e: any) {
    let err
    if (e.code) {
      err = '0x' + e.code.toString(16)
    } else {
      err = e.toString()
    }
    if (word) {
      const regex = new RegExp(`${word}$`)
      if (!regex.test(err)) {
        console.log(err)
        throw new Error('Invalid Error message')
      }
    }
    return
  }
  throw new Error('Function did not throw error')
}

export const createToken = async (
  connection: Connection,
  payer: Keypair,
  mintAuthority: Keypair,
  decimals = 6
) => {
  const token = await Token.createMint(
    connection,
    payer,
    mintAuthority.publicKey,
    null,
    decimals,
    TokenInstructions.TOKEN_PROGRAM_ID
  )
  return token
}

export const updatePositionAndCreateStake = async (
  market: Market,
  staker: LiquidityMining,
  updateSecondsPerLiquidity: UpdateSecondsPerLiquidity,
  createStake: CreateStake,
  signers: Keypair[],
  connection: Connection
) => {
  const tx = await market.updateSecondsPerLiquidityTransaction(updateSecondsPerLiquidity)
  tx.add(await staker.createStakeInstruction(createStake))

  await signAndSend(tx, signers, connection)
}

export const removeStake = async (
  staker: LiquidityMining,
  pool: PublicKey,
  id: BN,
  incentive: PublicKey,
  founder: Keypair,
  connection: Connection
) => {
  const [userStakeAddress] = await staker.getUserStakeAddressAndBump(incentive, pool, id)

  const tx = await staker.removeStakeTransaction(userStakeAddress, incentive, founder.publicKey)

  await signAndSend(tx, [founder], connection)
}
export const removeAllStakes = async (
  staker: LiquidityMining,
  incentive: PublicKey,
  founder: Keypair,
  connection: Connection
) => {
  const stakes = await staker.getAllIncentiveStakes(incentive)
  let tx = new Transaction()

  for (let stake of stakes) {
    tx.add(await staker.removeStakeInstruction(stake.publicKey, incentive, founder.publicKey))
  }
  await signAndSend(tx, [founder], connection)
}

export const updatePositionAndWithdraw = async (
  market: Market,
  staker: LiquidityMining,
  updateSecondsPerLiquidity: UpdateSecondsPerLiquidity,
  withdraw: Withdraw,
  signers: Keypair[],
  connection: Connection
) => {
  const tx = await market.updateSecondsPerLiquidityTransaction(updateSecondsPerLiquidity)
  tx.add(await staker.withdrawInstruction(withdraw))

  await signAndSend(tx, signers, connection)
}

export const almostEqual = (num1: BN, num2: BN, epsilon: BN = new BN(10)) => {
  return num1.sub(num2).abs().lt(epsilon)
}

export const withdraw = async (staker: LiquidityMining, withdraw: Withdraw, signer: Keypair) => {
  const tx = await staker.withdrawTransaction(withdraw)
  await signAndSend(tx, [signer], staker.connection)
}

export const endIncentive = async (
  staker: LiquidityMining,
  endIncentive: EndIncentive,
  signer: Keypair
) => {
  const tx = await staker.endIncentiveTransaction(endIncentive)

  await signAndSend(tx, [signer], staker.connection)
}

export const createPositionAndStake = async (
  market: Market,
  staker: LiquidityMining,
  pair: Pair,
  positionOwner: Keypair,
  tokenX: PublicKey,
  tokenY: PublicKey,
  incentive: PublicKey,
  connection: Connection,
  amount: number
) => {
  const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }
  await market.createPositionList(positionOwner.publicKey, positionOwner)

  for (let i = 0; i < amount; i++) {
    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: tokenX,
      userTokenY: tokenY,
      lowerTick: i * 10,
      upperTick: (i + 1) * 10,
      liquidityDelta
    }
    await market.initPosition(initPositionVars, positionOwner)

    const index = i
    //get position data
    const { positionAddress: position } = await market.getPositionAddress(
      positionOwner.publicKey,
      index
    )
    const positionStructBefore = await market.getPosition(positionOwner.publicKey, index)
    const poolAddress = positionStructBefore.pool
    const positionId = positionStructBefore.id

    // create stake
    const updateSecondsPerLiquidityVars: UpdateSecondsPerLiquidity = {
      pair,
      owner: positionOwner.publicKey,
      lowerTickIndex: i * 10,
      upperTickIndex: (i + 1) * 10,
      index
    }
    const createStakeVars: CreateStake = {
      pool: poolAddress,
      id: positionId,
      index,
      position,
      incentive: incentive,
      owner: positionOwner.publicKey,
      invariant: anchor.workspace.Invariant.programId
    }

    await updatePositionAndCreateStake(
      market,
      staker,
      updateSecondsPerLiquidityVars,
      createStakeVars,
      [positionOwner],
      connection
    )
  }
}
