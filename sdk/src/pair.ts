import { PublicKey } from '@solana/web3.js'
import { utils } from '@project-serum/anchor'

const POOL_SEED = 'poolv1'

export class Pair {
  public tokenX: PublicKey
  public tokenY: PublicKey
  constructor(first: PublicKey, second: PublicKey) {
    if (first.equals(second)) {
      throw new Error('Pair must contain two unique public keys')
    }

    if (first.toString() < second.toString()) {
      this.tokenX = first
      this.tokenY = second
    } else {
      this.tokenX = second
      this.tokenY = first
    }
  }

  getAddressAndBump(programId: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [
        Buffer.from(utils.bytes.utf8.encode(POOL_SEED)),
        this.tokenX.toBuffer(),
        this.tokenY.toBuffer()
      ],
      programId
    )
  }

  getAddress(programId: PublicKey): Promise<PublicKey> {
    return this.getAddressAndBump(programId).then(([address, _]) => address)
  }
}
