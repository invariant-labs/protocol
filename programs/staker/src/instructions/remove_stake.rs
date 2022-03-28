use crate::decimals::*;
use crate::structs::{Incentive, UserStake};
use crate::ErrorCode::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveStake<'info> {
    #[account(mut, constraint = incentive.load()?.founder == founder.key() @ InvalidFounder)]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        close = founder,
        constraint = user_stake.load()?.incentive == incentive.key() @ InvalidStake
    )]
    pub user_stake: AccountLoader<'info, UserStake>,
    pub founder: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveStake>) -> ProgramResult {
    let mut incentive = ctx.accounts.incentive.load_mut()?;
    require!(Seconds::now() > { incentive.end_claim_time }, TooEarly);
    require!(incentive.num_of_stakes != 0, NoStakes);

    // decrease number of stakes by 1
    incentive.num_of_stakes -= 1; // overflow

    Ok(())
}
