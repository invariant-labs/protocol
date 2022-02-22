use crate::decimall::*;
use crate::structs::*;
use crate::util::get_current_slot;
use crate::util::get_current_timestamp;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use invariant::program::Invariant;
use invariant::structs::Position;

#[derive(Accounts)]
#[instruction(index: u32)]
pub struct CreateUserStake<'info> {
    #[account(init,
        seeds = [b"staker", incentive.to_account_info().key.as_ref(), &position.load()?.pool.as_ref(), &position.load()?.id.to_le_bytes() ],
        payer = owner,
        bump)]
    pub user_stake: AccountLoader<'info, UserStake>,
    #[account(
        seeds = [b"positionv1",
        owner.key.as_ref(),
        &index.to_le_bytes(),],
        bump = position.load()?.bump,
        seeds::program = invariant::ID
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut)]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(address = invariant::ID)]
    pub invariant: Program<'info, Invariant>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateUserStake>) -> ProgramResult {
    msg!("STAKE");
    let mut incentive = ctx.accounts.incentive.load_mut()?;
    let current_time = get_current_timestamp();
    require!(current_time >= incentive.start_time, NotStarted);
    require!(current_time < incentive.end_time, Ended);

    let user_stake = &mut ctx.accounts.user_stake.load_init()?;
    let position = ctx.accounts.position.load()?;
    let update_slot = position.last_slot;
    let slot = get_current_slot();
    require!(slot == update_slot, SlotsAreNotEqual);

    **user_stake = UserStake {
        position: *ctx.accounts.position.to_account_info().key,
        liquidity: Decimal::new(position.liquidity.v),
        incentive: *ctx.accounts.incentive.to_account_info().key,
        bump: *ctx.bumps.get("user_stake").unwrap(),
        seconds_per_liquidity_initial: Decimal::new(position.seconds_per_liquidity_inside.v),
    };
    incentive.num_of_stakes += 1;
    let liquidity = user_stake.liquidity;
    require!(liquidity > Decimal::from_integer(0), ZeroLiquidity);
    Ok(())
}
