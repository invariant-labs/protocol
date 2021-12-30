use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

use crate::structs::Tickmap;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreateTickmap<'info> {
    #[account(init,
        seeds = [b"tickmapv1".as_ref()],
        bump = bump, payer = payer
    )]
    pub tickmap: AccountLoader<'info, Tickmap>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CreateTickmap>, bump: u8) -> ProgramResult {
    let tickmap = &mut ctx.accounts.tickmap.load_init().unwrap();

    **tickmap = Tickmap {
        bitmap: [0; 25000],
        bump,
    };

    Ok(())
}
