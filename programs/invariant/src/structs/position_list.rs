use anchor_lang::prelude::*;

use crate::size;

#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct PositionList {
    pub head: u32,
    pub bump: u8,
}
size!(PositionList);
