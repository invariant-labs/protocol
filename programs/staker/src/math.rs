use crate::ErrorCode;
use crate::Result;

use crate::decimal::{Decimal, Div, Mul, Sub};
use std::cmp;

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
        (seconds_per_liquidity_inside.sub(seconds_per_liquidity_inside_initial)).mul(liquidity);
    let total_seconds_unclaimed = cmp::max(
        Decimal::from_integer(end_time as u128),
        Decimal::from_integer(current_time as u128),
    )
    .sub(Decimal::from_integer(start_time as u128))
    .sub(total_seconds_claimed);
    let result = (total_reward_unclaimed
        .mul(seconds_inside)
        .div(total_seconds_unclaimed))
    .to_token_floor();

    return Ok((seconds_inside, result));
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_calculate_reward_1() {
        //half the liquidity over 20% of the total duration
        let (seconds_inside, result) = calculate_reward(
            Decimal::from_integer(1000),
            Decimal::from_integer(0),
            100,
            200,
            Decimal::from_integer(10),
            Decimal::from_integer(0),
            Decimal::from_integer(2),
            120,
        )
        .unwrap();

        assert_eq!(result, 200);
        assert_eq!(seconds_inside, Decimal::from_integer(20));
    }

    #[test]
    fn test_calculate_reward_2() {
        //reward is lesser if end time was exceeded
        let (seconds_inside, result) = calculate_reward(
            Decimal::from_integer(1000),
            Decimal::from_integer(0),
            100,
            200,
            Decimal::from_integer(100),
            Decimal::from_integer(0),
            Decimal::from_integer(1),
            300,
        )
        .unwrap();

        assert_eq!(result, 500);
        assert_eq!(seconds_inside, Decimal::from_integer(100));
    }

    #[test]
    fn test_calculate_reward_3() {
        //reward is lesser if end time was exceeded
        let (seconds_inside, result) = calculate_reward(
            Decimal::from_integer(1000),
            Decimal::from_integer(0),
            100,
            200,
            Decimal::from_integer(100),
            Decimal::from_integer(0),
            Decimal::from_integer(1),
            201,
        )
        .unwrap();

        assert_eq!(result, 990);
        assert_eq!(seconds_inside, Decimal::from_integer(100));
    }

    #[test]
    fn test_calculate_reward_4() {
        // reward is greater if some seconds was claimed
        let (seconds_inside, result) = calculate_reward(
            Decimal::from_integer(1000),
            Decimal::from_integer(10),
            100,
            200,
            Decimal::from_integer(5),
            Decimal::from_integer(0),
            Decimal::from_integer(2),
            120,
        )
        .unwrap();

        assert_eq!(result, 111);
        assert_eq!(seconds_inside, Decimal::from_integer(10));
    }

    #[test]
    fn test_calculate_reward_5() {
        // 0 reward because total_reward_unclaimed = 0
        let (seconds_inside, result) = calculate_reward(
            Decimal::from_integer(0),
            Decimal::from_integer(0),
            100,
            200,
            Decimal::from_integer(5),
            Decimal::from_integer(0),
            Decimal::from_integer(2),
            120,
        )
        .unwrap();

        assert_eq!(result, 0);
        assert_eq!(seconds_inside, Decimal::from_integer(10));
    }

    #[test]
    fn test_calculate_reward_6() {
        // 0 seconds inside
        let (seconds_inside, result) = calculate_reward(
            Decimal::from_integer(1000),
            Decimal::from_integer(0),
            100,
            200,
            Decimal::from_integer(5),
            Decimal::from_integer(2),
            Decimal::from_integer(2),
            120,
        )
        .unwrap();

        assert_eq!(result, 0);
        assert_eq!(seconds_inside, Decimal::from_integer(0));
    }

    #[test]
    fn test_calculate_reward_7() {
        //0 liquidity gets 0 reward
        let (seconds_inside, result) = calculate_reward(
            Decimal::from_integer(1000),
            Decimal::from_integer(0),
            100,
            200,
            Decimal::from_integer(0),
            Decimal::from_integer(0),
            Decimal::from_integer(2),
            120,
        )
        .unwrap();

        assert_eq!(result, 0);
        assert_eq!(seconds_inside, Decimal::from_integer(0));
    }

    #[test]
    fn test_calculate_reward_8() {
        //current time is before start
        let failed = calculate_reward(
            Decimal::from_integer(1000),
            Decimal::from_integer(0),
            100,
            200,
            Decimal::from_integer(5),
            Decimal::from_integer(0),
            Decimal::from_integer(2),
            99,
        )
        .is_err();

        assert_eq!(failed, true);
    }
}
