use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{
    decimal::Decimal,
    structs::{Pool, State},
};

#[derive(Accounts)]
pub struct ChangeProtocolFee<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(constraint = token_x.to_account_info().key == &pool.load()?.token_x,)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = token_y.to_account_info().key == &pool.load()?.token_y,)]
    pub token_y: Account<'info, Mint>,
    #[account(constraint = &pool.load()?.fee_receiver == admin.key)]
    pub admin: Signer<'info>,
    #[account(constraint = &state.load()?.authority == program_authority.key)]
    pub program_authority: AccountInfo<'info>,
}

pub fn handler(ctx: Context<ChangeProtocolFee>, protocol_fee: Decimal) -> ProgramResult {
    let pool = &mut ctx.accounts.pool.load_mut()?;
    pool.protocol_fee = protocol_fee;

    Ok(())
}
