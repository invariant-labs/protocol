use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
pub trait TakeTokens<'info> {
    fn take_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn take_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}
