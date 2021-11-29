use crate::structs::position_list::PositionList;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreatePositionList<'info> {
    #[account(init,
        seeds = [b"positionlistv1", owner.to_account_info().key.as_ref()],
        bump = bump,
        payer = owner
    )]
    pub position_list: Loader<'info, PositionList>,
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
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
