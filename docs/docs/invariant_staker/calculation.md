---
title: Calculation

slug: /invariant_staker/calculation
---

| Variable                             | Description                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| total_reward_unclaimed               | The total amount of unclaimed rewards left for an incentive.                                          |
| total_seconds_claimed                | How many full liquidity-seconds have been already claimed for the incentive.                          |
| start_time                           | When the incentive rewards began in seconds.                                                          |
| end_time                             | When rewards are no longer being dripped out in seconds.                                              |
| liquidity                            | he amount of liquidity, assumed to be constant over the period over which the snapshots are measured. |
| seconds_per_liquidity_inside_initial | he seconds per liquidity of the liquidity tick range as of the beginning of the period.               |
| seconds_per_liquidity_inside         | The seconds per liquidity of the liquidity tick range as of the current timestamp.                    |
| current_time                         | The current timestamp, which must be greater than or equal to the start time.                         |

```rust title="/src/math.rs"
pub fn calculate_reward(
    total_reward_unclaimed: Decimal,
    total_seconds_claimed: Decimal,
    start_time: u64,
    end_time: u64,
    liquidity: Decimal,
    seconds_per_liquidity_inside_initial: Decimal,
    seconds_per_liquidity_inside: Decimal,
    current_time: u64,
) -> Result<(Decimal, u64)> {
    if current_time <= start_time {
        return Err(ErrorCode::NotStarted.into());
    }

    let seconds_inside =
        (seconds_per_liquidity_inside.sub
        (seconds_per_liquidity_inside_initial)).mul(liquidity);

    let total_seconds_unclaimed = cmp::max(
        Decimal::from_integer(end_time as u128),
        Decimal::from_integer(current_time as u128),
    )
    .sub(Decimal::from_integer(start_time as u128))
    .sub(total_seconds_claimed);
    let result = (total_reward_unclaimed
        .mul(seconds_inside)
        .div(total_seconds_unclaimed))
    .v
    .try_into()
    .unwrap();
    return Ok((seconds_inside, result));
}
}
```

Above function return two values:

- `seconds_inside` - the total seconds spent inside the position's range for the duration of the stake,
- `result` - the amount of rewards owed.
