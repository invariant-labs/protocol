use crate::{decimals::FixedPoint, size};
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug, BorshDeserialize, BorshSerialize)]
pub struct FeeTier {
    pub fee: FixedPoint,
    pub tick_spacing: u16,
    pub bump: u8,
}
size!(FeeTier);
