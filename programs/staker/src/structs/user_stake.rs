use crate::decimalss::Decimal;
use anchor_lang::prelude::*;
#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct UserStake {
    pub incentive: Pubkey,
    pub position: Pubkey,
    pub seconds_per_liquidity_initial: Decimal,
    pub liquidity: Decimal,
    pub bump: u8,
}
