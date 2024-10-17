use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
use anchor_spl::token_2022;

pub trait TakeTokens<'info> {
    fn take_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn take_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn take_x_2022(&self) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>>;
    fn take_y_2022(&self) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>>;
}
