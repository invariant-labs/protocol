import { PRICE_DENOMINATOR, LIQUIDITY_DENOMINATOR, Pair } from '@invariant-labs/sdk'
import { Decimal } from '@invariant-labs/sdk/lib/market'
import { LIQUIDITY_SCALE, PRICE_SCALE } from '@invariant-labs/sdk/lib/utils'
import { BN } from '@coral-xyz/anchor'
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { Connection, Keypair } from '@solana/web3.js'

export const handleMint = async (
  connection: Connection,
  pair: Pair,
  mintAmount: BN,
  payer: Keypair
) => {
  const accountXData = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    pair.tokenX,
    payer.publicKey
  )
  const accountYData = await getOrCreateAssociatedAccountInfo(
    connection,
    payer,
    pair.tokenY,
    payer.publicKey
  )
  const accountX = accountXData.address
  const accountY = accountYData.address

  if (accountXData.amount.lt(mintAmount))
    mintTo(connection, payer, pair.tokenX, accountX, payer, mintAmount.sub(accountXData.amount))
  if (accountYData.amount.lt(mintAmount))
    mintTo(connection, payer, pair.tokenY, accountY, payer, mintAmount.sub(accountXData.amount))

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
