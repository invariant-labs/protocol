use crate::decimals::{Liquidity, SecondsPerLiquidity};
use anchor_lang::prelude::*;
#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct UserStake {
    pub incentive: Pubkey,
    pub position: Pubkey, // it's store but never used | delete or use it as check
    pub seconds_per_liquidity_initial: SecondsPerLiquidity,
    pub liquidity: Liquidity,
    pub bump: u8,
}
