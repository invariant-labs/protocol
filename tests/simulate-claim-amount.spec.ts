import * as anchor from '@project-serum/anchor'
import { Provider, BN } from '@project-serum/anchor'
import { Market, Network, Pair, DENOMINATOR } from '@invariant-labs/sdk'
import { Keypair } from '@solana/web3.js'
import { createToken } from '../tests/testUtils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { toDecimal } from '../sdk-staker/lib/utils'
import { fromFee, tou64 } from '@invariant-labs/sdk/lib/utils'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  FeeTier,
  InitPosition,
  Swap
} from '@invariant-labs/sdk/src/market'

describe('Withdraw tests', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  let market: Market
  let pair: Pair
  let tokenX: Token
  let tokenY: Token

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    await Promise.all([
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])

    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])

    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    await market.createState(admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)

    const createPoolVars: CreatePool = {
      pair,
      payer: admin,
      tokenX,
      tokenY
    }
    await market.createPool(createPoolVars)

    // create tokens
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
  })
  it('Claim', async () => {
    // create position
    await connection.requestAirdrop(positionOwner.publicKey, 1e9)
    const upperTick = 50
    const lowerTick = -50

    const createTickVars: CreateTick = {
      pair,
      index: upperTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars, admin)

    const createTickVars2: CreateTick = {
      pair,
      index: lowerTick,
      payer: admin.publicKey
    }
    await market.createTick(createTickVars2, admin)

    const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
    const mintAmount = tou64(new BN(10).pow(new BN(10)))

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

    const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

    await market.createPositionList(positionOwner.publicKey, positionOwner)

    const initPositionVars: InitPosition = {
      pair,
      owner: positionOwner.publicKey,
      userTokenX: userTokenXAccount,
      userTokenY: userTokenYAccount,
      lowerTick,
      upperTick,
      liquidityDelta
    }
    await market.initPosition(initPositionVars, positionOwner)

    // Create owner
    const trader = Keypair.generate()
    await connection.requestAirdrop(trader.publicKey, 1e9)
    const amount = new BN(10000)

    const accountX = await tokenX.createAccount(trader.publicKey)
    const accountY = await tokenY.createAccount(trader.publicKey)

    await tokenX.mintTo(accountX, mintAuthority.publicKey, [mintAuthority], tou64(amount))
    await tokenY.mintTo(accountY, mintAuthority.publicKey, [mintAuthority], tou64(amount))
    // Swap
    const poolDataBefore = await market.getPool(pair)

    const swapVars: Swap = {
      pair,
      xToY: true,
      amount: new BN(1000),
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    }
    await market.swap(swapVars, trader)

    const swapVars2: Swap = {
      pair,
      xToY: false,
      amount: new BN(2000),
      knownPrice: poolDataBefore.sqrtPrice,
      slippage: toDecimal(1, 2),
      accountX,
      accountY,
      byAmountIn: true,
      owner: trader.publicKey
    }
    await market.swap(swapVars2, trader)
  })
})
