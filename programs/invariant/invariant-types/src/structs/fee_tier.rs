use crate::{decimals::FixedPoint, size};
use anchor_lang::prelude::*;
use borsh::BorshDeserialize;

#[account(zero_copy)]
#[repr(packed)]
#[repr(C)]
#[derive(PartialEq, Default, Debug, BorshDeserialize)]
pub struct FeeTier {
    pub fee: FixedPoint,
    pub tick_spacing: u16,
    pub bump: u8,
}
size!(FeeTier);
