use crate::decimal::Decimal;
use crate::interfaces::SendTokens;
use crate::structs::pool::Pool;
use crate::structs::state::State;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct WithdrawProtocolFee<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut, seeds = [b"poolv1", fee_tier.key.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()], bump = pool.load()?.bump)]
    pub pool: AccountLoader<'info, Pool>,
    pub token_x: Account<'info, Mint>,
    pub token_y: Account<'info, Mint>,
    pub fee_tier: AccountInfo<'info>,
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
    #[account(mut,
        constraint = &state.load()?.admin == admin.key)]
    pub admin: Signer<'info>,
    #[account(
        constraint = &state.load()?.authority == program_authority.key
    )]
    pub program_authority: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> SendTokens<'info> for WithdrawProtocolFee<'info> {
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

pub fn handler(ctx: Context<WithdrawProtocolFee>, seed: &str) -> ProgramResult {
    msg!("INVARIANT: WITHDRAW PROTOCOL FEE");

    let state = ctx.accounts.state.load()?;
    let mut pool = ctx.accounts.pool.load_mut()?;

    let fee_to_collect_x = pool.fee_protocol_token_x.to_token_floor();
    let fee_to_collect_y = pool.fee_protocol_token_y.to_token_floor();
    pool.fee_protocol_token_x =
        pool.fee_protocol_token_x - Decimal::from_integer(fee_to_collect_x.into());
    pool.fee_protocol_token_y =
        pool.fee_protocol_token_y - Decimal::from_integer(fee_to_collect_y.into());

    let seeds = &[seed.as_bytes(), &[state.nonce]];
    let signer = &[&seeds[..]];

    let cpi_ctx_x = ctx.accounts.send_x().with_signer(signer);
    let cpi_ctx_y = ctx.accounts.send_y().with_signer(signer);

    token::transfer(cpi_ctx_x, fee_to_collect_x)?;
    token::transfer(cpi_ctx_y, fee_to_collect_y)?;

    Ok(())
}
