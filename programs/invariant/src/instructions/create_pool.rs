use crate::decimals::*;
use crate::math::calculate_price_sqrt;
use crate::structs::fee_tier::FeeTier;
use crate::structs::pool::Pool;
use crate::structs::tickmap::Tickmap;
use crate::structs::State;
use crate::util::check_tick;
use crate::util::get_current_timestamp;
use crate::ErrorCode::{self, *};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use std::cmp::Ordering;

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(init,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &fee_tier.load()?.fee.v.to_le_bytes(), &fee_tier.load()?.tick_spacing.to_le_bytes()],
        bump, payer = payer, space = Pool::LEN
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(
        seeds = [b"feetierv1", __program_id.as_ref(), &fee_tier.load()?.fee.v.to_le_bytes(), &fee_tier.load()?.tick_spacing.to_le_bytes()],
        bump = fee_tier.load()?.bump
    )]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(zero)]
    pub tickmap: AccountLoader<'info, Tickmap>,

    #[account(
        mint::token_program = token_x_program
    )]
    pub token_x: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mint::token_program = token_y_program
    )]
    pub token_y: Box<InterfaceAccount<'info, Mint>>,

    #[account(init,
        token::mint = token_x,
        token::authority = authority,
        token::token_program = token_x_program,
        payer = payer,
    )]
    pub token_x_reserve: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(init,
        token::mint = token_y,
        token::authority = authority,
        token::token_program = token_y_program,
        payer = payer,
    )]
    pub token_y_reserve: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: ignore
    #[account(constraint = &state.load()?.authority == authority.key @ InvalidAuthority)]
    pub authority: AccountInfo<'info>,

    #[account(constraint = token_x_program.key() == token::ID || token_x_program.key() == token_2022::ID)]
    pub token_x_program: Interface<'info, TokenInterface>,
    #[account(constraint = token_y_program.key() == token::ID || token_y_program.key() == token_2022::ID)]
    pub token_y_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    /// CHECK: ignore
    pub system_program: AccountInfo<'info>,
}

impl<'info> CreatePool<'info> {
    pub fn handler(&self, init_tick: i32, bump: u8) -> Result<()> {
        msg!("INVARIANT: CREATE POOL");

        let token_x_address = &self.token_x.key();
        let token_y_address = &self.token_y.key();
        require!(
            token_x_address
                .to_string()
                .cmp(&token_y_address.to_string())
                == Ordering::Less,
            ErrorCode::InvalidPoolTokenAddresses
        );

        let pool = &mut self.pool.load_init()?;
        let fee_tier = self.fee_tier.load()?;
        let current_timestamp = get_current_timestamp();

        check_tick(init_tick, fee_tier.tick_spacing)?;

        **pool = Pool {
            token_x: *token_x_address,
            token_y: *token_y_address,
            token_x_reserve: *self.token_x_reserve.to_account_info().key,
            token_y_reserve: *self.token_y_reserve.to_account_info().key,
            tick_spacing: fee_tier.tick_spacing,
            fee: fee_tier.fee,
            protocol_fee: FixedPoint::from_scale(1, 2),
            liquidity: Liquidity::new(0),
            sqrt_price: calculate_price_sqrt(init_tick),
            current_tick_index: init_tick,
            tickmap: *self.tickmap.to_account_info().key,
            fee_growth_global_x: FeeGrowth::new(0),
            fee_growth_global_y: FeeGrowth::new(0),
            fee_protocol_token_x: 0,
            fee_protocol_token_y: 0,
            position_iterator: 0,
            seconds_per_liquidity_global: FixedPoint::new(0),
            start_timestamp: current_timestamp,
            last_timestamp: current_timestamp,
            fee_receiver: self.state.load()?.admin,
            oracle_address: Pubkey::default(),
            oracle_initialized: false,
            bump,
        };

        Ok(())
    }
}
