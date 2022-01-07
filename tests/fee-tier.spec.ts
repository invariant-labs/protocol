import { Network, Market } from '@invariant-labs/sdk'
import { sleep, assertThrowsAsync } from '@invariant-labs/sdk/lib/utils'
import { CreateFeeTier, FeeTier } from '@invariant-labs/sdk/src/market'
import { ERRORS, fromFee } from '@invariant-labs/sdk/src/utils'
import * as anchor from '@project-serum/anchor'
import { BN, Provider } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'
import { createFeeTier, createState } from './testUtils'

describe('fee-tier', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const admin = Keypair.generate()
  const user = Keypair.generate()
  let market: Market
  const feeTierAdmin: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  const feeTierUser: FeeTier = {
    fee: fromFee(new BN(700)),
    tickSpacing: 10
  }

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Amm.programId
    )

    await Promise.all([
      await connection.requestAirdrop(admin.publicKey, 1e10),
      await connection.requestAirdrop(user.publicKey, 1e10)
    ])
  })

  it('#createState()', async () => {
    await sleep(1000)
    createState(market, admin.publicKey, admin)
  })

  it('#createFeeTier()', async () => {
    await sleep(1000)
    const createFeeTierVars: CreateFeeTier = {
      feeTier: feeTierAdmin,
      admin: admin.publicKey
    }
    await createFeeTier(market, createFeeTierVars, admin)
  })

  it('Non-Admin #createFeeTier()', async () => {
    await sleep(1000)
    const createFeeTierVars: CreateFeeTier = {
      feeTier: feeTierUser,
      admin: user.publicKey
    }
    assertThrowsAsync(createFeeTier(market, createFeeTierVars, user), ERRORS.CONSTRAINT_RAW)
  })
})
