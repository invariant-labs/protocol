use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
pub trait SendTokens<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}
