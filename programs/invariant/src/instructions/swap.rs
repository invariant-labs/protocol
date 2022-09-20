use crate::interfaces::send_tokens::SendTokens;
use crate::interfaces::take_ref_tokens::TakeRefTokens;
use crate::interfaces::take_tokens::TakeTokens;
use crate::log::get_tick_at_sqrt_price;
use crate::math::compute_swap_step;
use crate::structs::pool::Pool;
use crate::structs::tick::Tick;
use crate::structs::tickmap::Tickmap;
use crate::util::get_closer_limit;
use crate::ErrorCode::*;
use crate::*;
use crate::{decimals::*, referral::whitelist::contains_owner};
use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        seeds = [b"poolv1", account_x.mint.as_ref(), account_y.mint.as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(mut,
        constraint = tickmap.to_account_info().key == &pool.load()?.tickmap @ InvalidTickmap,
        constraint = tickmap.to_account_info().owner == program_id @ InvalidTickmapOwner
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut,
        constraint = &account_x.owner == owner.key @ InvalidOwner
    )]
    pub account_x: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = &account_y.owner == owner.key @ InvalidOwner
    )]
    pub account_y: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = reserve_x.mint == account_x.mint @ InvalidMint,
        constraint = &reserve_x.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_x.to_account_info().key == &pool.load()?.token_x_reserve @ InvalidTokenAccount
    )]
    pub reserve_x: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = reserve_y.mint == account_y.mint @ InvalidMint,
        constraint = &reserve_y.owner == program_authority.key @ InvalidAuthority,
        constraint = reserve_y.to_account_info().key == &pool.load()?.token_y_reserve @ InvalidTokenAccount
    )]
    pub reserve_y: Box<Account<'info, TokenAccount>>,
    pub owner: Signer<'info>,
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    pub program_authority: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> TakeTokens<'info> for Swap<'info> {
    fn take_x(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_x.to_account_info(),
                to: self.reserve_x.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }

    fn take_y(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_y.to_account_info(),
                to: self.reserve_y.to_account_info(),
                authority: self.owner.to_account_info().clone(),
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

impl<'info> TakeRefTokens<'info> for Swap<'info> {
    fn take_ref_x(&self, to: AccountInfo<'info>) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_x.to_account_info(),
                to: to.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }

    fn take_ref_y(&self, to: AccountInfo<'info>) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.account_y.to_account_info(),
                to: to.to_account_info(),
                authority: self.owner.to_account_info().clone(),
            },
        )
    }
}

impl<'info> Swap<'info> {
    pub fn handler(
        ctx: Context<'_, '_, '_, 'info, Swap<'info>>,
        x_to_y: bool,
        amount: u64,
        by_amount_in: bool, // whether amount specifies input or output
        sqrt_price_limit: u128,
    ) -> ProgramResult {
        msg!("INVARIANT: SWAP");
        require!(amount != 0, ZeroAmount);

        let sqrt_price_limit = Price::new(sqrt_price_limit);
        let mut pool = ctx.accounts.pool.load_mut()?;
        let tickmap = ctx.accounts.tickmap.load()?;
        let state = ctx.accounts.state.load()?;

        let ref_account = match ctx
            .remaining_accounts
            .iter()
            .find(|account| *account.owner == token::ID)
        {
            Some(account) => match Account::<'_, TokenAccount>::try_from(account) {
                Ok(token) => {
                    let is_valid_mint = token.mint
                        == match x_to_y {
                            true => ctx.accounts.account_x.mint,
                            false => ctx.accounts.account_y.mint,
                        };
                    let is_on_whitelist = contains_owner(token.owner);
                    match is_valid_mint && is_on_whitelist {
                        true => Some(account),
                        false => None,
                    }
                }
                Err(_) => None,
            },
            None => None,
        };

        // limit is on the right side of price
        if x_to_y {
            require!(
                { pool.sqrt_price } > sqrt_price_limit
                    && sqrt_price_limit <= Price::new(MAX_SQRT_PRICE),
                WrongLimit
            );
        } else {
            require!(
                { pool.sqrt_price } < sqrt_price_limit
                    && sqrt_price_limit >= Price::new(MIN_SQRT_PRICE),
                WrongLimit
            );
        }

        let mut remaining_amount = TokenAmount(amount);

        let mut total_amount_in = TokenAmount(0);
        let mut total_amount_out = TokenAmount(0);
        let mut total_amount_referral = TokenAmount(0);

        while !remaining_amount.is_zero() {
            let (swap_limit, limiting_tick) = get_closer_limit(
                sqrt_price_limit,
                x_to_y,
                pool.current_tick_index,
                pool.tick_spacing,
                &tickmap,
            )?;

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
                remaining_amount -= result.amount_in + result.fee_amount;
            } else {
                remaining_amount -= result.amount_out;
            }

            total_amount_referral += match ref_account.is_some() {
                true => pool.add_fee(result.fee_amount, FixedPoint::from_scale(2, 1), x_to_y),
                false => pool.add_fee(result.fee_amount, FixedPoint::from_integer(0), x_to_y),
            };

            pool.sqrt_price = result.next_price_sqrt;

            total_amount_in += result.amount_in + result.fee_amount;
            total_amount_out += result.amount_out;

            // Fail if price would go over swap limit
            if { pool.sqrt_price } == sqrt_price_limit && !remaining_amount.is_zero() {
                return Err(ErrorCode::PriceLimitReached.into());
            }

            // crossing tick
            // trunk-ignore(clippy/unnecessary_unwrap)
            if result.next_price_sqrt == swap_limit && limiting_tick.is_some() {
                let (tick_index, initialized) = limiting_tick.unwrap();

                let is_enough_amount_to_cross = is_enough_amount_to_push_price(
                    remaining_amount,
                    result.next_price_sqrt,
                    pool.liquidity,
                    pool.fee,
                    by_amount_in,
                    x_to_y,
                );

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
                        Some(account) => AccountLoader::<'_, Tick>::try_from(account).unwrap(),
                        None => return Err(ErrorCode::TickNotFound.into()),
                    };
                    let mut tick = loader.load_mut().unwrap();

                    // crossing tick
                    if !x_to_y || is_enough_amount_to_cross {
                        msg!("INVARIANT: CROSSING TICK {} ", { tick.index });
                        cross_tick(&mut tick, &mut pool, get_current_timestamp())?;
                    } else if !remaining_amount.is_zero() {
                        if by_amount_in {
                            pool.add_fee(remaining_amount, FixedPoint::from_integer(0), x_to_y);
                            total_amount_in += remaining_amount;
                        }
                        remaining_amount = TokenAmount(0);
                    }
                }
                // set tick to limit (below if price is going down, because current tick should always be below price)
                pool.current_tick_index = if x_to_y && is_enough_amount_to_cross {
                    tick_index.checked_sub(pool.tick_spacing as i32).unwrap()
                } else {
                    tick_index
                };
            } else {
                assert!(
                    pool.current_tick_index
                        .checked_rem(pool.tick_spacing.into())
                        .unwrap()
                        == 0,
                    "tick not divisible by spacing"
                );
                pool.current_tick_index =
                    get_tick_at_sqrt_price(result.next_price_sqrt, pool.tick_spacing);
            }
        }

        if total_amount_out.0 == 0 {
            return Err(ErrorCode::NoGainSwap.into());
        }

        // Execute swap
        let (take_ctx, send_ctx) = match x_to_y {
            true => (ctx.accounts.take_x(), ctx.accounts.send_y()),
            false => (ctx.accounts.take_y(), ctx.accounts.send_x()),
        };

        let signer: &[&[&[u8]]] = get_signer!(state.nonce);
        token::transfer(send_ctx.with_signer(signer), total_amount_out.0)?;

        match ref_account.is_some() && !total_amount_referral.is_zero() {
            true => {
                let take_ref_ctx = match x_to_y {
                    true => ctx.accounts.take_ref_x(ref_account.unwrap().clone()),
                    false => ctx.accounts.take_ref_y(ref_account.unwrap().clone()),
                };
                token::transfer(take_ctx, total_amount_in.0 - total_amount_referral.0)?;
                token::transfer(take_ref_ctx, total_amount_referral.0)?;
            }
            false => {
                token::transfer(take_ctx, total_amount_in.0)?;
            }
        }

        Ok(())
    }
}
