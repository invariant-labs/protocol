use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct PositionList {
    pub head: u32,
    pub bump: u8,
}
