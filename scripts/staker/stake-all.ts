import { Staker, Network } from '../../staker-sdk/src'
import { Provider, utils, Wallet } from '@project-serum/anchor'
import { clusterApiUrl, Keypair, PublicKey } from '@solana/web3.js'
import { Market, UpdateSecondsPerLiquidity } from '@invariant-labs/sdk/src/market'
import { CreateStake } from '../../staker-sdk/lib/staker'
import { getMarketAddress, Pair, MOCK_TOKENS } from '@invariant-labs/sdk/src'
import { FEE_TIERS, getPositionIndex } from '@invariant-labs/sdk/src/utils'
import { MINTER } from '../minter'

// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(clusterApiUrl('devnet'), {
  skipPreflight: true
})

// const USER = Keypair.fromSecretKey(
//   bs58.decode(
//     '2LS7WKVU4p5mdQerpe1PTRVKwiXWcu9azd7SX6YxVeUZwqax6kgb6q6X8TSAGYt1dky63rfpY4n8pZnPbNYZvWtr'
//   )
// )
const USER = new PublicKey('2tEidvr2FV19EvgQw8b53crdJJjdwHUKkwZA469Qu4EE')
const wallet = new Wallet(MINTER)
const connection = provider.connection

// DEFINE ALL THESE VARS BEFORE EXECUTION
const INCENTIVE: PublicKey = new PublicKey('B3pKFcA5WKC64sa3XG95oSNYhceKuLEnGqWYPRCbAKmV')
const TOKEN_USDC: PublicKey = new PublicKey(MOCK_TOKENS.USDC)
const TOKEN_USDH: PublicKey = new PublicKey(MOCK_TOKENS.USDH)
const INVARIANT = new PublicKey('9aiirQKPZ2peE9QrXYmsbTtR7wSDJi2HkQdHuaMpTpei')
const FEE_TIER = FEE_TIERS[0]

//   'F6M6BSC4VtzuXVFXyiGeDVvqRi9phkEABLveoNr912jT',
//   'CWbeJfjyQL6RymfC173rYK7wWcAomkDmtqhjwnr94arV',
//   'FPbaPcumPHZ5J9h6oguaf53enw4pJkgpF5wuPdSziRHe',
//   '8szGW9gSDxgNG6yxnBnJ8xp91AE9Hcnocx3ZQ21NUyUc',
//   '78AQyuc82BsN8XWjUsVTafZhZ25w3Kr9q7Bsvo8A5qvR',
//   'CBk6Cwj97JELHTswNckDwFfvFHEXgw7PRqGCGnKiX9f3',
//   'HgUyEp2wcouZ4H4arur44JFMwM2CDtw6as1EJmUmnJb3'

const main = async () => {
  const staker = await Staker.build(Network.DEV, wallet, connection)
  const market = await Market.build(Network.DEV, wallet, connection)

  const pair = new Pair(TOKEN_USDC, TOKEN_USDH, FEE_TIER)
  const [poolAddress] = await pair.getAddressAndBump(new PublicKey(getMarketAddress(Network.DEV)))
  const pool = await market.getPool(pair)
  const positions = await market.getPositionsForPool(poolAddress)

  for (const position of positions) {
    const index = await getPositionIndex(position.address, INVARIANT, position.owner)
    const update: UpdateSecondsPerLiquidity = {
      pair,
      owner: position.owner,
      signer: MINTER.publicKey,
      lowerTickIndex: position.lowerTickIndex,
      upperTickIndex: position.upperTickIndex,
      index
    }
    const createStake: CreateStake = {
      pool: poolAddress,
      id: position.id,
      index,
      position: position.address,
      incentive: INCENTIVE,
      owner: position.owner,
      signer: MINTER.publicKey,
      invariant: INVARIANT
    }

    const result = await staker.createStake(market, update, createStake)
    console.log(`Created stake `, result.stringTx)
  }
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
