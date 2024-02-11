import { BN, Provider } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token'
import { PositionStructure, Tick } from '@invariant-labs/sdk/lib/market'

// ***********FILE FIELDS**************
const owner = new PublicKey('-----------------')
const provider = Provider.local('-----------------', {
  skipPreflight: true
})
// ************************************
const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair

const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const USDT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')

const main = async () => {
  const USDC_USDT_0_01 = new Pair(USDC, USDT, { fee: fromFee(new BN(10)), tickSpacing: 1 })
  const market = await Market.build(Network.MAIN, provider.wallet, connection)

  const [usdcAmount, usdtAmount, positions] = await Promise.all([
    getTokenBalance(USDC, owner),
    getTokenBalance(USDT, owner),
    getAllPositionsForPair(market, owner, USDC_USDT_0_01)
  ])
  console.log(`usdcAmount = ${usdcAmount}`)
  console.log(`usdtAmount = ${usdtAmount}`)
  console.log(`positions = ${positions.length}`)

  const pool = await market.getPool(USDC_USDT_0_01)
}

const getAllPositionsForPair = async (
  market: Market,
  owner: PublicKey,
  pair: Pair
): Promise<PositionStructure[]> => {
  const allPositions = await market.getAllUserPositions(owner)
  return allPositions.filter(
    p =>
      p.tokenX.equals(pair.tokenX) &&
      p.tokenY.equals(pair.tokenY) &&
      p.feeTier.fee.eq(pair.feeTier.fee)
  )
}

const getTokenBalance = async (token: PublicKey, owner: PublicKey): Promise<u64> => {
  try {
    const usdcAssociatedTokenAddress = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token,
      owner
    )
    const usdc = new Token(connection, token, TOKEN_PROGRAM_ID, wallet)
    return (await usdc.getAccountInfo(usdcAssociatedTokenAddress)).amount
  } catch (e) {
    return new BN(0)
  }
}

main()
