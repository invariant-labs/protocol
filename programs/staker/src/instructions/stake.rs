use crate::decimal::*;
use crate::state::*;
use crate::util::check_position_seeds;

use amm::account::Position;
use amm::program::Amm;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
#[instruction(index: u32, bump: u8)]
pub struct CreateUserStake<'info> {
    #[account(init,
        seeds = [b"staker", incentive.to_account_info().key.as_ref(), &position.load()?.pool.as_ref(), &position.load()?.id.to_le_bytes() ],
        payer = owner,
        bump = bump)]
    pub user_stake: AccountLoader<'info, UserStake>,
    #[account(mut,
        constraint = check_position_seeds(owner.to_account_info(), position.to_account_info().key, index)
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut)]
    pub incentive: AccountLoader<'info, Incentive>,
    pub owner: Signer<'info>,
    pub amm: Program<'info, Amm>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateUserStake>, index: i32, bump: u8) -> ProgramResult {
    msg!("STAKE");
    let mut incentive = ctx.accounts.incentive.load_mut()?;
    let current_time = Clock::get().unwrap().unix_timestamp as u64;
    require!(current_time >= incentive.start_time, NotStarted);
    require!(current_time < incentive.end_time, Ended);

    let user_stake = &mut ctx.accounts.user_stake.load_init()?;
    let position = ctx.accounts.position.load()?;
    let update_slot = position.last_slot as i64;
    let slot = Clock::get()?.slot as i64;
    require!(slot == update_slot, SlotsAreNotEqual);
    {
        user_stake.position = *ctx.accounts.position.to_account_info().key;
        user_stake.liquidity = Decimal::new(position.liquidity.v);
        user_stake.incentive = *ctx.accounts.incentive.to_account_info().key;
        user_stake.seconds_per_liquidity_initial =
            Decimal::new(position.seconds_per_liquidity_inside.v);
        incentive.num_of_stakes += 1;
    }
    let liquidity = user_stake.liquidity;
    require!(liquidity > Decimal::from_integer(0), ZeroLiquidity);
    Ok(())
}
