import { BN } from '@project-serum/anchor'
import { FeeTier } from './market'
import { fromFee } from './utils'

export const FEE_TIERS: Array<FeeTier> = [
  { fee: fromFee(new BN(20)) },
  { fee: fromFee(new BN(40)) },
  { fee: fromFee(new BN(100)) },
  { fee: fromFee(new BN(300)) },
  { fee: fromFee(new BN(1000)) }
]
