use crate::old_decimal::OldDecimal;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct FeeTier {
    pub fee: OldDecimal,
    pub tick_spacing: u16,
    pub bump: u8,
}
