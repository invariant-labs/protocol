use crate::account_size;
use crate::decimals::FixedPoint;
use anchor_lang::prelude::*;

#[account(zero_copy(unsafe))]
#[repr(packed)]
#[derive(PartialEq, Default, Debug, InitSpace)]
pub struct FeeTier {
    pub fee: FixedPoint,
    pub tick_spacing: u16,
    pub bump: u8,
}

account_size!(FeeTier);
