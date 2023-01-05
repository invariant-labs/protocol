use crate::size;
use anchor_lang::prelude::*;
// use borsh::BorshDeserialize;

// #[derive(Default, Debug, BorshDeserialize, AnchorDeserialize)]
// #[derive(Default, Debug, BorshSerialize, BorshDeserialize)]
#[account(zero_copy)]
#[repr(packed)]
#[derive(AnchorDeserialize)]
pub struct Tickmap {
    pub bitmap: [u8; 11091], // Tick limit / 4
}

size!(Tickmap);
