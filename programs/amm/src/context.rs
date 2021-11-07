use crate::account::*;
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
#[instruction(bump: u8, fee: u64, tick_spacing: u16)]
pub struct CreateFeeTier<'info> {
    #[account(init,
        seeds = [b"feetierv1", program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()],
        bump = bump, payer = payer
    )]
    pub fee_tier: Loader<'info, FeeTier>,
    #[account(mut, signer)]
    pub payer: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: AccountInfo<'info>,
}
#[derive(Accounts)]
#[instruction(bump: u8, nonce: u8, init_tick: i32, fee: u64, tick_spacing: u16)]
pub struct Create<'info> {
    #[account(init,
        seeds = [b"poolv1", token_x.key.as_ref(), token_y.key.as_ref()],
        bump = bump, payer = payer
    )]
    pub pool: Loader<'info, Pool>,
    #[account(
        seeds = [b"feetierv1", program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()],
        bump = fee_tier.load()?.bump
    )]
    pub fee_tier: Loader<'info, FeeTier>,
    #[account(zero)]
    pub tickmap: Loader<'info, Tickmap>,
    pub token_x: AccountInfo<'info>,
    pub token_y: AccountInfo<'info>,
    pub token_x_reserve: AccountInfo<'info>,
    pub token_y_reserve: AccountInfo<'info>,
    pub program_authority: AccountInfo<'info>,
    #[account(mut, signer)]
    pub payer: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: AccountInfo<'info>,
}
#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut, seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()], bump = pool.load()?.bump)]
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
#[instruction(bump: u8, index: i32)]
pub struct CreateTick<'info> {
    #[account(init,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &index.to_le_bytes()],
        bump = bump, payer = payer
    )]
    pub tick: Loader<'info, Tick>,
    #[account(
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
        bump = pool.load()?.bump)]
    pub pool: Loader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.to_account_info().key == &pool.load()?.tickmap,
        constraint = tickmap.to_account_info().owner == program_id,
    )]
    pub tickmap: Loader<'info, Tickmap>,
    #[account(mut, signer)]
    pub payer: AccountInfo<'info>,
    pub token_x: AccountInfo<'info>,
    pub token_y: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreatePositionList<'info> {
    #[account(init,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = bump,
        payer = owner
    )]
    pub position_list: Loader<'info, PositionList>,
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(index: i32, lower_tick_index: i32, upper_tick_index: i32)]
pub struct RemovePosition<'info> {
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &index.to_le_bytes()],
        bump = removed_position.load()?.bump
    )]
    pub removed_position: Loader<'info, Position>,
    #[account(mut,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = position_list.load()?.bump
    )]
    pub position_list: Loader<'info, PositionList>,
    #[account(mut,
        close = owner,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &(position_list.load()?.head - 1).to_le_bytes()],
        bump = last_position.load()?.bump
    )]
    pub last_position: Loader<'info, Position>,
    #[account(mut,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
        bump = pool.load()?.bump
    )]
    pub pool: Loader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.to_account_info().key == &pool.load()?.tickmap,
        constraint = tickmap.to_account_info().owner == program_id,
    )]
    pub tickmap: Loader<'info, Tickmap>,
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
    pub token_program: AccountInfo<'info>,
    pub program_authority: AccountInfo<'info>,
}

impl<'info> SendTokens<'info> for RemovePosition<'info> {
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
#[instruction(bump: u8, index: u32)]
pub struct TransferPositionOwnership<'info> {
    #[account(mut,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = owner_list.load()?.bump
    )]
    pub owner_list: Loader<'info, PositionList>,
    #[account(mut,
        seeds = [b"positionlistv1", recipient.to_account_info().key.as_ref()],
        bump = recipient_list.load()?.bump,
        constraint = recipient_list.to_account_info().key != owner_list.to_account_info().key
    )]
    pub recipient_list: Loader<'info, PositionList>,
    #[account(init,
        seeds = [b"positionv1",
        recipient.to_account_info().key.as_ref(),
        &recipient_list.load()?.head.to_le_bytes()],
        bump = bump, payer = owner,
    )]
    pub new_position: Loader<'info, Position>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &index.to_le_bytes()],
        bump = removed_position.load()?.bump,
    )]
    pub removed_position: Loader<'info, Position>,
    #[account(mut,
        close = owner,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &(owner_list.load()?.head - 1).to_le_bytes()],
        bump = last_position.load()?.bump
    )]
    pub last_position: Loader<'info, Position>,
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
    pub recipient: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(bump: u8, lower_tick_index: i32, upper_tick_index: i32)]
pub struct InitPosition<'info> {
    #[account(init,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &position_list.load()?.head.to_le_bytes()],
        bump = bump, payer = owner,
    )]
    pub position: Loader<'info, Position>,
    #[account(mut,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
        bump = pool.load()?.bump
    )]
    pub pool: Loader<'info, Pool>,
    #[account(mut,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = position_list.load()?.bump
    )]
    pub position_list: Loader<'info, PositionList>,
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
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
    pub rent: Sysvar<'info, Rent>,
    pub system_program: AccountInfo<'info>,
}

impl<'info> TakeTokens<'info> for InitPosition<'info> {
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

#[derive(Accounts)]
#[instruction(index: u32, lower_tick_index: i32, upper_tick_index: i32)]
pub struct ClaimFee<'info> {
    #[account(mut,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
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
