import { PublicKey } from '@solana/web3.js'
import { utils, BN } from '@project-serum/anchor'
import { FeeTier } from './market'
import { bigNumberToBuffer, feeToTickSpacing, getFeeTierAddress } from './utils'

const POOL_SEED = 'poolv1'

export class Pair {
  public tokenX: PublicKey
  public tokenY: PublicKey
  public feeTier: FeeTier
  public feeTierAddress: PublicKey | null
  public tickSpacing: number

  constructor(first: PublicKey, second: PublicKey, feeTier: FeeTier) {
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
    this.tickSpacing = feeTier.tickSpacing ?? feeToTickSpacing(feeTier.fee)
    this.feeTier = {
      fee: feeTier.fee,
      tickSpacing: this.tickSpacing
    }
    this.feeTierAddress = null

    if (this.feeTier.tickSpacing == null) {
      this.feeTier.tickSpacing = feeToTickSpacing(this.feeTier.fee)
    }
  }

  async getAddressAndBump(programId: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from(utils.bytes.utf8.encode(POOL_SEED)),
        this.tokenX.toBuffer(),
        this.tokenY.toBuffer(),
        bigNumberToBuffer(this.feeTier.fee, 128),
        bigNumberToBuffer(new BN(this.feeTier.tickSpacing as number), 16)
      ],
      programId
    )
  }

  async getAddress(programId: PublicKey): Promise<PublicKey> {
    return await this.getAddressAndBump(programId).then(([address, _]) => address)
  }

  async getFeeTierAddress(programId: PublicKey) {
    if (this.feeTierAddress == null) {
      const { address: feeTierAddress } = await getFeeTierAddress(this.feeTier, programId)
      this.feeTierAddress = feeTierAddress
    }
    return this.feeTierAddress
  }
}
