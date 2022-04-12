use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Pool {
    pub option_token_mint: Pubkey,
    pub redeem_token_mint: Pubkey,
    pub invariant_mint: Pubkey,
    pub invariant_token_vault: Pubkey,
    pub redeem_token_vault: Pubkey,
    pub ratio: u64,
}
