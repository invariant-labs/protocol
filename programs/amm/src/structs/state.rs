use crate::decimal::Decimal;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct State {
    pub protocol_fee: Decimal,
    pub admin: Pubkey,
    pub bump: u8,
}
