use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    pub option_token_mint: Pubkey,
    pub payment_token_mint: Pubkey,
    pub invariant_mint: Pubkey,
    pub invariant_vault: Pubkey,
    pub ratio: u64,
}
