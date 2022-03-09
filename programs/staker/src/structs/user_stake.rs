use crate::decimals::{FixedPoint, Liquidity};
use anchor_lang::prelude::*;
#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct UserStake {
    pub incentive: Pubkey,
    pub position: Pubkey,
    pub seconds_per_liquidity_initial: FixedPoint,
    pub liquidity: Liquidity,
    pub bump: u8,
}
