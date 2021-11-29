import { Network } from '@invariant-labs/sdk'
import { Market } from '@invariant-labs/sdk'
import { sleep } from '@invariant-labs/sdk/lib/utils'
import { assertThrowsAsync } from '@invariant-labs/sdk/lib/utils'
import { Decimal, FeeTier } from '@invariant-labs/sdk/src/market'
import { ERRORS, fromFee } from '@invariant-labs/sdk/src/utils'
import * as anchor from '@project-serum/anchor'
import { BN, Provider } from '@project-serum/anchor'
import { Keypair } from '@solana/web3.js'

describe("fee-tier", () => {
    const provider = Provider.local()
    const connection = provider.connection
    // @ts-expect-error
    const wallet = provider.wallet.payer as Keypair
    const admin = Keypair.generate()
    const user = Keypair.generate()
    const market = new Market(
        Network.LOCAL,
        provider.wallet,
        connection,
        anchor.workspace.Amm.programId
    )
    const feeTierAdmin: FeeTier = {
        fee: fromFee(new BN(600)),
        tickSpacing: 10
    }
    const feeTierUser: FeeTier = {
        fee: fromFee(new BN(700)),
        tickSpacing: 10
    }
    const protocolFee: Decimal = { v: fromFee(new BN(10000)) }

    before(async () => {
        await Promise.all([
            await connection.requestAirdrop(admin.publicKey, 1e10),
            await connection.requestAirdrop(user.publicKey, 1e10)
        ])

    })

    it('#createState()', async () => {
        await sleep(1000)
        await market.createState(admin, protocolFee)
    })

    it('#createFeeTier()', async () => {
        await sleep(1000)
        await market.createFeeTier(feeTierAdmin, admin)
    })

    it('Non-Admin #createFeeTier()', async () => {
        await sleep(1000)
        assertThrowsAsync(market.createFeeTier(feeTierUser, user), ERRORS.CONSTRAINT_RAW)
    })
})