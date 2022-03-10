use crate::decimals::*;
use crate::ErrorCode;
use crate::Result;
use anchor_lang::prelude::*;
use std::cmp;

pub fn calculate_reward(
    total_reward_unclaimed: TokenAmount,
    total_seconds_claimed: Seconds,
    start_time: Seconds,
    end_time: Seconds,
    liquidity: Liquidity,
    seconds_per_liquidity_inside_initial: SecondsPerLiquidity,
    seconds_per_liquidity_inside: SecondsPerLiquidity,
    current_time: Seconds,
) -> Result<(Seconds, TokenAmount)> {
    if current_time <= start_time {
        return Err(ErrorCode::NotStarted.into());
    }

    let seconds_inside = Seconds::from_decimal(
        (seconds_per_liquidity_inside.sub(seconds_per_liquidity_inside_initial)).mul(liquidity),
    );

    let total_seconds_unclaimed = cmp::max(end_time, current_time)
        .sub(start_time)
        .sub(total_seconds_claimed);

    msg!("{}", total_reward_unclaimed.v);
    msg!("{}", seconds_inside.v);
    msg!("{}", total_seconds_unclaimed.v);
    let result = total_reward_unclaimed
        .mul(seconds_inside)
        .div(total_seconds_unclaimed);
    return Ok((seconds_inside, result));
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_calculate_reward_1() {
        //half the liquidity over 20% of the total duration
        let (seconds_inside, result) = calculate_reward(
            TokenAmount::new(1000),
            Seconds::new(0),
            Seconds::new(100),
            Seconds::new(200),
            Liquidity::from_integer(5),
            SecondsPerLiquidity::from_integer(0),
            SecondsPerLiquidity::from_integer(2),
            Seconds::new(120),
        )
        .unwrap();
        assert_eq!(result, TokenAmount::new(100));
        assert_eq!(seconds_inside, Seconds::new(10));
    }
    // TODO fix rest od the tests
    // #[test]
    // fn test_calculate_reward_2() {
    //     let (seconds_inside, result) = calculate_reward(
    //         TokenAmount::new(1_000_000),
    //         Seconds::new(0),
    //         0,
    //         100,
    //         Decimal::new(2_000_000_000_000_000_000),
    //         Decimal::new(10_000_000),
    //         Decimal::new(35_000_000),
    //         50,
    //     )
    //     .unwrap();
    //     assert_eq!(result, 500_000_000_000_000);
    //     assert_eq!(seconds_inside, Decimal::new(50_000_000_000_000));
    // }

    // #[test]
    // fn test_calculate_reward_3() {
    //     //half the liquidity over 20% of the total duration
    //     let (seconds_inside, result) = calculate_reward(
    //         Decimal::new(1000),
    //         Decimal::from_integer(0),
    //         100,
    //         200,
    //         Decimal::from_integer(10),
    //         Decimal::new(0),
    //         Decimal::from_integer(2),
    //         120,
    //     )
    //     .unwrap();

    //     assert_eq!(result, 200);
    //     assert_eq!(seconds_inside, Decimal::from_integer(20));
    // }

    // #[test]
    // fn test_calculate_reward_4() {
    //     //reward is lesser if end time was exceeded
    //     let (seconds_inside, result) = calculate_reward(
    //         Decimal::new(1000),
    //         Decimal::from_integer(0),
    //         100,
    //         200,
    //         Decimal::from_integer(100),
    //         Decimal::from_integer(0),
    //         Decimal::from_integer(1),
    //         300,
    //     )
    //     .unwrap();

    //     assert_eq!(result, 500);
    //     assert_eq!(seconds_inside, Decimal::from_integer(100));
    // }

    // #[test]
    // fn test_calculate_reward_5() {
    //     //reward is lesser if end time was exceeded
    //     let (seconds_inside, result) = calculate_reward(
    //         Decimal::new(1000),
    //         Decimal::from_integer(0),
    //         100,
    //         200,
    //         Decimal::from_integer(100),
    //         Decimal::from_integer(0),
    //         Decimal::from_integer(1),
    //         201,
    //     )
    //     .unwrap();

    //     assert_eq!(result, 990);
    //     assert_eq!(seconds_inside, Decimal::from_integer(100));
    // }

    // #[test]
    // fn test_calculate_reward_6() {
    //     // reward is greater if some seconds was claimed
    //     let (seconds_inside, result) = calculate_reward(
    //         Decimal::new(1000),
    //         Decimal::from_integer(10),
    //         100,
    //         200,
    //         Decimal::from_integer(5),
    //         Decimal::from_integer(0),
    //         Decimal::from_integer(2),
    //         120,
    //     )
    //     .unwrap();

    //     assert_eq!(result, 111);
    //     assert_eq!(seconds_inside, Decimal::from_integer(10));
    // }

    // #[test]
    // fn test_calculate_reward_7() {
    //     // 0 reward because total_reward_unclaimed = 0
    //     let (seconds_inside, result) = calculate_reward(
    //         Decimal::new(0),
    //         Decimal::from_integer(0),
    //         100,
    //         200,
    //         Decimal::from_integer(5),
    //         Decimal::from_integer(0),
    //         Decimal::from_integer(2),
    //         120,
    //     )
    //     .unwrap();

    //     assert_eq!(result, 0);
    //     assert_eq!(seconds_inside, Decimal::from_integer(10));
    // }

    // #[test]
    // fn test_calculate_reward_8() {
    //     // 0 seconds inside
    //     let (seconds_inside, result) = calculate_reward(
    //         Decimal::new(1000),
    //         Decimal::from_integer(0),
    //         100,
    //         200,
    //         Decimal::from_integer(5),
    //         Decimal::from_integer(2),
    //         Decimal::from_integer(2),
    //         120,
    //     )
    //     .unwrap();

    //     assert_eq!(result, 0);
    //     assert_eq!(seconds_inside, Decimal::from_integer(0));
    // }

    // #[test]
    // fn test_calculate_reward_9() {
    //     //0 liquidity gets 0 reward
    //     let (seconds_inside, result) = calculate_reward(
    //         Decimal::new(1000),
    //         Decimal::from_integer(0),
    //         100,
    //         200,
    //         Decimal::from_integer(0),
    //         Decimal::from_integer(0),
    //         Decimal::from_integer(2),
    //         120,
    //     )
    //     .unwrap();

    //     assert_eq!(result, 0);
    //     assert_eq!(seconds_inside, Decimal::from_integer(0));
    // }

    // #[test]
    // fn test_calculate_reward_10() {
    //     //current time is before start
    //     let failed = calculate_reward(
    //         Decimal::new(1000),
    //         Decimal::from_integer(0),
    //         100,
    //         200,
    //         Decimal::from_integer(5),
    //         Decimal::from_integer(0),
    //         Decimal::from_integer(2),
    //         99,
    //     )
    //     .is_err();

    //     assert_eq!(failed, true);
    // }
}
