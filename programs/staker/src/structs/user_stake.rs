use crate::decimals::{Liquidity, SecondsPerLiquidity};
use anchor_lang::prelude::*;
use invariant::size;
#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct UserStake {
    pub incentive: Pubkey,
    pub position: Pubkey,
    pub seconds_per_liquidity_initial: SecondsPerLiquidity,
    pub liquidity: Liquidity,
    pub bump: u8,
}
size!(UserStake);
