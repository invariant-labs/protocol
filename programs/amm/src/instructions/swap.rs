use crate::decimal::Decimal;
use crate::interfaces::send_tokens::SendTokens;
use crate::interfaces::take_tokens::TakeTokens;
use crate::math::compute_swap_step;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::util::get_closer_limit;
use crate::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(fee_tier_address: Pubkey)]
pub struct Swap<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: Loader<'info, State>,
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

pub fn handler(
    ctx: Context<Swap>,
    _fee_tier_address: Pubkey,
    x_to_y: bool,
    amount: u64,
    by_amount_in: bool, // whether amount specifies input or output
    sqrt_price_limit: u128,
) -> ProgramResult {
    msg!("SWAP");
    require!(amount != 0, ZeroAmount);

    let sqrt_price_limit = Decimal::new(sqrt_price_limit);
    let mut pool = ctx.accounts.pool.load_mut()?;
    let tickmap = ctx.accounts.tickmap.load()?;
    let state = ctx.accounts.state.load()?;

    // limit is on the right side of price
    if x_to_y {
        require!({ pool.sqrt_price } > sqrt_price_limit, WrongLimit);
    } else {
        require!({ pool.sqrt_price } < sqrt_price_limit, WrongLimit);
    }

    let mut remaining_amount = Decimal::from_integer(amount.into());

    let mut total_amount_in = Decimal::new(0);
    let mut total_amount_out = Decimal::new(0);

    while remaining_amount != Decimal::from_integer(0) {
        let (swap_limit, limiting_tick) = get_closer_limit(
            sqrt_price_limit,
            x_to_y,
            pool.current_tick_index,
            pool.tick_spacing,
            &tickmap,
        );

        let result = compute_swap_step(
            pool.sqrt_price,
            swap_limit,
            pool.liquidity,
            remaining_amount,
            by_amount_in,
            pool.fee,
        );

        // make remaining amount smaller
        if by_amount_in {
            remaining_amount = remaining_amount - result.amount_in - result.fee_amount;
        } else {
            remaining_amount = remaining_amount - result.amount_out;
        }

        // fee has to be added before crossing any ticks
        let protocol_fee = result.fee_amount * state.protocol_fee;

        pool.add_fee(result.fee_amount - protocol_fee, x_to_y);
        if x_to_y {
            pool.fee_protocol_token_x = pool.fee_protocol_token_x + protocol_fee;
        } else {
            pool.fee_protocol_token_y = pool.fee_protocol_token_y + protocol_fee;
        }

        pool.sqrt_price = result.next_price_sqrt;

        total_amount_in = total_amount_in + result.amount_in + result.fee_amount;
        total_amount_out = total_amount_out + result.amount_out;

        // Fail if price would go over swap limit
        if { pool.sqrt_price } == sqrt_price_limit && remaining_amount > Decimal::new(0) {
            Err(ErrorCode::PriceLimitReached)?;
        }

        // crossing tick
        if result.next_price_sqrt == swap_limit && limiting_tick.is_some() {
            let (tick_index, initialized) = limiting_tick.unwrap();

            if initialized {
                // Calculating address of the crossed tick
                let (tick_address, _) = Pubkey::find_program_address(
                    &[
                        b"tickv1",
                        ctx.accounts.pool.to_account_info().key.as_ref(),
                        &tick_index.to_le_bytes(),
                    ],
                    ctx.program_id,
                );

                // Finding the correct tick in remaining accounts
                let loader = match ctx
                    .remaining_accounts
                    .iter()
                    .find(|account| *account.key == tick_address)
                {
                    Some(account) => {
                        Loader::<'_, Tick>::try_from(ctx.program_id, &account).unwrap()
                    }
                    None => return Err(ErrorCode::TickNotFound.into()),
                };
                let mut tick = loader.load_mut().unwrap();

                // crossing tick
                cross_tick(&mut tick, &mut pool);
            }

            // set tick to limit (below if price is going down, because current tick is below price)
            pool.current_tick_index = if x_to_y && remaining_amount != Decimal::new(0) {
                tick_index - pool.tick_spacing as i32
            } else {
                tick_index
            };
        } else {
            // Binary search for tick (can happen only on the last step)
            pool.current_tick_index = get_tick_from_price(
                pool.current_tick_index,
                pool.tick_spacing,
                result.next_price_sqrt,
                x_to_y,
            );
        }
    }

    // Execute swap
    let (take_ctx, send_ctx) = if x_to_y {
        (ctx.accounts.take_x(), ctx.accounts.send_y())
    } else {
        (ctx.accounts.take_y(), ctx.accounts.send_x())
    };

    let seeds = &[SEED.as_bytes(), &[pool.nonce]];
    let signer = &[&seeds[..]];

    // Maybe rounding error should be counted?
    token::transfer(take_ctx, total_amount_in.to_token_ceil())?;
    token::transfer(
        send_ctx.with_signer(signer),
        total_amount_out.to_token_floor(),
    )?;

    Ok(())
}
