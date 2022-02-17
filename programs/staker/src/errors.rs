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
    TooEarly = 11, // 177b
    #[msg("Too early to remove incentive")]
    StakeExist = 12, // 177c
    #[msg("Remaining reward is 0")]
    ZeroReward = 13, // 177d
    #[msg("There is no any stakes")]
    NoStakes = 14, // 177e
    #[msg("Founder address is different than expected")]
    InvalidFounder = 15, // 177f
    #[msg("Provided stake doesn't belong to incentive")]
    InvalidStake = 16, // 1780
    #[msg("Provided token account is different than expected")]
    InvalidTokenAccount = 17, // 1781
    #[msg("Incentive address is different than expected")]
    InvalidIncentive = 18, // 1782
    #[msg("Provided authority is different than expected")]
    InvalidAuthority = 19, // 1783
    #[msg("Provided token owner is different than expected")]
    InvalidOwner = 20, // 1784
    #[msg("Provided token account mint is different than expected mint token")]
    InvalidMint = 21, // 1785
}
