use std::cmp::Ordering;

use crate::math::calculate_price_sqrt;
use crate::structs::fee_tier::FeeTier;
use crate::structs::pool::Pool;
use crate::structs::tickmap::Tickmap;
use crate::util::check_tick;
use crate::util::get_current_timestamp;
use crate::ErrorCode::*;
use crate::{decimal::Decimal, structs::FeeGrowth, structs::State};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::Token;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreatePool<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(init,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &fee_tier.load()?.fee.v.to_le_bytes(), &fee_tier.load()?.tick_spacing.to_le_bytes()],
        bump = bump, payer = payer
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(
        seeds = [b"feetierv1", program_id.as_ref(), &fee_tier.load()?.fee.v.to_le_bytes(), &fee_tier.load()?.tick_spacing.to_le_bytes()],
        bump = fee_tier.load()?.bump
    )]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(zero)]
    pub tickmap: AccountLoader<'info, Tickmap>,
    pub token_x: Account<'info, Mint>,
    pub token_y: Account<'info, Mint>,
    #[account(init,
        token::mint = token_x,
        token::authority = authority,
        payer = payer,
    )]
    pub token_x_reserve: Account<'info, TokenAccount>,
    #[account(init,
        token::mint = token_y,
        token::authority = authority,
        payer = payer,
    )]
    pub token_y_reserve: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(constraint = &state.load()?.authority == authority.key @ InvalidAuthority)]
    pub authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

impl<'info> CreatePool<'info> {
    pub fn handler(self: &Self, bump: u8, init_tick: i32) -> ProgramResult {
        msg!("INVARIANT: CREATE POOL");

        let token_x_address = &self.token_x.key();
        let token_y_address = &self.token_y.key();
        require!(
            token_x_address
                .to_string()
                .cmp(&token_y_address.to_string())
                == Ordering::Less,
            InvalidPoolTokenAddresses
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
            protocol_fee: Decimal::new(200_000_000_000),
            liquidity: Decimal::new(0),
            sqrt_price: calculate_price_sqrt(init_tick),
            current_tick_index: init_tick,
            tickmap: *self.tickmap.to_account_info().key,
            fee_growth_global_x: FeeGrowth::zero(),
            fee_growth_global_y: FeeGrowth::zero(),
            fee_protocol_token_x: 0,
            fee_protocol_token_y: 0,
            position_iterator: 0,
            seconds_per_liquidity_global: Decimal::new(0),
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
