use crate::structs::{Incentive, UserStake};
use crate::util::get_current_timestamp;

use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveStake<'info> {
    #[account(mut, constraint = &incentive.load()?.founder == founder.to_account_info().key )]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        close = founder,
        constraint = &user_stake.load()?.incentive == incentive.to_account_info().key
    )]
    pub user_stake: AccountLoader<'info, UserStake>,
    pub founder: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveStake>) -> ProgramResult {
    let mut incentive = ctx.accounts.incentive.load_mut()?;
    let current_time = get_current_timestamp();
    require!(current_time > incentive.end_claim_time, TooEarly);
    require!(incentive.num_of_stakes != 0, NoStakes);

    // decrease number of stakes by 1
    incentive.num_of_stakes -= 1;

    Ok(())
}
