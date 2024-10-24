use crate::account_size;
use anchor_lang::prelude::*;
#[account(zero_copy(unsafe))]
#[repr(packed)]
#[derive(PartialEq, Default, Debug, InitSpace)]
pub struct PositionList {
    pub head: u32,
    pub bump: u8,
}

account_size!(PositionList);
