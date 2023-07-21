
// import { Network, Market } from '@invariant-labs/sdk'
// import { sleep, assertThrowsAsync } from '@invariant-labs/sdk/lib/utils'
// import { CreateFeeTier, FeeTier } from '@invariant-labs/sdk/src/market'
// import { INVARIANT_ERRORS, fromFee } from '@invariant-labs/sdk/src/utils'
import { AnchorProvider } from '@project-serum/anchor'
import { createAccount } from '@solana/spl-token';
// import { BN } from '@project-serum/anchor'
import { ExtensionType, getMintLen, TOKEN_2022_PROGRAM_ID, createInitializeMintCloseAuthorityInstruction, createInitializeMintInstruction, Token, mintTo } from '@solana/spl-token'
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'


describe('token2022', () => {
    const payer = Keypair.generate();
    const provider = AnchorProvider.local()
    const tokenOwner = Keypair.generate();
    const connection = provider.connection

    const mintKeypair = Keypair.generate();
    const mintAuthority = Keypair.generate();
    const mint = mintKeypair.publicKey;

    // before(async () => {

    // })

    it('create token2022', async () => {

        const freezeAuthority = Keypair.generate();
        const closeAuthority = Keypair.generate();



        const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction({ signature: airdropSignature, ...(await connection.getLatestBlockhash()) });

        const extensions = [ExtensionType.MintCloseAuthority];
        const mintLen = getMintLen(extensions);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint,
                space: mintLen,
                lamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeMintCloseAuthorityInstruction(mint, closeAuthority.publicKey, TOKEN_2022_PROGRAM_ID),
            createInitializeMintInstruction(
                mint,
                9,
                mintAuthority.publicKey,
                freezeAuthority.publicKey,
                TOKEN_2022_PROGRAM_ID
            )
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);
    })
    it('mint some token', async () => {
        const sourceAccount = await createAccount(
            connection,
            payer,
            mint,
            tokenOwner.publicKey,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID
        );
        const mintAmount = BigInt(1_000_000_000);
        await mintTo(
            connection,
            payer,
            mint,
            sourceAccount,
            mintAuthority,
            mintAmount,
            [],
            undefined,
            TOKEN_2022_PROGRAM_ID
        );

    })
})
