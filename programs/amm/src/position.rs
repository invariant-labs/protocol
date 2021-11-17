use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Transfer};
use std::ops::Mul;

use anchor_lang::require;

use crate::math::get_delta_y;
use crate::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct Position {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub id: u64, // unique inside pool
    pub liquidity: Decimal,
    pub lower_tick_index: i32,
    pub upper_tick_index: i32,
    pub fee_growth_inside_x: Decimal,
    pub fee_growth_inside_y: Decimal,
    pub tokens_owed_x: Decimal,
    pub tokens_owed_y: Decimal,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(fee_tier_address: Pubkey, index: i32, lower_tick_index: i32, upper_tick_index: i32)]
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
        seeds = [b"poolv1", fee_tier_address.as_ref(), token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref()],
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
#[instruction(bump: u8, fee_tier_address: Pubkey, lower_tick_index: i32, upper_tick_index: i32)]
pub struct InitPosition<'info> {
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

impl Position {
    pub fn modify(
        self: &mut Self,
        pool: &mut Pool,
        upper_tick: &mut Tick,
        lower_tick: &mut Tick,
        liquidity_delta: Decimal,
        add: bool,
    ) -> Result<(u64, u64)> {
        // update initialized tick
        lower_tick.update(
            pool.current_tick_index,
            liquidity_delta,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
            false,
            add,
        )?;
        upper_tick.update(
            pool.current_tick_index,
            liquidity_delta,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
            true,
            add,
        )?;

        // update fee inside position
        let (fee_growth_inside_x, fee_growth_inside_y) = calculate_fee_growth_inside(
            *lower_tick,
            *upper_tick,
            pool.current_tick_index,
            pool.fee_growth_global_x,
            pool.fee_growth_global_y,
        );

        self.update(
            add,
            liquidity_delta,
            fee_growth_inside_x,
            fee_growth_inside_y,
        )?;

        // calculate tokens amounts and update pool liquidity
        let token_amounts = calculate_amount_delta(
            pool,
            liquidity_delta,
            add,
            upper_tick.index,
            lower_tick.index,
        )?;

        Ok(token_amounts)
    }

    pub fn update(
        self: &mut Self,
        sign: bool,
        liquidity_delta: Decimal,
        fee_growth_inside_x: Decimal,
        fee_growth_inside_y: Decimal,
    ) -> Result<()> {
        require!(
            liquidity_delta.v != 0 || self.liquidity.v != 0,
            ErrorCode::EmptyPositionPokes
        );

        // calculate accumulated fee
        let tokens_owed_x = self
            .liquidity
            .mul(fee_growth_inside_x - self.fee_growth_inside_x);
        let tokens_owed_y = self
            .liquidity
            .mul(fee_growth_inside_y - self.fee_growth_inside_y);

        self.liquidity = self.calculate_new_liquidity_safely(sign, liquidity_delta)?;
        self.fee_growth_inside_x = fee_growth_inside_x;
        self.fee_growth_inside_y = fee_growth_inside_y;
        self.tokens_owed_x = self.tokens_owed_x + tokens_owed_x;
        self.tokens_owed_y = self.tokens_owed_y + tokens_owed_y;

        Ok(())
    }

    pub fn initialized_id(self: &mut Self, pool: &mut Pool) {
        self.id = pool.position_iterator;
        pool.position_iterator += 1;
    }

    // for future use
    pub fn get_id(self: Self) -> String {
        let mut id = self.pool.to_string().to_owned();
        id.push_str({ self.id }.to_string().as_str());
        id
    }

    // TODO: add tests
    fn calculate_new_liquidity_safely(
        self: &mut Self,
        sign: bool,
        liquidity_delta: Decimal,
    ) -> Result<Decimal> {
        // validate in decrease liquidity case
        if !sign && { self.liquidity } < liquidity_delta {
            return Err(ErrorCode::InvalidPositionLiquidity.into());
        }

        Ok(match sign {
            true => self.liquidity + liquidity_delta,
            false => self.liquidity - liquidity_delta,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_new_liquidity_safely() {
        // negative liquidity error
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(1),
                ..Default::default()
            };
            let sign: bool = false;
            let liquidity_delta: Decimal = Decimal::from_integer(2);

            let result = position.calculate_new_liquidity_safely(sign, liquidity_delta);

            assert!(result.is_err());
        }
        // adding liquidity
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(2),
                ..Default::default()
            };
            let sign: bool = true;
            let liquidity_delta: Decimal = Decimal::from_integer(2);

            let new_liquidity = position
                .calculate_new_liquidity_safely(sign, liquidity_delta)
                .unwrap();

            assert_eq!(new_liquidity, Decimal::from_integer(4));
        }
        // subtracting liquidity
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(2),
                ..Default::default()
            };
            let sign: bool = false;
            let liquidity_delta: Decimal = Decimal::from_integer(2);

            let new_liquidity = position
                .calculate_new_liquidity_safely(sign, liquidity_delta)
                .unwrap();

            assert_eq!(new_liquidity, Decimal::from_integer(0));
        }
    }

    #[test]
    fn test_update_position() {
        // Disable empty position pokes error
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(0),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = Decimal::from_integer(0);
            let fee_growth_inside_x = Decimal::from_integer(1);
            let fee_growth_inside_y = Decimal::from_integer(1);

            let result = position.update(
                sign,
                liquidity_delta,
                fee_growth_inside_x,
                fee_growth_inside_y,
            );

            assert!(result.is_err());
        }
        // zero liquidity fee shouldn't change
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(0),
                fee_growth_inside_x: Decimal::from_integer(4),
                fee_growth_inside_y: Decimal::from_integer(4),
                tokens_owed_x: Decimal::from_integer(100),
                tokens_owed_y: Decimal::from_integer(100),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = Decimal::from_integer(1);
            let fee_growth_inside_x = Decimal::from_integer(5);
            let fee_growth_inside_y = Decimal::from_integer(5);

            position
                .update(
                    sign,
                    liquidity_delta,
                    fee_growth_inside_x,
                    fee_growth_inside_y,
                )
                .unwrap();

            assert_eq!({ position.liquidity }, Decimal::from_integer(1));
            assert_eq!({ position.fee_growth_inside_x }, Decimal::from_integer(5));
            assert_eq!({ position.fee_growth_inside_y }, Decimal::from_integer(5));
            assert_eq!({ position.tokens_owed_x }, Decimal::from_integer(100));
            assert_eq!({ position.tokens_owed_y }, Decimal::from_integer(100));
        }
        // fee should change
        {
            let mut position = Position {
                liquidity: Decimal::from_integer(1),
                fee_growth_inside_x: Decimal::from_integer(4),
                fee_growth_inside_y: Decimal::from_integer(4),
                tokens_owed_x: Decimal::from_integer(100),
                tokens_owed_y: Decimal::from_integer(100),
                ..Default::default()
            };
            let sign = true;
            let liquidity_delta = Decimal::from_integer(1);
            let fee_growth_inside_x = Decimal::from_integer(5);
            let fee_growth_inside_y = Decimal::from_integer(5);

            position
                .update(
                    sign,
                    liquidity_delta,
                    fee_growth_inside_x,
                    fee_growth_inside_y,
                )
                .unwrap();

            assert_eq!({ position.liquidity }, Decimal::from_integer(2));
            assert_eq!({ position.fee_growth_inside_x }, Decimal::from_integer(5));
            assert_eq!({ position.fee_growth_inside_y }, Decimal::from_integer(5));
            assert_eq!({ position.tokens_owed_x }, Decimal::from_integer(101));
            assert_eq!({ position.tokens_owed_y }, Decimal::from_integer(101));
        }
    }
}
