use crate::structs::position::Position;
use crate::structs::position_list::PositionList;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
#[instruction(bump: u8, index: u32)]
pub struct TransferPositionOwnership<'info> {
    #[account(mut,
        seeds = [b"positionlistv1", owner.key().as_ref()],
        bump = owner_list.load()?.bump
    )]
    pub owner_list: AccountLoader<'info, PositionList>,
    #[account(mut,
        seeds = [b"positionlistv1", recipient.key().as_ref()],
        bump = recipient_list.load()?.bump,
        constraint = recipient_list.key() != owner_list.key() @ InvalidListOwner
    )]
    pub recipient_list: AccountLoader<'info, PositionList>,
    #[account(init,
        seeds = [b"positionv1",
        recipient.key().as_ref(),
        &recipient_list.load()?.head.to_le_bytes()],
        bump = bump, payer = owner,
    )]
    pub new_position: AccountLoader<'info, Position>,
    #[account(mut,
        seeds = [b"positionv1",
        owner.key().as_ref(),
        &index.to_le_bytes()],
        bump = removed_position.load()?.bump,
    )]
    pub removed_position: AccountLoader<'info, Position>,
    #[account(mut,
        close = owner,
        seeds = [b"positionv1",
        owner.key().as_ref(),
        &(owner_list.load()?.head - 1).to_le_bytes()],
        bump = last_position.load()?.bump
    )]
    pub last_position: AccountLoader<'info, Position>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub recipient: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

impl<'info> TransferPositionOwnership<'info> {
    pub fn handler(self: &Self, bump: u8, index: u32) -> ProgramResult {
        msg!("INVARIANT: TRANSFER POSITION");

        let mut owner_list = self.owner_list.load_mut()?;
        let mut recipient_list = self.recipient_list.load_mut()?;
        let new_position = &mut self.new_position.load_init()?;
        let removed_position = &mut self.removed_position.load_mut()?;

        owner_list.head -= 1;
        recipient_list.head += 1;

        // reassign all fields in new_position
        {
            **new_position = Position {
                owner: *self.recipient.key,
                pool: *self.recipient.key,
                id: removed_position.id,
                liquidity: removed_position.liquidity,
                lower_tick_index: removed_position.lower_tick_index,
                upper_tick_index: removed_position.upper_tick_index,
                fee_growth_inside_x: removed_position.fee_growth_inside_x,
                fee_growth_inside_y: removed_position.fee_growth_inside_y,
                seconds_per_liquidity_inside: removed_position.seconds_per_liquidity_inside,
                tokens_owed_x: removed_position.tokens_owed_x,
                tokens_owed_y: removed_position.tokens_owed_y,
                last_slot: removed_position.last_slot,
                bump, // assign new bump
            };
        }

        // when removed position is not the last one
        if owner_list.head != index {
            let last_position = self.last_position.load_mut()?;

            **removed_position = Position {
                owner: last_position.owner,
                pool: last_position.pool,
                id: last_position.id,
                liquidity: last_position.liquidity,
                lower_tick_index: last_position.lower_tick_index,
                upper_tick_index: last_position.upper_tick_index,
                fee_growth_inside_x: last_position.fee_growth_inside_x,
                fee_growth_inside_y: last_position.fee_growth_inside_y,
                seconds_per_liquidity_inside: last_position.seconds_per_liquidity_inside,
                tokens_owed_x: last_position.tokens_owed_x,
                tokens_owed_y: last_position.tokens_owed_y,
                last_slot: last_position.last_slot,
                bump: removed_position.bump, // stay with the same bump
            };
        }

        Ok(())
    }
}
