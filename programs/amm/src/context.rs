use crate::pool::Pool;
use crate::position::Position;
use crate::tick::Tick;
use crate::tickmap::Tickmap;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Transfer};

pub trait TakeTokens<'info> {
    fn take_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn take_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}

pub trait SendTokens<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
}
#[derive(Accounts)]
#[instruction(fee_tier_address: Pubkey)]
pub struct Swap<'info> {
    #[account(mut, seeds = [b"poolv1", fee_tier_address.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()], bump = pool.load()?.bump)]
    pub pool: Loader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.to_account_info().key == &pool.load()?.tickmap,
        constraint = tickmap.to_account_info().owner == program_id,
    )]
    pub tickmap: Loader<'info, Tickmap>,
    pub token_x: Account<'info, Mint>,
    pub token_y: Account<'info, Mint>,
    #[account(mut,
        constraint = &reserve_x.mint == token_x.to_account_info().key
    )]
    pub reserve_x: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = &reserve_y.mint == token_y.to_account_info().key
    )]
    pub reserve_y: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = &account_x.mint == token_x.to_account_info().key
    )]
    pub account_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = &account_y.mint == token_y.to_account_info().key
    )]
    pub account_y: Box<Account<'info, TokenAccount>>,
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    pub program_authority: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> TakeTokens<'info> for Swap<'info> {
    fn take_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_x.to_account_info(),
                to: self.reserve_x.to_account_info(),
                authority: self.owner.clone(),
            },
        )
    }

    fn take_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_y.to_account_info(),
                to: self.reserve_y.to_account_info(),
                authority: self.owner.clone(),
            },
        )
    }
}
impl<'info> SendTokens<'info> for Swap<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_x.to_account_info(),
                to: self.account_x.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }

    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_y.to_account_info(),
                to: self.account_y.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }
}

#[derive(Accounts)]
#[instruction(fee_tier_address: Pubkey, index: u32, lower_tick_index: i32, upper_tick_index: i32)]
pub struct ClaimFee<'info> {
    #[account(mut,
        seeds = [b"poolv1", fee_tier_address.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
        bump = pool.load()?.bump
    )]
    pub pool: Loader<'info, Pool>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &index.to_le_bytes()],
        bump = position.load()?.bump
    )]
    pub position: Loader<'info, Position>,
    #[account(mut,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &lower_tick_index.to_le_bytes()],
        bump = lower_tick.load()?.bump
    )]
    pub lower_tick: Loader<'info, Tick>,
    #[account(mut,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump
    )]
    pub upper_tick: Loader<'info, Tick>,
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
    #[account(mut)]
    pub token_x: Account<'info, Mint>,
    #[account(mut)]
    pub token_y: Account<'info, Mint>,
    #[account(mut)]
    pub account_x: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub account_y: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub reserve_x: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub reserve_y: Box<Account<'info, TokenAccount>>,
    pub program_authority: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> SendTokens<'info> for ClaimFee<'info> {
    fn send_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_x.to_account_info(),
                to: self.account_x.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }

    fn send_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_y.to_account_info(),
                to: self.account_y.to_account_info(),
                authority: self.program_authority.clone(),
            },
        )
    }
}
