use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
pub trait TakeRefTokens<'info> {
    fn take_ref_x(&self, to: AccountInfo<'info>) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    // fn take_ref_y(&self, to: AccountInfo<'info>) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}
