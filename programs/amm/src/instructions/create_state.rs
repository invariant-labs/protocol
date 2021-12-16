use crate::structs::state::State;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
#[instruction(bump: u8, nonce: u8)]
pub struct CreateState<'info> {
    #[account(init, seeds = [b"statev1".as_ref()], bump = bump, payer = admin)]
    pub state: AccountLoader<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [b"Invariant".as_ref()], bump = nonce)]
    pub program_authority: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CreateState>, bump: u8, nonce: u8) -> ProgramResult {
    msg!("INVARIANT: CREATE STATE");

    let state = &mut ctx.accounts.state.load_init()?;
    **state = State {
        admin: *ctx.accounts.admin.key,
        authority: *ctx.accounts.program_authority.key,
        nonce,
        bump,
    };
    Ok(())
}
