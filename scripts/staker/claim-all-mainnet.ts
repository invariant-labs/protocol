import { Staker, Network } from '../../staker-sdk/src'
import { Provider, Wallet } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Market, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { Stake, Withdraw } from '../../staker-sdk/lib/staker'
import { getMarketAddress, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS, getPositionIndex } from '@invariant-labs/sdk/src/utils'
import { MAINNET_TOKENS } from '@invariant-labs/sdk/lib/network'
import { Position, PositionWithAddress } from '@invariant-labs/sdk/lib/market'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local('https://api.mainnet-beta.solana.com', {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(wallet)

// DEFINE ALL THESE VARS BEFORE EXECUTION

const INCENTIVE: PublicKey = new PublicKey('EfAJjXZppDeQPRpfjkndsPjUrp6hjcMuACHhghNmYE1t')
const INCENTIVE_TOKEN: PublicKey = new PublicKey('FBNC4ZmLWLnGAvHnPvhnFDFeiEgztGcAKJktBwUaYdmx')
const TOKEN_USDC: PublicKey = new PublicKey(MAINNET_TOKENS.USDC)
const TOKEN_USDT: PublicKey = new PublicKey(MAINNET_TOKENS.USDH)
const INVARIANT = new PublicKey(getMarketAddress(Network.MAIN))
const FEE_TIER = FEE_TIERS[0]

const main = async () => {
  const staker = await Staker.build(Network.MAIN, signer, connection)
  const market = await Market.build(Network.MAIN, signer, connection)

  const pair = new Pair(TOKEN_USDC, TOKEN_USDT, FEE_TIER)
  const [poolAddress] = await pair.getAddressAndBump(INVARIANT)

  const stakedPositions = await getStakedPositions(
    market,
    staker,
    poolAddress,
    INCENTIVE,
    INVARIANT
  )
  const hbbAddress = new PublicKey(MAINNET_TOKENS.HBB)
  const HBB: Token = new Token(connection, hbbAddress, TOKEN_PROGRAM_ID, wallet)

  for (const position of stakedPositions) {
    const positionStruct = await market.getPosition(position.owner, position.index)
    const ownerTokenAccount = (await HBB.getOrCreateAssociatedAccountInfo(position.owner)).address

    const stringTx = await claimReward(
      market,
      staker,
      position.owner,
      signer.publicKey,
      pair,
      positionStruct,
      position.address,
      poolAddress,
      ownerTokenAccount,
      position.index
    )
    console.log('Claim tx', stringTx)
  }
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()

const claimReward = async (
  market: Market,
  staker: Staker,
  owner: PublicKey,
  signer: PublicKey,
  pair: Pair,
  position: Position,
  positionAddress: PublicKey,
  poolAddress: PublicKey,
  ownerTokenAcc: PublicKey,
  positionIndex: number
): Promise<string> => {
  const update: UpdateSecondsPerLiquidity = {
    pair,
    owner,
    signer,
    lowerTickIndex: position.lowerTickIndex,
    upperTickIndex: position.upperTickIndex,
    index: positionIndex
  }
  const withdraw: Withdraw = {
    incentive: INCENTIVE,
    pool: poolAddress,
    id: position.id,
    position: positionAddress,
    owner,
    incentiveTokenAccount: INCENTIVE_TOKEN,
    ownerTokenAcc,
    index: positionIndex
  }
  const hashTx = await staker.withdraw(market, update, withdraw)
  return hashTx
}

const getStakedPositions = async (
  market: Market,
  staker: Staker,
  poolAddress: PublicKey,
  incentive: PublicKey,
  invariant: PublicKey
): Promise<StakedPosition[]> => {
  const positions: PositionWithAddress[] = await market.getPositionsForPool(poolAddress)

  const stakedPositions: StakedPosition[] = []

  for (const position of positions) {
    const [address] = await staker.getUserStakeAddressAndBump(incentive, poolAddress, position.id)

    try {
      await staker.program.account.userStake.fetch(address)
      const index = getPositionIndex(position.address, invariant, position.owner)
      stakedPositions.push({ address: position.address, owner: position.owner, index })
    } catch (e) {
      console.log(e)
    }
  }

  return stakedPositions
}

interface StakedPosition {
  address: PublicKey
  owner: PublicKey
  index: number
}
