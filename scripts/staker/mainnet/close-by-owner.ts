import { Staker, Network } from '../../../staker-sdk/src'
import { Provider, Wallet } from '@coral-xyz/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { getMarketAddress, Market, Pair } from '@invariant-labs/sdk'
import { MAINNET_TOKENS } from '@invariant-labs/sdk/src/network'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { CloseStake } from '../../../staker-sdk/lib/staker'
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes'
import { Position } from '@invariant-labs/sdk/lib/market'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const provider = Provider.local(
  'https://tame-ancient-mountain.solana-mainnet.quiknode.pro/6a9a95bf7bbb108aea620e7ee4c1fd5e1b67cc62/',
  {
    skipPreflight: true
  }
)

// trunk-ignore(gitleaks/generic-api-key)
const key = '' // TODO add owner keypair here
const owner = Keypair.fromSecretKey(bs58.decode(key))

const connection = provider.connection
//// @ts-expect-error
//const wallet = provider.wallet.payer as Keypair
const signer = new Wallet(owner)

// DEFINE ALL THESE VARS BEFORE EXECUTION

const INCENTIVE: PublicKey = new PublicKey('')
const TOKEN_USDC: PublicKey = new PublicKey(MAINNET_TOKENS.USDC)
const TOKEN_USDH: PublicKey = new PublicKey(MAINNET_TOKENS.USDH)
const FEE_TIER = FEE_TIERS[0] // 0.01%
const INVARIANT = new PublicKey(getMarketAddress(Network.MAIN))

const main = async () => {
  const staker = await Staker.build(Network.MAIN, signer, connection)
  const market = await Market.build(Network.MAIN, signer, connection)
  const pair = new Pair(TOKEN_USDC, TOKEN_USDH, FEE_TIER)
  const [poolAddress] = await pair.getAddressAndBump(INVARIANT)

  const index = 1
  const position: Position = await market.getPosition(owner.publicKey, index)
  const positionAddress = await market.getPositionAddress(owner.publicKey, index)

  const closeStake: CloseStake = {
    pool: poolAddress,
    id: position.id,
    incentive: INCENTIVE,
    position: positionAddress.positionAddress,
    owner: owner.publicKey,
    index
  }

  const stringTx = await staker.closeStakeByOwner(closeStake)
  console.log(stringTx)
}

// trunk-ignore(eslint/@typescript-eslint/no-floating-promises)
main()
