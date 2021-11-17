use crate::account::*;
use amm::account::{Pool, Position};
use amm::program::Amm;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(bump: u8)]
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
        seeds = [b"staker", owner.to_account_info().key.as_ref()],
        payer = owner,
        bump = bump)]
    pub user_stake: Loader<'info, UserStake>,
    #[account(mut,
        constraint = &Pubkey::find_program_address(
            &[
                b"positionv1",
                owner.to_account_info().key.as_ref(),
                &index.to_le_bytes(),
            ],
            &amm::program::Amm::id(),
        ).0 == position.to_account_info().key
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut)]
    pub incentive: Loader<'info, Incentive>,
    pub owner: Signer<'info>,
    pub amm: Program<'info, Amm>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(index: u32, bump_stake: u8, bump_authority: u8, )]
pub struct Withdraw<'info> {
    #[account(mut,
        seeds = [b"staker", owner.to_account_info().key.as_ref()],
        bump = bump_stake)]
    pub user_stake: Loader<'info, UserStake>,
    #[account(mut,
        constraint = &user_stake.load()?.incentive == incentive.to_account_info().key 
    )]
    pub incentive: Loader<'info, Incentive>,
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
        constraint = &Pubkey::find_program_address(
            &[
                b"positionv1",
                owner.to_account_info().key.as_ref(),
                &index.to_le_bytes(),
            ],
            &amm::program::Amm::id(),
        ).0 == position.to_account_info().key
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
