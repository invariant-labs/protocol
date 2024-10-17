use anchor_lang::prelude::*;
use anchor_spl::{token::Transfer, token_2022};
pub trait TakeRefTokens<'info> {
    fn take_ref_x(&self, to: AccountInfo<'info>) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn take_ref_y(&self, to: AccountInfo<'info>) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn take_ref_x_2022(
        &self,
        to: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>>;
    fn take_ref_y_2022(
        &self,
        to: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>>;
}
