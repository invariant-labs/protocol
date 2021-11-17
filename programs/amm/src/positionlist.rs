use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct PositionList {
    pub head: u32,
    pub bump: u8,
}

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
