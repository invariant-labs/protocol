---
title: Invariant Errors

slug: /alephium/invariant_errors
---

This section outlines error codes essential for maintaining the integrity of Invariant operations. These codes provide insights into specific issues encountered during interactions with the platform.

| Code                          | Value |Description                                                                                                          |
| ----------------------------- |:-------------------:|------------------------------------------------------------------------------------------------ |
| NotAdmin | 0 | Unauthorized user attempts to invoke an admin-only message. |
| InsufficientLiquidity | 1 | Not enough liquidity. |
| InvalidTickSpacing | 2 | Fails if the init tick is not divisible by the tick spacing. |
| InvalidTickSpacing | 801 | Fails if the init tick is not divisible by the tick spacing. Originated in CLAMM.|
| InvalidFee | 3 | Attempted to create a fee tier with a fee over 100%.  |
| FeeTierNotFound | 4 | Unable to retrieve the state of the specified fee tier.  |
| TokensAreSame | 5 | Fails if the user attempts to create a pool for the same tokens. |
| PoolKeyAlreadyExist | 6 | Attempted to create a pool key that already exists.  |
| TickAndSqrtPriceMismatch | 7 | The init sqrt price is not related to the init tick.  |
| NotFeeReceiver | 8 | Unauthorized user attempts to invoke a fee-receiver-only message. |
| InvalidTickLiquidity | 9 | The maximum liquidity on a single tick has been exceeded. You can try opening a position on a neighboring tick. |
| ZeroLiquidity | 10 | Position with zero liquidity cannot be created. |
| PriceLimitReached | 11 | Swap would exceed the specified limit. |
| InvalidProtocolFee | 12 | Attempted to set the protocol fee to over 100%.  |
| ZeroAmount | 14 | Attempted swap with zero tokens on input or output, depending on swap direction. |
| WrongPriceLimit | 15 | Attempted swap with an incorrect price limit. Usually happens due to setting the wrong direction of the swap.|
| NoGainSwap | 16 | User would receive zero tokens after the swap. |
| FeeTierAlreadyExist | 18 | Attempted to create a fee tier that already exists. |
| PoolNotFound | 19 | Unable to retrieve the state of the specified pool. |
| PoolAlreadyExist | 20 | Attempted creation of a pool with the same tokens (order does not matter) and the same fee tier that already exists. |
| TickAlreadyExist | 21 | Attempted to create a tick that already exists.    |
| InvalidTickIndex | 22 | Init tick is outside of the Min <= Init <= Max tick index range. |
| InvalidTickIndex | 800 | Init tick is outside of the Min <= Init <= Max tick index range. Originated in CLAMM. |
| TickAndTickSpacingMismatch | 23 | Fails if the init sqrt price is not related to the init tick.  |
| TickLimitReached | 24 | The tick index has reached the global tick limit. |b
| ChunkNotFound | 25 | Unable to retrieve the state of the specified chunk in tickmap. |
| InvalidTickmapBit | 26 | An illegal operation on a tickmap bit has been requested. |
| PositionNotFound | 27 | Unable to retrieve the state of the specified position. |
| FeeTierLimitReached | 28 | The maximal number of fee tiers (32) already exists.|
| SqrtPriceOutOfRange | 7001 | SqrtPrice not in the MinSqrtPrice <= sqrtPrice <= MaxSqrtPrice range. |

<!-- | CastOverflow | 100001 | Internal overflow during cast from U512 to U256. |
| AddOverflow | 100002 | Internal overflow during addition of U512. |
| SubUnderflow | 100003 | Internal underflow during subtraction of U512. |
| DivNotPositiveDivisor | Internal division by zero for U512. |
| DivNotPositiveDenominator | 100006 | Internal division by zero during optimized division U512. | 
| MulNotPositiveDenominator | 100007 | Internal division by zero during optimized multiplication U512. | -->
