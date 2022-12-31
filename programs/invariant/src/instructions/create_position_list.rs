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
    /// CHECK: safe as possible to create PositionList to anyone
    pub owner: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    /// CHECK: safe as constant
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

impl<'info> CreatePositionList<'info> {
    pub fn handler(&self, bump: u8) -> ProgramResult {
        msg!("INVARIANT: CREATE POSITION LIST");
        let mut position_list = self.position_list.load_init()?;
        *position_list = PositionList { head: 0, bump };

        Ok(())
    }
}
