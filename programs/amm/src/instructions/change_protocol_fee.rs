use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{
    decimal::Decimal,
    structs::{FeeTier, Pool, State},
};

#[derive(Accounts)]
#[instruction(fee: u64, tick_spacing: u16)]
pub struct ChangeProtocolFee<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut, seeds = [b"poolv1", fee_tier.key().as_ref(), token_x.key().as_ref(), token_y.key().as_ref()], bump = pool.load()?.bump)]
    pub pool: AccountLoader<'info, Pool>,
    #[account(
        seeds = [b"feetierv1", program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()],
        bump = fee_tier.load()?.bump
    )]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(constraint = &token_x.key() == &pool.load()?.token_x,)]
    pub token_x: Account<'info, Mint>,
    #[account(constraint = &token_y.key() == &pool.load()?.token_y,)]
    pub token_y: Account<'info, Mint>,
    #[account(constraint = &state.load()?.admin == admin.key)]
    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<ChangeProtocolFee>, protocol_fee: Decimal) -> ProgramResult {
    let mut pool = ctx.accounts.pool.load_mut()?;
    pool.protocol_fee = protocol_fee;
    Ok(())
}
