use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("The incentive didn't start yet!")]
    NotStarted = 0, // 1770
    #[msg("Disable empty position pokes")]
    EmptyPositionPokes = 1, // 1771
    #[msg("Invalid tick liquidity")]
    InvalidPositionLiquidity = 2, // 1772
    #[msg("Amount is zero")]
    ZeroAmount = 3, // 1773
    #[msg("Incentive duration is too long")]
    TooLongDuration = 4, // 1774
    #[msg("Start in past")]
    StartInPast = 5, // 1775
    #[msg("Incentive is over")]
    Ended = 6, // 1776
    #[msg("User have no liquidity")]
    ZeroLiquidity = 7, // 1777
    #[msg("Slots are not equal")]
    SlotsAreNotEqual = 8, // 1778
    #[msg("Zero seconds staked")]
    ZeroSecondsStaked = 9, // 1779
    #[msg("Seconds per liquidity is zero")]
    ZeroSecPerLiq = 10, // 177a
    #[msg("Incentive not ended")]
    NotEnded = 11, // 177b
    #[msg("Can't end id stake exists")]
    StakeExist = 12, // 177c
    #[msg("Remaining reward is 0")]
    ZeroReward = 13, // 177d
}