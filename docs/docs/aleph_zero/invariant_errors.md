---
title: Invariant Errors

slug: /aleph_zero/invariant_errors
---

| ErrorCode                      | Description                                                               |
|--------------------------------|---------------------------------------------------------------------------|
| NotAnAdmin                     | Default user attempts to invoke an admin-only message                     |
| PoolAlreadyExist               | Attempted creation of a pool that already exists                          |
| PoolNotFound                   | Unable to retrieve the state of the specified pool                        |
| InvalidTickIndexOrTickSpacing  | Attempt to create a tick with an out-of-bounds index or incorrect spacing |
| PositionNotFound               | Unable to retrieve the state of the specified position                    |
| TickNotFound                   | Unable to retrieve the state of the specified tick                        |
| FeeTierNotFound                | Unable to retrieve the state of the specified fee tier                    |
| AmountIsZero                   | Attempted swap with zero tokens                                           |
| WrongLimit                     | Attempted swap with an incorrect price limit                              |
| PriceLimitReached              | Swap would exceed the specified limit                                     |
| NoGainSwap                     | User would receive zero tokens after the swap                             |
| InvalidTickSpacing             | Attempted creation of a fee tier with incorrect tick spacing              |
| FeeTierAlreadyAdded            | Fee tier is already added                                                 |
| NotAFeeReceiver                | Default user attempts to withdraw protocol fee                            |
| ZeroLiquidity                  | Attempted opening of a position with zero liquidity                       |
| TransferError                  | Transfer could not be performed                                           |
| TokensAreTheSame               | Attempted creation of a pool with exactly the same tokens                 |
