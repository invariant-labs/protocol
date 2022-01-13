import * as anchor from '@project-serum/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { assert } from 'chai'
import { Market, Pair, tou64, fromInteger, Network, sleep } from '@invariant-labs/sdk'
import { Provider, BN } from '@project-serum/anchor'
import { Token, u64, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  createFeeTier,
  createPool,
  createPositionList,
  createState,
  createTick,
  createToken,
  eqDecimal,
  initPosition,
  positionEquals,
  positionWithoutOwnerEquals,
  removePosition,
  transferPositionOwnership
} from './testUtils'
import { assertThrowsAsync } from '@invariant-labs/sdk/src/utils'
import { ERRORS, fromFee } from '@invariant-labs/sdk/lib/utils'
import { FeeTier, Decimal } from '@invariant-labs/sdk/lib/market'
import {
  CreateFeeTier,
  CreatePool,
  CreateTick,
  InitPosition,
  RemovePosition,
  TransferPositionOwnership
} from '@invariant-labs/sdk/src/market'

describe('Position list', () => {
  const provider = Provider.local()
  const connection = provider.connection
  // @ts-expect-error
  const wallet = provider.wallet.payer as Keypair
  const mintAuthority = Keypair.generate()
  const positionOwner = Keypair.generate()
  const admin = Keypair.generate()
  let market: Market
  const feeTier: FeeTier = {
    fee: fromFee(new BN(600)),
    tickSpacing: 3
  }
  const protocolFee: Decimal = { v: fromFee(new BN(10000)) }
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
      anchor.workspace.Amm.programId
    )

    // Request airdrops
    await Promise.all([
      await connection.requestAirdrop(wallet.publicKey, 1e9),
      await connection.requestAirdrop(mintAuthority.publicKey, 1e9),
      await connection.requestAirdrop(admin.publicKey, 1e9),
      await connection.requestAirdrop(positionOwner.publicKey, 1e9)
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

    await createState(market, admin.publicKey, admin)

    const createFeeTierVars: CreateFeeTier = {
      feeTier,
      admin: admin.publicKey
    }
    await createFeeTier(market, createFeeTierVars, admin)
  })
  describe('Settings', async () => {
    it('Prepare pool', async () => {
      initTick = -23028

      const createPoolVars: CreatePool = {
        pair,
        payer: admin,
        protocolFee,
        tokenX,
        tokenY,
        initTick
      }
      await createPool(market, createPoolVars)
      await createPositionList(market, positionOwner.publicKey, positionOwner)

      ticksIndexes = [-9780, -42, 0, 9, 276, 32343]
      Promise.all(
        ticksIndexes.map(async tickIndex => {
          const createTickVars: CreateTick = {
            index: tickIndex,
            pair,
            payer: admin.publicKey
          }
          await createTick(market, createTickVars, wallet)
        })
      )
    })
  })
  describe('#RemovePosition()', async () => {
    it('Remove from empty list should failed', async () => {
      const removePositionVars: RemovePosition = {
        index: 0,
        pair,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        owner: positionOwner.publicKey
      }
      assertThrowsAsync(removePosition(market, removePositionVars, positionOwner))
    })
    it('Add multiple position', async () => {
      xOwnerAmount = tou64(1e10)
      yOwnerAmount = tou64(1e10)

      await tokenX.mintTo(userTokenXAccount, mintAuthority.publicKey, [mintAuthority], xOwnerAmount)
      await tokenY.mintTo(userTokenYAccount, mintAuthority.publicKey, [mintAuthority], yOwnerAmount)

      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[1],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars, positionOwner)

      // create position with the same tick should pass
      await initPosition(market, initPositionVars, positionOwner)

      const initPositionVars2: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[2],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars2, positionOwner)

      const initPositionVars3: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[1],
        upperTick: ticksIndexes[4],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars3, positionOwner)
    })
    it('Remove middle position', async () => {
      const positionIndexToRemove = 2
      const positionListBefore = await market.getPositionList(positionOwner.publicKey)
      const positionsBefore = await market.getPositionsFromRange(
        positionOwner.publicKey,
        0,
        positionListBefore.head - 1
      )
      const lastPosition = positionsBefore[positionListBefore.head - 1]

      const removePositionVars: RemovePosition = {
        pair,
        owner: positionOwner.publicKey,
        index: positionIndexToRemove,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount
      }
      await removePosition(market, removePositionVars, positionOwner)

      const positionListAfter = await market.getPositionList(positionOwner.publicKey)
      const positionsAfter = await market.getPositionsFromRange(
        positionOwner.publicKey,
        0,
        positionListAfter.head - 1
      )

      // check position list head
      assert.ok(positionListBefore.head - 1 == positionListAfter.head)

      // last position should be at removed index
      const testedPosition = positionsAfter[positionIndexToRemove]
      assert.ok(lastPosition.pool.equals(testedPosition.pool))
      assert.ok(lastPosition.id.eq(testedPosition.id))
      assert.ok(eqDecimal(lastPosition.liquidity, testedPosition.liquidity))
      assert.ok(lastPosition.lowerTickIndex === testedPosition.lowerTickIndex)
      assert.ok(lastPosition.upperTickIndex === testedPosition.upperTickIndex)
      assert.ok(eqDecimal(lastPosition.feeGrowthInsideX, testedPosition.feeGrowthInsideX))
      assert.ok(eqDecimal(lastPosition.feeGrowthInsideY, testedPosition.feeGrowthInsideY))
      assert.ok(eqDecimal(lastPosition.tokensOwedX, testedPosition.tokensOwedX))
      assert.ok(eqDecimal(lastPosition.tokensOwedY, testedPosition.tokensOwedY))
    })
    it('Add position in place of the removed one', async () => {
      const positionListBefore = await market.getPositionList(positionOwner.publicKey)

      const createTickVars: CreateTick = {
        pair,
        index: ticksIndexes[2],
        payer: admin.publicKey
      }
      await createTick(market, createTickVars, admin)

      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[1],
        upperTick: ticksIndexes[2],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars, positionOwner)
      const positionListAfter = await market.getPositionList(positionOwner.publicKey)

      assert.equal(positionListBefore.head + 1, positionListAfter.head)
    })
    it('Remove last position', async () => {
      const lastPositionIndexBefore =
        (await market.getPositionList(positionOwner.publicKey)).head - 1

      const removePositionVars: RemovePosition = {
        pair,
        owner: positionOwner.publicKey,
        index: lastPositionIndexBefore,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount
      }
      await removePosition(market, removePositionVars, positionOwner)

      const lastPositionIndexAfter =
        (await market.getPositionList(positionOwner.publicKey)).head - 1
      assert.equal(lastPositionIndexBefore - 1, lastPositionIndexAfter)
    })
    it('Only owner can modify position list', async () => {
      const positionListBefore = await market.getPositionList(positionOwner.publicKey)
      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[3],
        liquidityDelta: fromInteger(1)
      }
      const removePositionVars: RemovePosition = {
        pair,
        owner: positionOwner.publicKey,
        index: 0,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount
      }

      assertThrowsAsync(initPosition(market, initPositionVars, wallet), ERRORS.SIGNATURE)
      assertThrowsAsync(removePosition(market, removePositionVars, wallet), ERRORS.SIGNATURE)

      const positionListAfter = await market.getPositionList(positionOwner.publicKey)
      assert.equal(positionListBefore.head, positionListAfter.head)
    })
    it('Remove all positions', async () => {
      const positionListBefore = await market.getPositionList(positionOwner.publicKey)

      for (let i = positionListBefore.head - 1; i >= 0; i--) {
        const removePositionVars: RemovePosition = {
          pair,
          owner: positionOwner.publicKey,
          index: i,
          userTokenX: userTokenXAccount,
          userTokenY: userTokenYAccount
        }
        await removePosition(market, removePositionVars, positionOwner)
      }
      const positionListAfter = await market.getPositionList(positionOwner.publicKey)
      assert.equal(positionListAfter.head, 0)
    })
    it('Add position to cleared list', async () => {
      const positionListBefore = await market.getPositionList(positionOwner.publicKey)

      const createTickVars: CreateTick = {
        pair,
        index: ticksIndexes[0],
        payer: admin.publicKey
      }
      await createTick(market, createTickVars, admin)

      const createTickVars2: CreateTick = {
        pair,
        index: ticksIndexes[1],
        payer: admin.publicKey
      }
      await createTick(market, createTickVars2, admin)

      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[1],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars, positionOwner)

      const positionListAfter = await market.getPositionList(positionOwner.publicKey)
      assert.equal(positionListBefore.head + 1, positionListAfter.head)
    })
  })
  describe('#TransferPositionOwnership', async () => {
    const positionRecipient = Keypair.generate()
    before(async () => {
      // prepare recipient
      await connection.requestAirdrop(positionRecipient.publicKey, 1e9)
      await sleep(2000)
      createPositionList(market, positionRecipient.publicKey, positionRecipient)

      const createTickVars: CreateTick = {
        pair,
        index: ticksIndexes[2],
        payer: admin.publicKey
      }
      await createTick(market, createTickVars, admin)
      // init positions
      const initPositionVars: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[0],
        upperTick: ticksIndexes[1],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars, positionOwner)

      const initPositionVars2: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[1],
        upperTick: ticksIndexes[2],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars2, positionOwner)

      const initPositionVars3: InitPosition = {
        pair,
        owner: positionOwner.publicKey,
        userTokenX: userTokenXAccount,
        userTokenY: userTokenYAccount,
        lowerTick: ticksIndexes[1],
        upperTick: ticksIndexes[3],
        liquidityDelta: fromInteger(1)
      }
      await initPosition(market, initPositionVars3, positionOwner)
    })
    it('only owner can transfer position', async () => {
      const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
      const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)

      const transferPositionOwnershipVars: TransferPositionOwnership = {
        index: 0,
        owner: positionOwner.publicKey,
        recipient: positionRecipient.publicKey
      }
      await assertThrowsAsync(
        transferPositionOwnership(market, transferPositionOwnershipVars, positionRecipient),
        ERRORS.SIGNATURE
      )

      const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
      const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
      assert.equal(ownerListBefore.head, ownerListAfter.head)
      assert.equal(recipientListBefore.head, recipientListAfter.head)
    })
    it('transfer first position', async () => {
      const transferredIndex = 0
      const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
      const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
      const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)
      const lastPositionBefore = await market.getPosition(
        positionOwner.publicKey,
        ownerListBefore.head - 1
      )

      const transferPositionOwnershipVars: TransferPositionOwnership = {
        index: transferredIndex,
        owner: positionOwner.publicKey,
        recipient: positionRecipient.publicKey
      }
      await transferPositionOwnership(market, transferPositionOwnershipVars, positionOwner)

      const recipientPosition = await market.getPosition(positionRecipient.publicKey, 0)
      const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
      const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
      const firstPositionAfter = await market.getPosition(positionOwner.publicKey, transferredIndex)

      // move last position
      positionEquals(lastPositionBefore, firstPositionAfter)

      // equals fields of transferred position
      positionWithoutOwnerEquals(removedPosition, recipientPosition)
      assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

      // positions length
      assert.equal(ownerListBefore.head - 1, ownerListAfter.head)
      assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
    })
    it('transfer middle position', async () => {
      const transferredIndex = 1 // middle index
      const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
      const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
      const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)
      const lastPositionBefore = await market.getPosition(
        positionOwner.publicKey,
        ownerListBefore.head - 1
      )

      const transferPositionOwnershipVars: TransferPositionOwnership = {
        index: transferredIndex,
        owner: positionOwner.publicKey,
        recipient: positionRecipient.publicKey
      }
      await transferPositionOwnership(market, transferPositionOwnershipVars, positionOwner)

      const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
      const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
      const recipientPosition = await market.getPosition(
        positionRecipient.publicKey,
        recipientListAfter.head - 1
      )
      const middlePositionAfter = await market.getPosition(
        positionOwner.publicKey,
        transferredIndex
      )

      // move last position
      positionEquals(lastPositionBefore, middlePositionAfter)

      // equals fields of transferred position
      positionWithoutOwnerEquals(removedPosition, recipientPosition)
      assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

      // positions length
      assert.equal(ownerListBefore.head - 1, ownerListAfter.head)
      assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
    })
    it('transfer last position', async () => {
      const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
      const transferredIndex = ownerListBefore.head - 1
      const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
      const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)

      const transferPositionOwnershipVars: TransferPositionOwnership = {
        index: transferredIndex,
        owner: positionOwner.publicKey,
        recipient: positionRecipient.publicKey
      }
      await transferPositionOwnership(market, transferPositionOwnershipVars, positionOwner)

      const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
      const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
      const recipientPosition = await market.getPosition(
        positionRecipient.publicKey,
        recipientListAfter.head - 1
      )

      // equals fields of transferred position
      positionWithoutOwnerEquals(removedPosition, recipientPosition)
      assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

      // positions length
      assert.equal(ownerListBefore.head - 1, ownerListAfter.head)
      assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
    })
    it('clear position', async () => {
      const transferredIndex = 0
      const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
      const removedPosition = await market.getPosition(positionOwner.publicKey, transferredIndex)

      const transferPositionOwnershipVars: TransferPositionOwnership = {
        index: transferredIndex,
        owner: positionOwner.publicKey,
        recipient: positionRecipient.publicKey
      }
      await transferPositionOwnership(market, transferPositionOwnershipVars, positionOwner)

      const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
      const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
      const recipientPosition = await market.getPosition(
        positionRecipient.publicKey,
        recipientListAfter.head - 1
      )

      // equals fields of transferred position
      positionWithoutOwnerEquals(removedPosition, recipientPosition)
      assert.ok(recipientPosition.owner.equals(positionRecipient.publicKey))

      // positions length
      assert.equal(ownerListAfter.head, 0)
      assert.equal(recipientListBefore.head + 1, recipientListAfter.head)
    })
    it('get back position', async () => {
      const ownerListBefore = await market.getPositionList(positionOwner.publicKey)
      const transferredIndex = 0
      const recipientListBefore = await market.getPositionList(positionRecipient.publicKey)
      const lastPositionBefore = await market.getPosition(
        positionRecipient.publicKey,
        recipientListBefore.head - 1
      )
      const removedPosition = await market.getPosition(
        positionRecipient.publicKey,
        transferredIndex
      )

      const transferPositionOwnershipVars: TransferPositionOwnership = {
        index: transferredIndex,
        owner: positionRecipient.publicKey,
        recipient: positionOwner.publicKey
      }
      await transferPositionOwnership(market, transferPositionOwnershipVars, positionRecipient)

      const ownerListAfter = await market.getPositionList(positionOwner.publicKey)
      const recipientListAfter = await market.getPositionList(positionRecipient.publicKey)
      const firstPositionAfter = await market.getPosition(positionRecipient.publicKey, 0)
      const ownerNewPosition = await market.getPosition(
        positionOwner.publicKey,
        ownerListAfter.head - 1
      )

      // move last position
      positionEquals(lastPositionBefore, firstPositionAfter)

      // equals fields of transferred position
      positionWithoutOwnerEquals(removedPosition, ownerNewPosition)
      assert.ok(ownerNewPosition.owner.equals(positionOwner.publicKey))

      // positions length
      assert.equal(ownerListBefore.head + 1, ownerListAfter.head)
      assert.equal(recipientListBefore.head - 1, recipientListAfter.head)
    })
  })
})
