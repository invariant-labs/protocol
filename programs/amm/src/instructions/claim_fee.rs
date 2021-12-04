use crate::interfaces::send_tokens::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::tick::Tick;
use crate::util::*;
use crate::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(fee_tier_address: Pubkey, index: u32, lower_tick_index: i32, upper_tick_index: i32)]
pub struct ClaimFee<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        seeds = [b"poolv1", fee_tier_address.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.to_account_info().key.as_ref(),
        &index.to_le_bytes()],
        bump = position.load()?.bump
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &lower_tick_index.to_le_bytes()],
        bump = lower_tick.load()?.bump
    )]
    pub lower_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        seeds = [b"tickv1", pool.to_account_info().key.as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump
    )]
    pub upper_tick: AccountLoader<'info, Tick>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut,
        constraint = token_x.to_account_info().key == &pool.load()?.token_x,
    )]
    pub token_x: Account<'info, Mint>,
    #[account(mut,
        constraint = token_y.to_account_info().key == &pool.load()?.token_y,
    )]
    pub token_y: Account<'info, Mint>,
    #[account(mut,
        constraint = &account_x.mint == token_x.to_account_info().key,
        constraint = &account_x.owner == owner.key,
    )]
    pub account_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = &account_y.mint == token_y.to_account_info().key,
        constraint = &account_y.owner == owner.key	
    )]
    pub account_y: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = &reserve_x.mint == token_x.to_account_info().key,
        constraint = &reserve_x.owner == program_authority.key,
        constraint = reserve_x.to_account_info().key == &pool.load()?.token_x_reserve
    )]
    pub reserve_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = &reserve_y.mint == token_y.to_account_info().key,
        constraint = &reserve_y.owner == program_authority.key,
        constraint = reserve_y.to_account_info().key == &pool.load()?.token_y_reserve
    )]
    pub reserve_y: Box<Account<'info, TokenAccount>>,
    #[account(constraint = &state.load()?.authority == program_authority.key)]
    pub program_authority: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> interfaces::SendTokens<'info> for ClaimFee<'info> {
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

pub fn handler(
    ctx: Context<ClaimFee>,
    _fee_tier_address: Pubkey,
    _index: u32,
    _lower_tick_index: i32,
    _upper_tick_index: i32,
) -> ProgramResult {
    msg!("INVARIANT: CLAIM FEE");

    let state = ctx.accounts.state.load()?;
    let pool = &mut ctx.accounts.pool.load_mut()?;
    let position = &mut ctx.accounts.position.load_mut()?;
    let lower_tick = &mut ctx.accounts.lower_tick.load_mut()?;
    let upper_tick = &mut ctx.accounts.upper_tick.load_mut()?;
    let current_timestamp = Clock::get()?.unix_timestamp as u64;

    check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;

    position
        .modify(
            pool,
            upper_tick,
            lower_tick,
            Decimal::new(0),
            true,
            current_timestamp,
        )
        .unwrap();

    let fee_to_collect_x = position.tokens_owed_x.to_token_floor();
    let fee_to_collect_y = position.tokens_owed_y.to_token_floor();
    position.tokens_owed_x =
        position.tokens_owed_x - Decimal::from_integer(fee_to_collect_x.into());
    position.tokens_owed_y =
        position.tokens_owed_y - Decimal::from_integer(fee_to_collect_y.into());

    let seeds = &[SEED.as_bytes(), &[state.nonce]];
    let signer = &[&seeds[..]];

    let cpi_ctx_x = ctx.accounts.send_x().with_signer(signer);
    let cpi_ctx_y = ctx.accounts.send_y().with_signer(signer);

    token::transfer(cpi_ctx_x, fee_to_collect_x)?;
    token::transfer(cpi_ctx_y, fee_to_collect_y)?;

    Ok(())
}
