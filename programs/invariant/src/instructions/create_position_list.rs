use crate::structs::position_list::PositionList;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
pub struct CreatePositionList<'info> {
    #[account(init,
        seeds = [b"positionlistv1", owner.key().as_ref()],
        bump,
        payer = signer
    )]
    pub position_list: AccountLoader<'info, PositionList>,
    pub owner: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CreatePositionList>) -> ProgramResult {
    msg!("INVARIANT: CREATE POSITION LIST");
    let mut position_list = ctx.accounts.position_list.load_init()?;
    let bump = *ctx.bumps.get("position_list").unwrap();
    *position_list = PositionList { head: 0, bump };

    Ok(())
}
