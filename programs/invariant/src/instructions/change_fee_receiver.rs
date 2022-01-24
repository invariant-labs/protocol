use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::structs::{Pool, State};

#[derive(Accounts)]
pub struct ChangeFeeReceiver<'info> {
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
    #[account(constraint = &state.load()?.admin == admin.key)]
    pub admin: Signer<'info>,
    pub fee_receiver: AccountInfo<'info>,
    #[account(constraint = &state.load()?.authority == program_authority.key)]
    pub program_authority: AccountInfo<'info>,
}

pub fn handler(ctx: Context<ChangeFeeReceiver>) -> ProgramResult {
    let mut pool = ctx.accounts.pool.load_mut()?;
    pool.fee_receiver = ctx.accounts.fee_receiver.key();

    Ok(())
}
