import { Network, Market } from '@invariant-labs/sdk'
import { sleep, assertThrowsAsync } from '@invariant-labs/sdk/lib/utils'
import { CreateFeeTier, FeeTier } from '@invariant-labs/sdk/src/market'
import { INVARIANT_ERRORS, fromFee } from '@invariant-labs/sdk/src/utils'
import * as anchor from '@project-serum/anchor'
import { BN, Provider } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'

describe('fee-tier', () => {
  const provider = Provider.local()
  const connection = provider.connection
  const admin = Keypair.generate()
  const user = Keypair.generate()
  const feeTierAdmin: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 10
  }
  const feeTierUser: FeeTier = {
    fee: fromFee(new BN(700)),
    tickSpacing: 10
  }
  let market: Market

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    await Promise.all([
      connection.requestAirdrop(admin.publicKey, 1e10),
      connection.requestAirdrop(user.publicKey, 1e10)
    ])
  })

  it('#createState()', async () => {
    await sleep(1000)
    await market.createState(admin.publicKey, admin)
  })

  it('#createFeeTier()', async () => {
    await sleep(1000)
    const createFeeTierVars: CreateFeeTier = {
      feeTier: feeTierAdmin,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)
  })

  it('Non-Admin #createFeeTier()', async () => {
    await sleep(1000)
    const createFeeTierVars: CreateFeeTier = {
      feeTier: feeTierUser,
      admin: user.publicKey
    }
    await assertThrowsAsync(
      market.createFeeTier(createFeeTierVars, user),
      INVARIANT_ERRORS.INVALID_ADMIN
    )
  })
})
