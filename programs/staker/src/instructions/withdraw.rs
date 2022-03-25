use crate::decimals::*;
use crate::math::*;
use crate::structs::*;
use crate::util::*;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};
use invariant::structs::Position;

#[derive(Accounts)]
#[instruction(index: u32, nonce: u8)]
pub struct Withdraw<'info> {
    #[account(mut,
        seeds = [b"staker", incentive.to_account_info().key.as_ref(), position.load()?.pool.as_ref(), &position.load()?.id.to_le_bytes()],
        bump = user_stake.load()?.bump,
    )]
    pub user_stake: AccountLoader<'info, UserStake>,
    #[account(mut,
        constraint = &user_stake.load()?.incentive == incentive.to_account_info().key @ InvalidIncentive
    )]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key @ InvalidTokenAccount
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"positionv1",
        owner.key.as_ref(),
        &index.to_le_bytes(),],
        bump = position.load()?.bump,
        seeds::program = invariant::ID
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut,
        constraint = owner_token_account.to_account_info().key != incentive_token_account.to_account_info().key @ InvalidTokenAccount,
        constraint = owner_token_account.owner == position.load()?.owner @ InvalidOwner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(seeds = [b"staker".as_ref()], bump = nonce)]
    pub staker_authority: AccountInfo<'info>, // validate with state
    pub owner: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> Withdraw<'info> {
    fn withdraw(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.incentive_token_account.to_account_info(),
                to: self.owner_token_account.to_account_info(),
                authority: self.staker_authority.to_account_info().clone(),
            },
        )
    }
}

pub fn handler(ctx: Context<Withdraw>, _index: i32, nonce: u8) -> ProgramResult {
    msg!("WITHDRAW");

    let mut incentive = ctx.accounts.incentive.load_mut()?;
    let current_time = Seconds::new(get_current_timestamp());
    {
        let user_stake = &mut ctx.accounts.user_stake.load_mut()?;
        let position = ctx.accounts.position.load()?;

        let update_slot = position.last_slot;
        let slot = get_current_slot();

        require!(slot == update_slot, SlotsAreNotEqual);
        require!(user_stake.liquidity.v != 0, ZeroSecondsStaked);
        require!(
            user_stake.seconds_per_liquidity_initial.v != 0,
            ZeroSecPerLiq
        );
        let seconds_per_liquidity_inside =
            SecondsPerLiquidity::new(position.seconds_per_liquidity_inside.v);

        let reward_unclaimed = incentive.total_reward_unclaimed;

        require!(reward_unclaimed != TokenAmount::new(0), ZeroAmount);

        let (seconds_inside, reward) = calculate_reward(
            reward_unclaimed,
            incentive.total_seconds_claimed,
            incentive.start_time,
            incentive.end_time,
            user_stake.liquidity,
            user_stake.seconds_per_liquidity_initial,
            seconds_per_liquidity_inside,
            current_time,
        )
        .unwrap();

        incentive.total_seconds_claimed = incentive.total_seconds_claimed + seconds_inside;
        incentive.total_reward_unclaimed = reward_unclaimed - reward;
        user_stake.seconds_per_liquidity_initial = SecondsPerLiquidity::from_integer(0);
        user_stake.liquidity = Liquidity::from_integer(0);

        let seeds = &[STAKER_SEED.as_bytes(), &[nonce]];
        let signer = &[&seeds[..]];

        let cpi_ctx = ctx.accounts.withdraw().with_signer(signer);

        token::transfer(cpi_ctx, reward.get())?;
    }

    if current_time > { incentive.end_time } {
        close(
            ctx.accounts.user_stake.to_account_info(),
            ctx.accounts.owner.to_account_info(),
        )
        .unwrap();

        incentive.num_of_stakes -= 1;
    }

    Ok(())
}
