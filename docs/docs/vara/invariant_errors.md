---
title: Invariant Errors

slug: /vara/invariant_errors
---

This section outlines error codes essential for maintaining the integrity of Invariant operations. These codes provide insights into specific issues encountered during interactions with the platform.

| Code                          | Description                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| NotAdmin                      | Unauthorized user attempts to invoke an admin-only message.                                                          |
| NotFeeReceiver                | Unauthorized user attempts to withdraw protocol fee.                                                                 |
| PoolAlreadyExist              | Attempted creation of a pool with the same tokens (order does not matter) and the same fee tier that already exists. |
| PoolNotFound                  | Unable to retrieve the state of the specified pool.                                                                  |
| TickAlreadyExist              | Attempted to create a tick that already exists.                                                                      |
| InvalidTickIndexOrTickSpacing | Attempt to create a tick with an out-of-bounds index or incorrect spacing.                                           |
| PositionNotFound              | Unable to retrieve the state of the specified position.                                                              |
| TickNotFound                  | Unable to retrieve the state of the specified tick.                                                                  |
| FeeTierNotFound               | Unable to retrieve the state of the specified fee tier.                                                              |
| PoolKeyNotFound               | Unable to retrieve the state of the specified pool key.                                                              |
| AmountIsZero                  | Attempted swap with zero tokens on input or output, depending on swap direction.                                     |
| WrongLimit                    | Attempted swap with an incorrect price limit.                                                                        |
| PriceLimitReached             | Swap would exceed the specified limit.                                                                               |
| NoGainSwap                    | User would receive zero tokens after the swap.                                                                       |
| InvalidTickSpacing            | Attempted creation of a fee tier with incorrect tick spacing.                                                        |
| FeeTierAlreadyExist           | Attempted to create a fee tier that already exists.                                                                  |
| PoolKeyAlreadyExist           | Attempted to create a pool key that already exists.                                                                  |
| UnauthorizedFeeReceiver       | Attempted to claim fee without being a fee receiver.                                                                 |
| ZeroLiquidity                 | Attempted opening of a position with zero liquidity.                                                                 |
| TransferError                 | GRC-20 token transfer could not be performed.                                                                        |
| TokensAreSame                 | Attempted creation of a pool with exactly the same tokens.                                                           |
| AmountUnderMinimumAmountOut   | Swap amount out will not fit into the next swap amount to achieve the specified amount out.                          |
| InvalidFee                    | Attempted to create a fee tier with a fee over 100%.                                                                 |
| NotEmptyTickDeinitialization  | Attempted to remove a tick with liquidity on it.                                                                     |
| InvalidInitTick               | Attempted to create a pool with invalid init tick.                                                                   |
| InvalidTickIndex              | Attempted to create a position with identical lower and upper tick                                                   |
| TickLimitReached              | Attempted to swap above the current liquidity                                                                        |
| NotEnoughGasToExecute         | Attempted to execute an endpoint with insufficient gas                                                               |
| NotEnoughGasToUpdate          | Amount of gas left after cross program calls was insufficient to update the state                                    |

