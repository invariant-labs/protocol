import * as anchor from '@project-serum/anchor'
import { Provider, BN, Program } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Market, Network, Pair, SEED, DENOMINATOR, TICK_LIMIT } from '@invariant-labs/sdk'
import { FeeTier } from '@invariant-labs/sdk/lib/market'
import { fromFee } from '@invariant-labs/sdk/lib/utils'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createToken } from './testUtils'
import { assert } from 'chai'
import { tou64 } from '@invariant-labs/sdk'

describe('protocol-fee', () => {
    const provider = Provider.local()
    const connection = provider.connection
    // @ts-expect-error
    const wallet = provider.wallet.payer as Keypair
    const mintAuthority = Keypair.generate()
    const positionOwner = Keypair.generate()
    const admin = Keypair.generate()
    const market = new Market(
        Network.LOCAL,
        provider.wallet,
        connection,
        anchor.workspace.Amm.programId
    )
    const feeTier: FeeTier = {
        fee: fromFee(new BN(600)),
        tickSpacing: 10
    }
    let pair: Pair
    let tokenX: Token
    let tokenY: Token
    let programAuthority: PublicKey
    let nonce: number

    before(async () => {
        await Promise.all([
            await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
            await connection.requestAirdrop(admin.publicKey, 1e9),
            await connection.requestAirdrop(positionOwner.publicKey, 1e9)
        ])

        const tokens = await Promise.all([
            createToken(connection, wallet, mintAuthority),
            createToken(connection, wallet, mintAuthority)
        ])

        const swaplineProgram = anchor.workspace.Amm as Program
        const [_programAuthority, _nonce] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from(SEED)],
            swaplineProgram.programId
        )
        nonce = _nonce
        programAuthority = _programAuthority

        pair = new Pair(tokens[0].publicKey, tokens[1].publicKey)
        tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
        tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)
    })

    it('#createFeeTier()', async () => {
        await market.createFeeTier(feeTier, wallet)
    })

    it('#create()', async () => {
        await market.create({
            pair,
            signer: admin,
            feeTier
        })

    const createdPool = await market.get(pair)
    assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
    assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
    assert.ok(createdPool.fee.v.eq(feeTier.fee))
    assert.equal(createdPool.tickSpacing, feeTier.tickSpacing)
    assert.ok(createdPool.liquidity.v.eqn(0))
    assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
    assert.ok(createdPool.currentTickIndex == 0)
    assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
    assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenX.v.eqn(0))
    assert.ok(createdPool.feeProtocolTokenY.v.eqn(0))
    assert.ok(createdPool.authority.equals(programAuthority))
    assert.ok(createdPool.nonce == nonce)

    const tickmapData = await market.getTickmap(pair)
    assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
    assert.ok(tickmapData.bitmap.every((v) => v == 0))
    })

    it('#initPosition()', async () => {
        const upperTick = 10
        const lowerTick = -20

        await market.createTick(pair, upperTick, wallet)
        await market.createTick(pair, lowerTick, wallet)

        const userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
        const userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)
        const mintAmount = tou64(new BN(10).pow(new BN(10)))

        await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
        await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)

        const liquidityDelta = { v: new BN(1000000).mul(DENOMINATOR) }

        await market.createPositionList(positionOwner)
        await market.initPosition(
            {
                pair,
                owner: positionOwner.publicKey,
                userTokenX: userTokenXAccount,
                userTokenY: userTokenYAccount,
                lowerTick,
                upperTick,
                liquidityDelta
            },
            positionOwner
        )

        assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta.v))
    })
})