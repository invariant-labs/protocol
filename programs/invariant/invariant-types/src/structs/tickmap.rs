use crate::size;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[repr(packed)]
#[derive(Debug, AnchorDeserialize)]
pub struct Tickmap {
    pub bitmap: [u8; 11091], // Tick limit / 4
}

impl Default for Tickmap {
    fn default() -> Self {
        Tickmap { bitmap: [0; 11091] }
    }
}

size!(Tickmap);
