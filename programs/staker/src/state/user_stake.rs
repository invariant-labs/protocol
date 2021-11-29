use crate::decimal::Decimal;
use anchor_lang::prelude::*;
#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct UserStake {
    pub position: Pubkey,
    pub incentive: Pubkey,
    pub seconds_per_liquidity_initial: Decimal,
    pub liquidity: Decimal,
    pub index: u32,
    pub bump: u8,
}
