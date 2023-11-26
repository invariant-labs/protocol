---
title: Invariant Errors

slug: /aleph_zero/invariant_errors
---

This section outlines error codes essential for maintaining the integrity of Aleph Zero operations. These codes provide insights into specific issues encountered during interactions with the platform.

| ErrorCode                      | Description                                                               |
|--------------------------------|---------------------------------------------------------------------------|
| NotAdmin                     | Unauthorized user attempts to invoke an admin-only message                     |
| PoolAlreadyExist               | Attempted creation of a pool with same tokens (order does not matter) and same fee tier that already exists                           |
| PoolNotFound                   | Unable to retrieve the state of the specified pool                        |
| InvalidTickIndexOrTickSpacing  | Attempt to create a tick with an out-of-bounds index or incorrect spacing |
| PositionNotFound               | Unable to retrieve the state of the specified position                    |
| TickNotFound                   | Unable to retrieve the state of the specified tick                        |
| FeeTierNotFound                | Unable to retrieve the state of the specified fee tier                    |
| AmountIsZero                   | Attempted swap with zero tokens on input or output depending of swap direction|
| WrongLimit                     | Attempted swap with an incorrect price limit                              |
| PriceLimitReached              | Swap would exceed the specified limit                                     |
| NoGainSwap                     | User would receive zero tokens after the swap                             |
| InvalidTickSpacing             | Attempted creation of a fee tier with incorrect tick spacing              |
| FeeTierAlreadyAdded            | Fee tier is already added                                                 |
| NotFeeReceiver                | Unauthorized user attempts to withdraw protocol fee                            |
| ZeroLiquidity                  | Attempted opening of a position with zero liquidity                       |
| TransferError                  | PSP22 token transfer could not be performed                                           |
| TokensAreSame               | Attempted creation of a pool with exactly the same tokens                 |
