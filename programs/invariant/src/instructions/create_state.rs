use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use invariant_core::structs::State;

#[derive(Accounts)]
#[instruction( nonce: u8)]
pub struct CreateState<'info> {
    #[account(init, seeds = [b"statev1".as_ref()], bump, space = State::LEN, payer = admin)]
    pub state: AccountLoader<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: safe as seed checked
    #[account(seeds = [b"Invariant".as_ref()], bump = nonce)]
    pub program_authority: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    /// CHECK: safe as constant
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<CreateState>, nonce: u8) -> Result<()> {
    msg!("INVARIANT: CREATE STATE");

    let state = &mut ctx.accounts.state.load_init()?;
    **state = State {
        admin: *ctx.accounts.admin.key,
        authority: *ctx.accounts.program_authority.key,
        nonce,
        bump: *ctx.bumps.get("state").unwrap(),
    };
    Ok(())
}
