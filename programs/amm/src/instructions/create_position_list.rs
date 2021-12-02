use crate::structs::position_list::PositionList;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreatePositionList<'info> {
    #[account(init,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = bump,
        payer = owner
    )]
    pub position_list: AccountLoader<'info, PositionList>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CreatePositionList>, bump: u8) -> ProgramResult {
    msg!("CREATE POSITION LIST");
    let mut position_list = ctx.accounts.position_list.load_init()?;

    *position_list = PositionList {
        head: 0,
        bump: bump,
    };

    Ok(())
}
