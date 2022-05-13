import { VercelRequest, VercelResponse } from '@vercel/node'
import DEVNET_QUOTIENTS from '../../../../data/v2/quotients_devnet.json'
import MAINNET_QUOTIENTS from '../../../../data/v2/quotients_mainnet.json'

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

  const { net } = req.query
  if (net === 'devnet') {
    res.json(DEVNET_QUOTIENTS)
    return
  }
  if (net === 'mainnet') {
    res.json(MAINNET_QUOTIENTS)
    return
  }
  res.status(400).send('INVALID NETWORK')
}
