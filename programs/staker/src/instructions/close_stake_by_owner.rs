use crate::errors::ErrorCode;
use crate::structs::{Incentive, UserStake};
use crate::*;
use anchor_lang::prelude::*;
use invariant_core::structs::Position;

#[derive(Accounts)]
#[instruction(index: u32)]
pub struct CloseStakeByOwner<'info> {
    #[account(mut, constraint = user_stake.load()?.incentive == incentive.key() @ ErrorCode::InvalidFounder)]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        close = owner,
        seeds = [b"staker", incentive.key().as_ref(), position.load()?.pool.as_ref(), &position.load()?.id.to_le_bytes()],
        bump = user_stake.load()?.bump,
    )]
    pub user_stake: AccountLoader<'info, UserStake>,
    #[account(
        seeds = [b"positionv1",
        owner.key.as_ref(),
        &index.to_le_bytes(),],
        bump = position.load()?.bump,
        seeds::program = invariant::ID
    )]
    pub position: AccountLoader<'info, Position>,
    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<CloseStakeByOwner>, _index: i32) -> Result<()> {
    let mut incentive = ctx.accounts.incentive.load_mut()?;

    require!(incentive.num_of_stakes > 0, errors::ErrorCode::NoStakes);

    // decrease number of stakes by 1
    incentive.num_of_stakes -= 1;

    Ok(())
}
