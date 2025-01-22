import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

// function only available in higher versions of spl-token than current 0.1.8
export function getAssociatedTokenAddress(owner: PublicKey, token: PublicKey) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), token.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return address
}
