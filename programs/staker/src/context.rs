use crate::account::*;
use crate::util::check_position_seeds;

use amm::account::{Pool, Position};
use amm::program::Amm;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};


#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreateIncentive<'info> {
    #[account(init, payer = founder)]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = founder_token_account.to_account_info().key != incentive_token_account.to_account_info().key,
        constraint = &founder_token_account.owner == founder.to_account_info().key
    )]
    pub founder_token_account: Account<'info, TokenAccount>,
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(mut,
        seeds = [b"staker".as_ref()],
        bump = bump)]
    pub staker_authority: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
    pub amm: Program<'info, Amm>,
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
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(index: u32, bump_stake: u8, bump_authority: u8, )]
pub struct Withdraw<'info> {
    #[account(mut,
        seeds = [b"staker", incentive.to_account_info().key.as_ref(), &position.load()?.pool.as_ref(), &position.load()?.id.to_le_bytes() ],
        bump = bump_stake)]
    pub user_stake: AccountLoader<'info, UserStake>,
    #[account(mut,
        constraint = &user_stake.load()?.incentive == incentive.to_account_info().key 
    )]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = owner_token_account.to_account_info().key != incentive_token_account.to_account_info().key,
        constraint = &owner_token_account.owner == owner.to_account_info().key
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = check_position_seeds(owner.to_account_info(), position.to_account_info().key, index)
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"staker".as_ref()],
        bump = bump_authority)]
    pub staker_authority: AccountInfo<'info>,
    pub owner: Signer<'info>,
    pub token_program: AccountInfo<'info>,
    pub amm: Program<'info, Amm>,
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
                to: self.owner_token_account.to_account_info(),
                authority: self.staker_authority.to_account_info().clone(),
            },
        )
    }
}

#[derive(Accounts)]
#[instruction( bump_authority: u8, )]
pub struct ReturnFounds<'info> {
    #[account(mut,
        constraint = &incentive.load()?.founder == owner.to_account_info().key 
    )]
    pub incentive: AccountLoader<'info, Incentive>,
    #[account(mut,
        constraint = &incentive_token_account.owner == staker_authority.to_account_info().key,
        constraint = &incentive.load()?.token_account == incentive_token_account.to_account_info().key
    )]
    pub incentive_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub founder_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        seeds = [b"staker".as_ref()],
        bump = bump_authority)]
    pub staker_authority: AccountInfo<'info>,
    pub owner: Signer<'info>,
    pub token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

pub trait ReturnToFounder<'info> {
    fn return_to_founder(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}

impl<'info> ReturnToFounder<'info> for ReturnFounds<'info> {
    fn return_to_founder(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.incentive_token_account.to_account_info(),
                to: self.founder_token_account.to_account_info(),
                authority: self.staker_authority.to_account_info().clone(),
            },
        )
    }
}