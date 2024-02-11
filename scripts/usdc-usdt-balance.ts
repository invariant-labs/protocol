import { BN, Provider } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Network } from '@invariant-labs/sdk/src/network'
import { Market, Pair } from '@invariant-labs/sdk/src'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token'
import { PoolStructure, PositionStructure } from '@invariant-labs/sdk/lib/market'
import { PRICE_DENOMINATOR } from '@invariant-labs/sdk'
import { DENOMINATOR } from '@invariant-labs/sdk'

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

  const [usdcAmount, usdtAmount, pool, positions] = await Promise.all([
    getTokenBalance(USDC, owner),
    getTokenBalance(USDT, owner),
    market.getPool(USDC_USDT_0_01),
    getAllPositionsForPair(market, owner, USDC_USDT_0_01)
  ])

  const balance = calculateBalance(usdcAmount, usdtAmount, pool, positions)
  console.log(balance)
}

interface Balance {
  price: number
  tick: number
  denominatedUSDC: number
  denominatedUSDT: number
  sum: number
}

const calculateBalance = (
  walletUsdc: BN,
  walletUsdt: BN,
  pool: PoolStructure,
  positions: PositionStructure[]
): Balance => {
  const isUSDCTokenX = pool.tokenX.equals(USDC)
  const { positionSumX, positionSumY } = positions.reduce(
    (acc, p) => {
      const sumX = acc.positionSumX.add(p.amountTokenX).add(p.unclaimedFeesX)
      const sumY = acc.positionSumY.add(p.amountTokenY).add(p.unclaimedFeesY)
      return { positionSumX: sumX, positionSumY: sumY }
    },
    { positionSumX: new BN(0), positionSumY: new BN(0) }
  ) as { positionSumX: u64; positionSumY: u64 }
  const [positionSumUSDC, positionSumUSDT] = isUSDCTokenX
    ? [positionSumX, positionSumY]
    : [positionSumY, positionSumX]

  const allUSDC = walletUsdc.add(positionSumUSDC).toNumber() / 10 ** 6
  const allUSDT = walletUsdt.add(positionSumUSDT).toNumber() / 10 ** 6
  const price =
    pool.sqrtPrice.v.mul(pool.sqrtPrice.v).div(PRICE_DENOMINATOR).div(DENOMINATOR).toNumber() /
    DENOMINATOR.toNumber()

  let denominatedUSDC: number = 0
  let denominatedUSDT: number = 0
  if (isUSDCTokenX) {
    denominatedUSDC = allUSDC + allUSDT / price
    denominatedUSDT = allUSDC * price + allUSDT
  } else {
    denominatedUSDC = allUSDC * price + allUSDT
    denominatedUSDT = allUSDC + allUSDT / price
  }

  return {
    denominatedUSDC,
    denominatedUSDT,
    sum: allUSDC + allUSDT,
    price,
    tick: pool.currentTickIndex
  }
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
