import * as anchor from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { assert } from 'chai'
import { Market, Pair, fromInteger, Network, sleep } from '@invariant-labs/sdk/src'
import { Provider, BN } from '@project-serum/anchor'
import { Token, u64, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createToken, eqDecimal, positionEquals, positionWithoutOwnerEquals } from './testUtils'
import { assertThrowsAsync, tou64 } from '@invariant-labs/sdk/src/utils'
import { ERRORS, fromFee, toDecimal } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, PositionStructure, Swap } from '@invariant-labs/sdk/lib/market'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  InitPosition,
  RemovePosition,
  TransferPositionOwnership
} from '@invariant-labs/sdk/src/market'
import { calculatePriceSqrt } from '@invariant-labs/sdk'

describe('Position list', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 3
  }
  let market: Market
  let pair: Pair
  let tokenX: Token
  let tokenY: Token
  let initTick: number
  let ticksIndexes: number[]
  let xOwnerAmount: u64
  let yOwnerAmount: u64
  let userTokenXAccount: PublicKey
  let userTokenYAccount: PublicKey

  before(async () => {
    market = await Market.build(
      Network.LOCAL,
      provider.wallet,
      connection,
      anchor.workspace.Invariant.programId
    )

    // Request airdrops
    await Promise.all([
      connection.requestAirdrop(wallet.publicKey, 1e9),
      connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      connection.requestAirdrop(admin.publicKey, 1e9),
      connection.requestAirdrop(positionOwner.publicKey, 1e9)
    ])
    // Create pair
    const tokens = await Promise.all([
      createToken(connection, wallet, mintAuthority),
      createToken(connection, wallet, mintAuthority)
    ])
    pair = new Pair(tokens[0].publicKey, tokens[1].publicKey, feeTier)
    tokenX = new Token(connection, pair.tokenX, TOKEN_PROGRAM_ID, wallet)
    tokenY = new Token(connection, pair.tokenY, TOKEN_PROGRAM_ID, wallet)

    // user deposit
    userTokenXAccount = await tokenX.createAccount(positionOwner.publicKey)
    userTokenYAccount = await tokenY.createAccount(positionOwner.publicKey)

    await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
    await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

    await market.createState(admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await market.createFeeTier(createFeeTierVars, admin)
  })
  describe('Settings', () => {
    it('Prepare pool', async () => {
      initTick = -23028

      const createPoolVars: CreatePool = {
        pair,
        payer: admin,
        initTick
      }
      await market.createPool(createPoolVars)
      await market.createPositionList(positionOwner.publicKey, positionOwner)

      ticksIndexes = [-9780, -42, 0, 9, 276, 32343, -50001]
      await Promise.all(
        ticksIndexes.map(async tickIndex => {
          const createTickVars: CreateTick = {
            index: tickIndex,
            pair,
            payer: admin.publicKey
          }
          await market.createTick(createTickVars, admin)
        })
      )
    })
  })
  // describe('#RemovePosition()', () => {
  //   it('Remove from empty list should failed', async () => {
  //     const removePositionVars: RemovePosition = {
  //       index: 0,
  //       pair,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       owner: positionOwner.publicKey
  //     }
  //     await assertThrowsAsync(market.removePosition(removePositionVars, positionOwner))
  //   })
  //   it('Add multiple position', async () => {
  //     xOwnerAmount = tou64(1e10)
  //     yOwnerAmount = tou64(1e10)

  //     await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
  //     await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

  //     const initPositionVars: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[0],
  //       upperTick: ticksIndexes[1],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars, positionOwner)

  //     // create position with the same tick should pass
  //     await market.initPosition(initPositionVars, positionOwner)

  //     const initPositionVars2: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[0],
  //       upperTick: ticksIndexes[2],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars2, positionOwner)

  //     const initPositionVars3: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[1],
  //       upperTick: ticksIndexes[4],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars3, positionOwner)
  //   })
  //   it('Remove middle position', async () => {
  //     const positionIndexToRemove = 2
  //     const positionListBefore = await market.getPositionList(positionOwner.publicKey)
  //     const positionsBefore = await market.getPositionsFromRange(
  //       positionOwner.publicKey,
  //       0,
  //       positionListBefore.head - 1
  //     )
  //     const lastPosition = positionsBefore[positionListBefore.head - 1]

  //     const removePositionVars: RemovePosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       index: positionIndexToRemove,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount
  //     }
  //     await market.removePosition(removePositionVars, positionOwner)

  //     const positionListAfter = await market.getPositionList(positionOwner.publicKey)
  //     const positionsAfter = await market.getPositionsFromRange(
  //       positionOwner.publicKey,
  //       0,
  //       positionListAfter.head - 1
  //     )

  //     // check position list head
  //     assert.ok(positionListBefore.head - 1 === positionListAfter.head)

  //     // last position should be at removed index
  //     const testedPosition = positionsAfter[positionIndexToRemove]
  //     assert.ok(lastPosition.pool.equals(testedPosition.pool))
  //     assert.ok(lastPosition.id.eq(testedPosition.id))
  //     assert.ok(eqDecimal(lastPosition.liquidity, testedPosition.liquidity))
  //     assert.ok(lastPosition.lowerTickIndex === testedPosition.lowerTickIndex)
  //     assert.ok(lastPosition.upperTickIndex === testedPosition.upperTickIndex)
  //     assert.ok(eqDecimal(lastPosition.feeGrowthInsideX, testedPosition.feeGrowthInsideX))
  //     assert.ok(eqDecimal(lastPosition.feeGrowthInsideY, testedPosition.feeGrowthInsideY))
  //     assert.ok(eqDecimal(lastPosition.tokensOwedX, testedPosition.tokensOwedX))
  //     assert.ok(eqDecimal(lastPosition.tokensOwedY, testedPosition.tokensOwedY))
  //   })
  //   it('Add position in place of the removed one', async () => {
  //     const positionListBefore = await market.getPositionList(positionOwner.publicKey)

  //     const createTickVars: CreateTick = {
  //       pair,
  //       index: ticksIndexes[2],
  //       payer: admin.publicKey
  //     }
  //     await market.createTick(createTickVars, admin)

  //     const initPositionVars: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[1],
  //       upperTick: ticksIndexes[2],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars, positionOwner)
  //     const positionListAfter = await market.getPositionList(positionOwner.publicKey)

  //     assert.equal(positionListBefore.head + 1, positionListAfter.head)
  //   })
  //   it('Remove last position', async () => {
  //     const lastPositionIndexBefore =
  //       (await market.getPositionList(positionOwner.publicKey)).head - 1

  //     const removePositionVars: RemovePosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       index: lastPositionIndexBefore,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount
  //     }
  //     await market.removePosition(removePositionVars, positionOwner)

  //     const lastPositionIndexAfter =
  //       (await market.getPositionList(positionOwner.publicKey)).head - 1
  //     assert.equal(lastPositionIndexBefore - 1, lastPositionIndexAfter)
  //   })
  //   it('Only owner can modify position list', async () => {
  //     const positionListBefore = await market.getPositionList(positionOwner.publicKey)
  //     const initPositionVars: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[0],
  //       upperTick: ticksIndexes[3],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     const removePositionVars: RemovePosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       index: 0,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount
  //     }

  //     await assertThrowsAsync(market.initPosition(initPositionVars, wallet), ERRORS.SIGNATURE)
  //     await assertThrowsAsync(market.removePosition(removePositionVars, wallet), ERRORS.SIGNATURE)

  //     const positionListAfter = await market.getPositionList(positionOwner.publicKey)
  //     assert.equal(positionListBefore.head, positionListAfter.head)
  //   })
  //   it('Remove all positions', async () => {
  //     const positionListBefore = await market.getPositionList(positionOwner.publicKey)

  //     for (let i = positionListBefore.head - 1; i >= 0; i--) {
  //       const removePositionVars: RemovePosition = {
  //         pair,
  //         owner: positionOwner.publicKey,
  //         index: i,
  //         userTokenX: userTokenXAccount,
  //         userTokenY: userTokenYAccount
  //       }
  //       await market.removePosition(removePositionVars, positionOwner)
  //     }
  //     const positionListAfter = await market.getPositionList(positionOwner.publicKey)
  //     assert.equal(positionListAfter.head, 0)
  //   })
  //   it('Add position to cleared list', async () => {
  //     const positionListBefore = await market.getPositionList(positionOwner.publicKey)

  //     const createTickVars: CreateTick = {
  //       pair,
  //       index: ticksIndexes[0],
  //       payer: admin.publicKey
  //     }
  //     await market.createTick(createTickVars, admin)

  //     const createTickVars2: CreateTick = {
  //       pair,
  //       index: ticksIndexes[1],
  //       payer: admin.publicKey
  //     }
  //     await market.createTick(createTickVars2, admin)

  //     const initPositionVars: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[0],
  //       upperTick: ticksIndexes[1],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars, positionOwner)

  //     const positionListAfter = await market.getPositionList(positionOwner.publicKey)
  //     assert.equal(positionListBefore.head + 1, positionListAfter.head)
  //   })
  // })
  // describe('#TransferPositionOwnership', () => {
  //   const positionRecipient = Keypair.generate()
  //   before(async () => {
  //     // prepare recipient
  //     await connection.requestAirdrop(positionRecipient.publicKey, 1e9)
  //     await sleep(2000)
  //     await market.createPositionList(positionRecipient.publicKey, positionRecipient)

  //     const createTickVars: CreateTick = {
  //       pair,
  //       index: ticksIndexes[2],
  //       payer: admin.publicKey
  //     }
  //     await market.createTick(createTickVars, admin)
  //     // init positions
  //     const initPositionVars: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[0],
  //       upperTick: ticksIndexes[1],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars, positionOwner)

  //     const initPositionVars2: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[1],
  //       upperTick: ticksIndexes[2],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars2, positionOwner)

  //     const initPositionVars3: InitPosition = {
  //       pair,
  //       owner: positionOwner.publicKey,
  //       userTokenX: userTokenXAccount,
  //       userTokenY: userTokenYAccount,
  //       lowerTick: ticksIndexes[1],
  //       upperTick: ticksIndexes[3],
  //       liquidityDelta: fromInteger(1),
  //       knownPrice: calculatePriceSqrt(initTick),
  //       slippage: { v: new BN(0) }
  //     }
  //     await market.initPosition(initPositionVars3, positionOwner)
  //   })
  //   it('only owner can transfer position', async () => {
  //     const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)

  //     const transferPositionOwnershipVars: TransferPositionOwnership = {
  //       index: 0,
  //       owner: positionOwner.publicKey,
  //       recipient: positionRecipient.publicKey
  //     }
  //     await assertThrowsAsync(
  //       market.transferPositionOwnership(transferPositionOwnershipVars, positionRecipient),
  //       ERRORS.SIGNATURE
  //     )

  //     const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
  //     assert.equal(ownerListBefore.head, ownerListAfter.head)
  //     assert.equal(recipientListBefore.head, recipientListAfter.head)
  //   })
  //   it('transfer first position', async () => {
  //     const transferredIndex = 0
  //     const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
  //     const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)
  //     const lastPositionBefore = await market.getPosition(
  //       positionOwner.publicKey,
  //       ownerListBefore.head - 1
  //     )

  //     const transferPositionOwnershipVars: TransferPositionOwnership = {
  //       index: transferredIndex,
  //       owner: positionOwner.publicKey,
  //       recipient: positionRecipient.publicKey
  //     }
  //     await market.transferPositionOwnership(transferPositionOwnershipVars, positionOwner)

  //     const recipientPosition = await market.getPosition(positionRecipient.publicKey, 0)
  //     const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
  //     const firstPositionAfter = await market.getPosition(positionOwner.publicKey, transferredIndex)

  //     // move last position
  //     assert.ok(positionEquals(lastPositionBefore, firstPositionAfter))

  //     // equals fields of transferred position
  //     assert.ok(positionWithoutOwnerEquals(removedPosition, recipientPosition))
  //     assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

  //     // positions length
  //     assert.equal(ownerListBefore.head - 1, ownerListAfter.head)
  //     assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
  //   })
  //   it('transfer middle position', async () => {
  //     const transferredIndex = 1 // middle index
  //     const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
  //     const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)
  //     const lastPositionBefore = await market.getPosition(
  //       positionOwner.publicKey,
  //       ownerListBefore.head - 1
  //     )

  //     const transferPositionOwnershipVars: TransferPositionOwnership = {
  //       index: transferredIndex,
  //       owner: positionOwner.publicKey,
  //       recipient: positionRecipient.publicKey
  //     }
  //     await market.transferPositionOwnership(transferPositionOwnershipVars, positionOwner)

  //     const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
  //     const recipientPosition = await market.getPosition(
  //       positionRecipient.publicKey,
  //       recipientListAfter.head - 1
  //     )
  //     const middlePositionAfter = await market.getPosition(
  //       positionOwner.publicKey,
  //       transferredIndex
  //     )

  //     // move last position
  //     assert.ok(positionEquals(lastPositionBefore, middlePositionAfter))

  //     // equals fields of transferred position
  //     assert.ok(positionWithoutOwnerEquals(removedPosition, recipientPosition))
  //     assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

  //     // positions length
  //     assert.equal(ownerListBefore.head - 1, ownerListAfter.head)
  //     assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
  //   })
  //   it('transfer last position', async () => {
  //     const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
  //     const transferredIndex = ownerListBefore.head - 1
  //     const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
  //     const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)

  //     const transferPositionOwnershipVars: TransferPositionOwnership = {
  //       index: transferredIndex,
  //       owner: positionOwner.publicKey,
  //       recipient: positionRecipient.publicKey
  //     }
  //     await market.transferPositionOwnership(transferPositionOwnershipVars, positionOwner)

  //     const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
  //     const recipientPosition = await market.getPosition(
  //       positionRecipient.publicKey,
  //       recipientListAfter.head - 1
  //     )

  //     // equals fields of transferred position
  //     assert.ok(positionWithoutOwnerEquals(removedPosition, recipientPosition))
  //     assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

  //     // positions length
  //     assert.equal(ownerListBefore.head - 1, ownerListAfter.head)
  //     assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
  //   })
  //   it('clear position', async () => {
  //     const transferredIndex = 0
  //     const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
  //     const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)

  //     const transferPositionOwnershipVars: TransferPositionOwnership = {
  //       index: transferredIndex,
  //       owner: positionOwner.publicKey,
  //       recipient: positionRecipient.publicKey
  //     }
  //     await market.transferPositionOwnership(transferPositionOwnershipVars, positionOwner)

  //     const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
  //     const recipientPosition = await market.getPosition(
  //       positionRecipient.publicKey,
  //       recipientListAfter.head - 1
  //     )

  //     // equals fields of transferred position
  //     assert.ok(positionWithoutOwnerEquals(removedPosition, recipientPosition))
  //     assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

  //     // positions length
  //     assert.equal(ownerListAfter.head, 0)
  //     assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
  //   })
  //   it('get back position', async () => {
  //     const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
  //     const transferredIndex = 0
  //     const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
  //     const lastPositionBefore = await market.getPosition(
  //       positionRecipient.publicKey,
  //       recipientListBefore.head - 1
  //     )
  //     const removedPosition = await market.getPosition(
  //       positionRecipient.publicKey,
  //       transferredIndex
  //     )

  //     const transferPositionOwnershipVars: TransferPositionOwnership = {
  //       index: transferredIndex,
  //       owner: positionRecipient.publicKey,
  //       recipient: positionOwner.publicKey
  //     }
  //     await market.transferPositionOwnership(transferPositionOwnershipVars, positionRecipient)

  //     const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
  //     const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
  //     const firstPositionAfter = await market.getPosition(positionRecipient.publicKey, 0)
  //     const ownerNewPosition = await market.getPosition(
  //       positionOwner.publicKey,
  //       ownerListAfter.head - 1
  //     )

  //     // move last position
  //     assert.ok(positionEquals(lastPositionBefore, firstPositionAfter))

  //     // equals fields of transferred position
  //     assert.ok(positionWithoutOwnerEquals(removedPosition, ownerNewPosition))
  //     assert.ok(ownerNewPosition.owner.equals(positionOwner.publicKey))

  //     // positions length
  //     assert.equal(ownerListBefore.head + 1, ownerListAfter.head)
  //     assert.equal(recipientListBefore.head - 1, recipientListAfter.head)
  //   })
  // })
  describe('#getAllUserPositions()', () => {
    it('Add multiple position', async () => {
      xOwnerAmount = tou64(new BN(1e10))
      yOwnerAmount = tou64(new BN(1e10))
      await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
      await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)
      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: -50_001,
        upperTick: 0,
        liquidityDelta: fromInteger(1),
        knownPrice: calculatePriceSqrt(initTick),
        slippage: { v: new BN(0) }
      }
      await market.initPosition(initPositionVars, positionOwner)
      // create position with the same tick should pass
      // await market.initPosition(initPositionVars, positionOwner)
      // const initPositionVars2: InitPosition = {
      //   pair,
      //   owner: positionOwner.publicKey,
      //   userTokenX: userTokenXAccount,
      //   userTokenY: userTokenYAccount,
      //   lowerTick: ticksIndexes[0],
      //   upperTick: ticksIndexes[2],
      //   liquidityDelta: fromInteger(1),
      //   knownPrice: calculatePriceSqrt(initTick),
      //   slippage: { v: new BN(0) }
      // }
      // await market.initPosition(initPositionVars2, positionOwner)
    })
    /////// make test with swap
    it('swap', async () => {
      const poolDataBefore = await market.getPool(pair)
      const swapVars: Swap = {
        pair,
        xToY: true,
        amount: new BN(10000),
        estimatedPriceAfterSwap: poolDataBefore.sqrtPrice, // ignore price impact using high slippage tolerance
        slippage: toDecimal(1, 2),
        accountX: userTokenXAccount,
        accountY: userTokenYAccount,
        byAmountIn: true,
        owner: positionOwner.publicKey
      }
      await market.swap(swapVars, positionOwner)
    })

    it('get all user positions ', async () => {
      const positions: PositionStructure[] = await market.getAllUserPositions(
        positionOwner.publicKey
      )
      const position = await market.getPosition(positionOwner.publicKey, 0)
      console.log(position.tokensOwedY.v.toString())
      // tokenX: PublicKey;
      // tokenY: PublicKey;
      // feeTier: FeeTier;
      // amountTokenX: BN;
      // amountTokenY: BN;
      // lowerPrice: Decimal;
      // upperPrice: Decimal;
      // unclaimedFeesX: BN;
      // unclaimedFeesY: BN;

      // logs
      console.log('########################################')
      console.log('token X pubkey', positions[0].tokenX.toString())
      console.log('token Y pubkey', positions[0].tokenY.toString())
      console.log('fee', positions[0].feeTier.fee.toString())
      console.log('amount X', positions[0].amountTokenX.toString())
      console.log('amount Y', positions[0].amountTokenY.toString())
      console.log('lower price', positions[0].lowerPrice.v.toString())
      console.log('upper price', positions[0].upperPrice.v.toString())
      console.log('unclaimed fee X', positions[0].unclaimedFeesX.toString())
      console.log('unclaimed fee Y', positions[0].unclaimedFeesY.toString())
      console.log('########################################')
      //checks
      assert.equal(positions.length, 1)
      assert.ok(positions[0].tokenX.equals(pair.tokenX))
      assert.ok(positions[0].tokenY.equals(pair.tokenY))
      assert.ok(positions[0].feeTier.fee.eq(pair.feeTier.fee))
      //assert.ok(positions[0].amountTokenX.eq(new BN(xOwnerAmount)))
      //assert.ok(positions[0].amountTokenY.eq(new BN(yOwnerAmount)))
    })
  })
})

//6738_957698_696115_374596_000000_000000_000000_000000
