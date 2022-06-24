import { Market, Network, Pair } from '@invariant-labs/sdk/src'
import { FEE_TIERS } from '@invariant-labs/sdk/src/utils'
import { Provider } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js'
// trunk-ignore(eslint/@typescript-eslint/no-var-requires)
require('dotenv').config()

const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const USDT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
const SNY = new PublicKey('4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y')
const WSOL = new PublicKey('So11111111111111111111111111111111111111112')
const UXD = new PublicKey('7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT')
const MSOL = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So')

const provider = Provider.local('https://api.mainnet-beta.solana.com', {
  skipPreflight: true
})

const connection = provider.connection

const main = async () => {
  const market = await Market.build(Network.MAIN, provider.wallet, connection)

  const usdcUsdt = await market.getPool(new Pair(USDC, USDT, FEE_TIERS[0]))
  if (usdcUsdt.tokenX.equals(USDC)) {
    console.log(`USDC = ${usdcUsdt.feeProtocolTokenX.toString()}`)
    console.log(`USDT = ${usdcUsdt.feeProtocolTokenY.toString()}`)
  } else {
    console.log(`USDC = ${usdcUsdt.feeProtocolTokenY.toString()}`)
    console.log(`USDT = ${usdcUsdt.feeProtocolTokenX.toString()}`)
  }

  const snyUsdc = await market.getPool(new Pair(USDC, SNY, FEE_TIERS[3]))
  if (snyUsdc.tokenX.equals(SNY)) {
    console.log(`SNY = ${snyUsdc.feeProtocolTokenX.toString()}`)
    console.log(`USDC = ${snyUsdc.feeProtocolTokenY.toString()}`)
  } else {
    console.log(`SNY = ${snyUsdc.feeProtocolTokenY.toString()}`)
    console.log(`USDC = ${snyUsdc.feeProtocolTokenX.toString()}`)
  }

  const wsolUSDC = await market.getPool(new Pair(USDC, WSOL, FEE_TIERS[1]))
  if (wsolUSDC.tokenX.equals(WSOL)) {
    console.log(`WSOL = ${wsolUSDC.feeProtocolTokenX.toString()}`)
    console.log(`USDC = ${wsolUSDC.feeProtocolTokenY.toString()}`)
  } else {
    console.log(`WSOL = ${wsolUSDC.feeProtocolTokenY.toString()}`)
    console.log(`USDC = ${wsolUSDC.feeProtocolTokenX.toString()}`)
  }

  const uxdUsdc = await market.getPool(new Pair(USDC, UXD, FEE_TIERS[0]))
  if (uxdUsdc.tokenX.equals(UXD)) {
    console.log(`UXD = ${uxdUsdc.feeProtocolTokenX.toString()}`)
    console.log(`USDC = ${uxdUsdc.feeProtocolTokenY.toString()}`)
  } else {
    console.log(`UXD = ${uxdUsdc.feeProtocolTokenY.toString()}`)
    console.log(`USDC = ${uxdUsdc.feeProtocolTokenX.toString()}`)
  }

  const msolUsdc = await market.getPool(new Pair(USDC, MSOL, FEE_TIERS[1]))
  if (msolUsdc.tokenX.equals(MSOL)) {
    console.log(`MSOL = ${msolUsdc.feeProtocolTokenX.toString()}`)
    console.log(`USDC = ${msolUsdc.feeProtocolTokenY.toString()}`)
  } else {
    console.log(`MSOL = ${msolUsdc.feeProtocolTokenY.toString()}`)
    console.log(`USDC = ${msolUsdc.feeProtocolTokenX.toString()}`)
  }
}

main()
