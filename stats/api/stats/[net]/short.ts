import { VercelRequest, VercelResponse } from '@vercel/node'
import DEVNET_DATA from '../../../data/devnet.json'
import MAINNET_DATA from '../../../data/mainnet.json'
import { PoolSnapshot } from '../../../src/utils'

export default function (req: VercelRequest, res: VercelResponse) {
  // @ts-expect-error
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  let volume24 = 0
  let tvl = 0
  let fees24 = 0
  let snaps: Record<string, PoolSnapshot[]>

  const { net } = req.query
  if (net === 'devnet') {
    snaps = DEVNET_DATA
  } else if (net === 'mainnet') {
    snaps = MAINNET_DATA
  } else {
    res.status(400).send('INVALID NETWORK')
    return
  }

  Object.values(snaps).forEach(poolSnaps => {
    const snap = poolSnaps[poolSnaps.length - 1]
    volume24 += snap.volumeX.usdValue24 + snap.volumeY.usdValue24
    tvl += snap.liquidityX.usdValue24 + snap.liquidityY.usdValue24
    fees24 += snap.feeX.usdValue24 + snap.feeY.usdValue24
  })
  res.json({
    volume24,
    tvl,
    fees24
  })
}
