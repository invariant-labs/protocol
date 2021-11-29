use crate::decimal::Decimal;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct FeeTier {
    pub fee: Decimal,
    pub tick_spacing: u16,
    pub bump: u8,
}
