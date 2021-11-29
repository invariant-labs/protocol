use crate::decimal::Decimal;
use crate::interfaces::take_tokens::TakeTokens;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::position_list::PositionList;
use crate::structs::tick::Tick;
use crate::util::check_ticks;
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(bump: u8, fee_tier_address: Pubkey, lower_tick_index: i32, upper_tick_index: i32)]
pub struct CreatePosition<'info> {
    #[account(init,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &position_list.load()?.head.to_le_bytes()],
        bump = bump, payer = owner,
    )]
    pub position: Loader<'info, Position>,
    #[account(mut,
        seeds = [b"poolv1", fee_tier_address.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
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

impl<'info> TakeTokens<'info> for CreatePosition<'info> {
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

pub fn handler(
    ctx: Context<CreatePosition>,
    bump: u8,
    _fee_tier_address: Pubkey,
    _lower_tick_index: i32,
    _upper_tick_index: i32,
    liquidity_delta: Decimal,
) -> ProgramResult {
    msg!("INIT_POSITION");

    let mut position = ctx.accounts.position.load_init()?;
    let mut pool = &mut ctx.accounts.pool.load_mut()?;
    let lower_tick = &mut ctx.accounts.lower_tick.load_mut()?;
    let upper_tick = &mut ctx.accounts.upper_tick.load_mut()?;
    let mut position_list = ctx.accounts.position_list.load_mut()?;

    // validate ticks
    check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;

    // update position_list head
    position_list.head += 1;
    position.initialized_id(&mut pool);

    // init position
    *position = Position {
        owner: *ctx.accounts.owner.to_account_info().key,
        pool: *ctx.accounts.pool.to_account_info().key,
        id: position.id,
        liquidity: Decimal::new(0),
        lower_tick_index: lower_tick.index,
        upper_tick_index: upper_tick.index,
        fee_growth_inside_x: Decimal::new(0),
        fee_growth_inside_y: Decimal::new(0),
        tokens_owed_x: Decimal::new(0),
        tokens_owed_y: Decimal::new(0),
        bump: bump,
    };

    let (amount_x, amount_y) =
        position.modify(pool, upper_tick, lower_tick, liquidity_delta, true)?;

    token::transfer(ctx.accounts.take_x(), amount_x)?;
    token::transfer(ctx.accounts.take_y(), amount_y)?;
    Ok(())
}
