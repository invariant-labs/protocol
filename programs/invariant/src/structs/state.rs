use anchor_lang::prelude::*;

use core::convert::TryFrom;
use core::convert::TryInto;
use decimal::decimal;
use decimal::traits::*;
use decimal::Decimal;
use decimal::U256;

#[decimal(2)]
#[zero_copy]
#[derive(Default, std::fmt::Debug, PartialEq)]
pub struct Ez {
    pub v: u64,
}
#[account(zero_copy)]
#[repr(packed)]
#[derive(PartialEq, Default, Debug)]
pub struct State {
    pub admin: Pubkey,
    pub nonce: u8,
    pub authority: Pubkey,
    pub bump: u8,
    pub ez: Ez,
}
