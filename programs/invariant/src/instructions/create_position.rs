use crate::interfaces::take_tokens::TakeTokens;
use crate::structs::pool::Pool;
use crate::structs::position::Position;
use crate::structs::position_list::PositionList;
use crate::structs::tick::Tick;
use crate::structs::Tickmap;
use crate::util::check_ticks;
use crate::ErrorCode::{self, *};
use crate::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token;
use anchor_spl::token_2022;
use anchor_spl::token_interface::TokenInterface;
use anchor_spl::token_interface::{Mint, TokenAccount};
use decimals::*;

#[derive(Accounts)]
#[instruction( lower_tick_index: i32, upper_tick_index: i32)]
pub struct CreatePosition<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(init,
        seeds = [b"positionv1",
        owner.key.as_ref(),
        &position_list.load()?.head.to_le_bytes()],
        bump, payer = payer, space = Position::LEN
    )]
    pub position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"poolv1", token_x.key().as_ref(), token_y.key().as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        seeds = [b"positionlistv1", owner.key.as_ref()],
        bump = position_list.load()?.bump
    )]
    pub position_list: AccountLoader<'info, PositionList>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(mut,
        seeds = [b"tickv1", pool.key().as_ref(), &lower_tick_index.to_le_bytes()],
        bump = lower_tick.load()?.bump
    )]
    pub lower_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        seeds = [b"tickv1", pool.key().as_ref(), &upper_tick_index.to_le_bytes()],
        bump = upper_tick.load()?.bump
    )]
    pub upper_tick: AccountLoader<'info, Tick>,
    #[account(mut,
        constraint = tickmap.key() == pool.load()?.tickmap @ InvalidTickmap,
        constraint = tickmap.to_account_info().owner == __program_id @ InvalidTickmapOwner,
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(constraint = token_x.key() == pool.load()?.token_x @ InvalidTokenAccount, mint::token_program = token_x_program)]
    pub token_x: InterfaceAccount<'info, Mint>,
    #[account(constraint = token_y.key() == pool.load()?.token_y @ InvalidTokenAccount, mint::token_program = token_y_program)]
    pub token_y: InterfaceAccount<'info, Mint>,
    #[account(mut,
        constraint = account_x.mint == token_x.key() @ InvalidMint,
        constraint = &account_x.owner == owner.key @ InvalidOwner,
        token::token_program = token_x_program,
    )]
    pub account_x: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = account_y.mint == token_y.key() @ InvalidMint,
        constraint = &account_y.owner == owner.key @ InvalidOwner,
        token::token_program = token_y_program,
    )]
    pub account_y: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_x.mint == token_x.key() @ InvalidMint,
        constraint = &reserve_x.owner == program_authority.key @ InvalidOwner,
        constraint = reserve_x.key() == pool.load()?.token_x_reserve @ InvalidTokenAccount,
        token::token_program = token_x_program,
    )]
    pub reserve_x: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_y.mint == token_y.key() @ InvalidMint,
        constraint = &reserve_y.owner == program_authority.key @ InvalidOwner,
        constraint = reserve_y.key() == pool.load()?.token_y_reserve @ InvalidTokenAccount,
        token::token_program = token_y_program,
    )]
    pub reserve_y: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    /// CHECK: ignore
    pub program_authority: AccountInfo<'info>,

    #[account(constraint = token_x_program.key() == token::ID || token_x_program.key() == token_2022::ID)]
    pub token_x_program: Interface<'info, TokenInterface>,
    #[account(constraint = token_y_program.key() == token::ID || token_y_program.key() == token_2022::ID)]
    pub token_y_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    /// CHECK: ignore
    pub system_program: AccountInfo<'info>,
}

impl<'info> TakeTokens<'info> for CreatePosition<'info> {
    fn take_x(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        CpiContext::new(
            self.token_x_program.to_account_info(),
            token::Transfer {
                from: self.account_x.to_account_info(),
                to: self.reserve_x.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }

    fn take_y(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        CpiContext::new(
            self.token_y_program.to_account_info(),
            token::Transfer {
                from: self.account_y.to_account_info(),
                to: self.reserve_y.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }

    fn take_x_2022(&self) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>> {
        CpiContext::new(
            self.token_x_program.to_account_info(),
            token_2022::TransferChecked {
                mint: self.token_x.to_account_info(),
                from: self.account_x.to_account_info(),
                to: self.reserve_x.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }

    fn take_y_2022(&self) -> CpiContext<'_, '_, '_, 'info, token_2022::TransferChecked<'info>> {
        CpiContext::new(
            self.token_y_program.to_account_info(),
            token_2022::TransferChecked {
                mint: self.token_y.to_account_info(),
                from: self.account_y.to_account_info(),
                to: self.reserve_y.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }
}

impl<'info> CreatePosition<'info> {
    pub fn handler(
        &self,
        liquidity_delta: Liquidity,
        slippage_limit_lower: Price,
        slippage_limit_upper: Price,
        bump: u8,
    ) -> Result<()> {
        msg!("INVARIANT: CREATE POSITION");

        let mut position = self.position.load_init()?;
        let mut pool = &mut self.pool.load_mut()?;
        let lower_tick = &mut self.lower_tick.load_mut()?;
        let upper_tick = &mut self.upper_tick.load_mut()?;
        let mut position_list = self.position_list.load_mut()?;
        let current_timestamp = get_current_timestamp();
        let mut tickmap = self.tickmap.load_mut()?;
        let slot = get_current_slot();

        // validate price
        let price = pool.sqrt_price;
        require!(price >= slippage_limit_lower, ErrorCode::PriceLimitReached);
        require!(price <= slippage_limit_upper, ErrorCode::PriceLimitReached);

        // validate ticks
        check_ticks(lower_tick.index, upper_tick.index, pool.tick_spacing)?;

        if !tickmap.get(lower_tick.index, pool.tick_spacing) {
            tickmap.flip(true, lower_tick.index, pool.tick_spacing)
        }
        if !tickmap.get(upper_tick.index, pool.tick_spacing) {
            tickmap.flip(true, upper_tick.index, pool.tick_spacing)
        }

        // update position_list head
        position_list.head = position_list.head.checked_add(1).unwrap();
        position.initialized_id(&mut pool);

        // init position
        *position = Position {
            owner: *self.owner.to_account_info().key,
            pool: *self.pool.to_account_info().key,
            id: position.id,
            liquidity: Liquidity::new(0),
            lower_tick_index: lower_tick.index,
            upper_tick_index: upper_tick.index,
            fee_growth_inside_x: FeeGrowth::new(0),
            fee_growth_inside_y: FeeGrowth::new(0),
            seconds_per_liquidity_inside: FixedPoint::new(0),
            last_slot: slot,
            tokens_owed_x: FixedPoint::new(0),
            tokens_owed_y: FixedPoint::new(0),
            bump,
        };

        let (amount_x, amount_y) = position.modify(
            pool,
            upper_tick,
            lower_tick,
            liquidity_delta,
            true,
            current_timestamp,
        )?;

        match self.token_x_program.key() {
            token_2022::ID => {
                token_2022::transfer_checked(self.take_x_2022(), amount_x.0, self.token_x.decimals)?
            }
            token::ID => token::transfer(self.take_x(), amount_x.0)?,
            _ => return Err(ErrorCode::InvalidTokenProgram.into()),
        };
        match self.token_y_program.key() {
            token_2022::ID => {
                token_2022::transfer_checked(self.take_y_2022(), amount_y.0, self.token_y.decimals)?
            }
            token::ID => token::transfer(self.take_y(), amount_y.0)?,
            _ => return Err(ErrorCode::InvalidTokenProgram.into()),
        };

        Ok(())
    }
}
