import * as anchor from '@project-serum/anchor'
import { Program, Provider, BN } from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { Market, Network, Pair, SEED, DENOMINATOR, TICK_LIMIT } from '@invariant-labs/sdk'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createToken } from './testUtils'
import { assert } from 'chai'
import { tou64 } from '@invariant-labs/sdk'

describe('timestamp', () => {
    const provider = Provider.local()
    const connection = provider.connection
    // @ts-expect-error
    const wallet = provider.wallet.payer as Keypair
    const mintAuthority = Keypair.generate()
    const admin = Keypair.generate()
    const market = new Market(
        Network.LOCAL,
        provider.wallet,
        connection,
        anchor.workspace.Amm.programId
    )
    let pair: Pair
    let tokenX: Token
    let tokenY: Token
    let programAuthority: PublicKey
    let nonce: number

    before(async () => {
        await Promise.all([
            await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
            await connection.requestAirdrop(admin.publicKey, 1e9)
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

    it('#create()', async () => {
        const fee = 600
        const tickSpacing = 10
        const feeDecimal = new BN(fee).mul(new BN(10).pow(new BN(12 - 5)))

        await market.create({
            pair,
            signer: admin,
            fee,
            tickSpacing
        })

        const createdPool = await market.get(pair)
        assert.ok(createdPool.tokenX.equals(tokenX.publicKey))
        assert.ok(createdPool.tokenY.equals(tokenY.publicKey))
        assert.ok(createdPool.fee.v.eq(feeDecimal))
        assert.ok(createdPool.liquidity.v.eqn(0))
        assert.ok(createdPool.sqrtPrice.v.eq(DENOMINATOR))
        assert.ok(createdPool.currentTickIndex == 0)
        assert.ok(createdPool.feeGrowthGlobalX.v.eqn(0))
        assert.ok(createdPool.feeGrowthGlobalY.v.eqn(0))
        assert.ok(createdPool.feeProtocolTokenX.v.eqn(0))
        assert.ok(createdPool.feeProtocolTokenY.v.eqn(0))
        assert.ok(createdPool.authority.equals(programAuthority))
        assert.equal(createdPool.nonce, nonce)

        const tickmapData = await market.getTickmap(pair)
        assert.ok(tickmapData.bitmap.length == TICK_LIMIT / 4)
        assert.ok(tickmapData.bitmap.every((v) => v == 0))
    })

    it('#swap', async () => {
        const mintAmount = tou64(new BN(10).pow(new BN(10)))

        const upperTick = 10
        await market.createTick(pair, upperTick, wallet)
        const midTick = -20
        await market.createTick(pair, midTick, wallet)
        const lowerTick = -30

        const positionOwner1 = Keypair.generate()
        await connection.requestAirdrop(positionOwner1.publicKey, 1e9)
        const user1TokenXAccount = await tokenX.createAccount(positionOwner1.publicKey)
        const user1TokenYAccount = await tokenY.createAccount(positionOwner1.publicKey)

        await tokenX.mintTo(user1TokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
        await tokenY.mintTo(user1TokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
        const liquidityDelta1 = { v: new BN(1000000).mul(DENOMINATOR)}

        await market.createPositionList(positionOwner1)
        await market.initPosition(
            {
                pair,
                owner: positionOwner1.publicKey,
                userTokenX: user1TokenXAccount,
                userTokenY: user1TokenYAccount,
                lowerTick: midTick,
                upperTick,
                liquidityDelta: liquidityDelta1
            },
            positionOwner1
        )
        
        
        assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta1.v))

        const positionOwner2 = Keypair.generate()
        await connection.requestAirdrop(positionOwner2.publicKey, 1e9)
        const user2TokenXAccount = await tokenX.createAccount(positionOwner2.publicKey)
        const user2TokenYAccount = await tokenY.createAccount(positionOwner2.publicKey)

        await tokenX.mintTo(user2TokenXAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
        await tokenY.mintTo(user2TokenYAccount, mintAuthority.publicKey, [mintAuthority], mintAmount)
        const liquidityDelta2 = { v: new BN(100000).mul(DENOMINATOR)}
        
        

        await market.createPositionList(positionOwner2)
        
        await market.initPosition(
            {
                pair,
                owner: positionOwner2.publicKey,
                userTokenX: user2TokenXAccount,
                userTokenY: user2TokenYAccount,
                lowerTick,
                upperTick: midTick,
                liquidityDelta: liquidityDelta2
            },
            positionOwner2
        )
        console.log("11111")
        assert.ok((await market.get(pair)).liquidity.v.eq(liquidityDelta1.v.add(liquidityDelta2.v)))
    })
})