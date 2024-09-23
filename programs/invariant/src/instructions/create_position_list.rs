use crate::structs::position_list::PositionList;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreatePositionList<'info> {
    #[account(init,
        seeds = [b"positionlistv1", owner.key().as_ref()],
        bump,
        payer = signer,
        space = PositionList::LEN
    )]
    pub position_list: AccountLoader<'info, PositionList>,
    /// CHECK: Ignore
    pub owner: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreatePositionList<'info> {
    pub fn handler(&self, bump: u8) -> Result<()> {
        msg!("INVARIANT: CREATE POSITION LIST");
        let mut position_list = self.position_list.load_init()?;
        *position_list = PositionList { head: 0, bump };

        Ok(())
    }
}
