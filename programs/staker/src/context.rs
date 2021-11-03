use crate::account::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct CreateIncentive<'info> {
    #[account(init, payer = founder)]
    pub incentive: Loader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = founder_token_account.to_account_info().key != incentive_token_account.to_account_info().key,
        constraint = &founder_token_account.owner == founder.to_account_info().key
    )]
    pub founder_token_account: Account<'info, TokenAccount>,
    pub pool: AccountInfo<'info>, //TODO change to account loader

    #[account(mut)]
    pub founder: Signer<'info>,
    pub staker_authority: AccountInfo<'info>, // TODO validation ??
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub trait DepositToken<'info> {
    fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}

impl<'info> DepositToken<'info> for CreateIncentive<'info> {
    fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.founder_token_account.to_account_info(),
                to: self.incentive_token_account.to_account_info(),
                authority: self.founder.to_account_info().clone(),
            },
        )
    }
}

#[derive(Accounts)]
#[instruction(bump: u8, index: u32)]
pub struct CreateUserStake<'info> {
    #[account(init,
        seeds = [b"staker", owner.to_account_info().key.as_ref()],
        payer = owner,
        bump = bump)]
    pub user_stake: Loader<'info, UserStake>,
    #[account(mut)] //,
    // seeds = [b"positionv1", owner.to_account_info().key.as_ref(), &index.to_le_bytes()],
    // bump = position.load()?.bump)] //TODO add after merge with invariant
    pub position: AccountInfo<'info>,
    #[account(mut)]
    pub incentive: Loader<'info, Incentive>,
    pub owner: Signer<'info>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"userstakev1", user.to_account_info().key.as_ref(), system_program.to_account_info().key.as_ref()],
        bump = bump)]
    pub user_stake: Loader<'info, UserStake>,
    #[account(mut)]
    pub incentive: Loader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = user_token_account.to_account_info().key != incentive_token_account.to_account_info().key,
        constraint = &user_token_account.owner == user.to_account_info().key
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub staker_authority: AccountInfo<'info>, // TODO validation with seed
    pub user: Signer<'info>,
    pub token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub trait WithdrawToken<'info> {
    fn withdraw(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}

impl<'info> WithdrawToken<'info> for Withdraw<'info> {
    fn withdraw(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.incentive_token_account.to_account_info(),
                to: self.user_token_account.to_account_info(),
                authority: self.staker_authority.to_account_info().clone(),
            },
        )
    }
}
