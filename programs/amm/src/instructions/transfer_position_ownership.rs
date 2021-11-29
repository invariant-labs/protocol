use crate::structs::position::Position;
use crate::structs::position_list::PositionList;
use anchor_lang::prelude::*;

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

pub fn handler(ctx: Context<TransferPositionOwnership>, bump: u8, index: u32) -> ProgramResult {
    msg!("TRANSFER POSITION");

    let mut owner_list = ctx.accounts.owner_list.load_mut()?;
    let mut recipient_list = ctx.accounts.recipient_list.load_mut()?;
    let mut new_position = ctx.accounts.new_position.load_init()?;
    let mut removed_position = ctx.accounts.removed_position.load_mut()?;

    owner_list.head -= 1;
    recipient_list.head += 1;

    // reassign all fields in new_position
    {
        new_position.owner = *ctx.accounts.recipient.key;
        new_position.pool = removed_position.pool;
        new_position.id = removed_position.id;
        new_position.liquidity = removed_position.liquidity;
        new_position.lower_tick_index = removed_position.lower_tick_index;
        new_position.upper_tick_index = removed_position.upper_tick_index;
        new_position.fee_growth_inside_x = removed_position.fee_growth_inside_y;
        new_position.tokens_owed_x = removed_position.tokens_owed_x;
        new_position.tokens_owed_y = removed_position.tokens_owed_y;
        new_position.bump = bump; // new bump
    }

    // when removed position is not the last one
    if owner_list.head != index {
        let last_position = ctx.accounts.last_position.load_mut()?;
        // reassign all fields in owner position list
        removed_position.owner = last_position.owner;
        removed_position.pool = last_position.pool;
        removed_position.id = last_position.id;
        removed_position.liquidity = last_position.liquidity;
        removed_position.lower_tick_index = last_position.lower_tick_index;
        removed_position.upper_tick_index = last_position.upper_tick_index;
        removed_position.fee_growth_inside_x = last_position.fee_growth_inside_x;
        removed_position.fee_growth_inside_y = last_position.fee_growth_inside_y;
        removed_position.tokens_owed_x = last_position.tokens_owed_x;
        removed_position.tokens_owed_y = last_position.tokens_owed_y;
    }

    Ok(())
}
