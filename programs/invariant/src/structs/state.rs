use anchor_lang::prelude::*;

use crate::account_size;
#[account(zero_copy(unsafe))]
#[repr(packed)]
#[derive(PartialEq, Default, Debug, InitSpace)]
pub struct State {
    pub admin: Pubkey,
    pub nonce: u8,
    pub authority: Pubkey,
    pub bump: u8,
}

account_size!(State);
