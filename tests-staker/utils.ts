import { Decimal } from '../sdk-staker/src/staker'
import { Account, Connection, Keypair, PublicKey } from '@solana/web3.js'
import { Token, u64 } from '@solana/spl-token'
import { TokenInstructions } from '@project-serum/serum'
import { BN } from '@project-serum/anchor'
import {
  CreateIncentive,
  CreateStake,
  EndIncentive,
  Withdraw,
  Staker
} from '../sdk-staker/lib/staker'
import { signAndSend } from '../sdk-staker/lib/utils'
import { UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { Market } from '@invariant-labs/sdk'

export enum ERRORS {
  SIGNATURE = 'Error: Signature verification failed',
  SIGNER = 'Error: unknown signer',
  PANICKED = 'Program failed to complete',
  SERIALIZATION = '0xa4',
  ALLOWANCE = 'custom program error: 0x1',
  NO_SIGNERS = 'Error: No signers'
}

export enum ERRORS_STAKER {
  ZERO_AMOUNT = '0x12f', // 0
  START_IN_PAST = '0x131', // 1
  TO_LONG_DURATION = '0x130' // 2
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

interface ICreateToken {
  connection: Connection
  payer: Account
  mintAuthority: PublicKey
  decimals?: number
}

export const createToken = async ({
  connection,
  payer,
  mintAuthority,
  decimals = 6
}: ICreateToken) => {
  const token = await Token.createMint(
    connection,
    payer,
    mintAuthority,
    null,
    decimals,
    TokenInstructions.TOKEN_PROGRAM_ID
  )
  return token
}

export const updatePositionAndCreateStake = async (
  market: Market,
  staker: Staker,
  updateSecondsPerLiquidity: UpdateSecondsPerLiquidity,
  createStake: CreateStake,
  signers: Keypair[],
  connection: Connection
) => {
  const tx = await market.updateSecondsPerLiquidityTransaction(updateSecondsPerLiquidity)
  tx.add(await staker.createStakeInstruction(createStake))

  await signAndSend(tx, signers, connection)
}

export const updatePositionAndWithdraw = async (
  market: Market,
  staker: Staker,
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

export const createIncentive = async (
  staker: Staker,
  createIncentive: CreateIncentive,
  signers: Keypair[]
) => {
  const tx = await staker.createIncentiveTransaction(createIncentive)
  await signAndSend(tx, signers, staker.connection)
}

export const createStake = async (staker: Staker, createStake: CreateStake, signer: Keypair) => {
  const tx = await staker.createStakeTransaction(createStake)
  await signAndSend(tx, [signer], staker.connection)
}

export const withdraw = async (staker: Staker, withdraw: Withdraw, signer: Keypair) => {
  const tx = await staker.withdrawTransaction(withdraw)
  await signAndSend(tx, [signer], staker.connection)
}

export const endIncentive = async (staker: Staker, endIncentive: EndIncentive, signer: Keypair) => {
  const tx = await staker.endIncentiveTransaction(endIncentive)
  await signAndSend(tx, [signer], staker.connection)
}
