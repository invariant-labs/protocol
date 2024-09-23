import { Provider, Wallet } from '@coral-xyz/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { Market, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { getMarketAddress, Network, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS, getPositionIndex } from '@invariant-labs/sdk/src/utils'
import { Position, PositionWithAddress } from '@invariant-labs/sdk/lib/market'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { sleep, MOCK_TOKENS } from '@invariant-labs/sdk'
import { Staker } from '../../../staker-sdk/src'
import { Withdraw } from '../../../staker-sdk/src/staker'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

const connection = provider.connection
// @ts-expect-error
const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(wallet)

// DEFINE ALL THESE VARS BEFORE EXECUTION

const INCENTIVE: PublicKey = new PublicKey('') // FILL THIS
const INCENTIVE_TOKEN_ACCOUNT: PublicKey = new PublicKey('')
const TOKEN_USDC: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_USDT: PublicKey = new PublicKey(MOCK_TOKENS.USDH)
const INVARIANT = new PublicKey(getMarketAddress(Network.DEV))
const FEE_TIER = FEE_TIERS[0]

const main = async () => {
  const staker = await Staker.build(Network.DEV, signer, connection)
  const market = await Market.build(Network.DEV, signer, connection)

  const pair = new Pair(TOKEN_USDC, TOKEN_USDT, FEE_TIER)
  const [poolAddress] = await pair.getAddressAndBump(INVARIANT)

  const stakedPositions = await getStakedPositions(
    market,
    staker,
    poolAddress,
    INCENTIVE,
    INVARIANT
  )

  const hbbAddress = new PublicKey(MOCK_TOKENS.HBB)
  const HBB: Token = new Token(connection, hbbAddress, TOKEN_PROGRAM_ID, wallet)

  for (const position of stakedPositions) {
    const positionStruct = await market.getPosition(position.owner, position.index)
    await sleep(200)
    console.log('************************')
    console.log('OWNER', positionStruct.owner.toString())
    const ownerTokenAccount = await HBB.getOrCreateAssociatedAccountInfo(position.owner)
    const { address, owner, index } = position

    console.log('address:', address.toString())
    console.log('owner:', owner.toString())
    console.log('index:', index)
    console.log('ownerTokenAccount:', ownerTokenAccount.address.toString())

    const stringTx = await claimReward(
      market,
      staker,
      position.owner,
      signer.publicKey,
      pair,
      positionStruct,
      position.address,
      poolAddress,
      ownerTokenAccount.address,
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
    incentiveTokenAccount: INCENTIVE_TOKEN_ACCOUNT,
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
  // positions.forEach(async position => {
  //   console.log(position.owner.toString())
  // })

  const stakedPositions: StakedPosition[] = []

  for (const position of positions) {
    const [address] = await staker.getUserStakeAddressAndBump(incentive, poolAddress, position.id)

    try {
      await staker.program.account.userStake.fetch(address)
      const index = await getPositionIndex(position.address, invariant, position.owner)
      stakedPositions.push({ address: position.address, owner: position.owner, index })
    } catch (e) {
      //console.log(e)
    }
  }

  return stakedPositions
}

interface StakedPosition {
  address: PublicKey
  owner: PublicKey
  index: number
}
