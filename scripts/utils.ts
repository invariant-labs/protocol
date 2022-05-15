import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { LIQUIDITY_DENOMINATOR } from '@invariant-labs/sdk'
import { Pair } from '@invariant-labs/sdk'
import { Decimal } from '@invariant-labs/sdk/lib/market'
import { LIQUIDITY_SCALE } from '@invariant-labs/sdk/lib/utils'
import { PRICE_SCALE } from '@invariant-labs/sdk/lib/utils'
import { tou64 } from '@invariant-labs/sdk/src/utils'
import { BN } from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Connection, Keypair } from '@solana/web3.js'

export const handleMint = async (
  connection: Connection,
  pair: Pair,
  mintAmount: BN,
  payer: Keypair
) => {
  const tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, payer)
  const tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, payer)

  const accountXData = await tokenX.getOrCreateAssociatedAccountInfo(payer.publicKey)
  const accountYData = await tokenY.getOrCreateAssociatedAccountInfo(payer.publicKey)
  const accountX = accountXData.address
  const accountY = accountYData.address

  if (accountXData.amount.lt(mintAmount))
    await tokenX.mintTo(accountX, payer, [], tou64(mintAmount.sub(accountXData.amount)))
  if (accountYData.amount.lt(mintAmount))
    await tokenY.mintTo(accountY, payer, [], tou64(mintAmount.sub(accountYData.amount)))

  return { accountX, accountY }
}

export const formatPrice = (price: Decimal) => {
  let afterDot = price.v.mod(PRICE_DENOMINATOR).toString()
  return (
    price.v.div(PRICE_DENOMINATOR).toString() +
    '.' +
    '0'.repeat(PRICE_SCALE - afterDot.length) +
    price.v.mod(PRICE_DENOMINATOR).toString()
  )
}

export const formatLiquidity = (price: Decimal) => {
  let afterDot = price.v.mod(LIQUIDITY_DENOMINATOR).toString()
  return (
    price.v.div(LIQUIDITY_DENOMINATOR).toString() +
    '.' +
    '0'.repeat(LIQUIDITY_SCALE - afterDot.length) +
    price.v.mod(LIQUIDITY_DENOMINATOR).toString()
  )
}

export const isRPCError = (err: any) => {
  const timeoutError = err.toString().match(/Error: Transaction was not confirmed in 30./)
  const blockhashError = err.toString().match(/failed to get recent blockhash/)
  return timeoutError !== null || blockhashError !== null
}
