use crate::decimal::Decimal;
use crate::structs::fee_tier::FeeTier;
use crate::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
#[instruction(bump: u8, fee: u128, tick_spacing: u16)]
pub struct CreateFeeTier<'info> {
    #[account(init,
        seeds = [b"feetierv1", program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()],
        bump = bump, payer = admin
    )]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut, constraint = &state.load()?.admin == admin.key)]
    pub admin: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<CreateFeeTier>,
    bump: u8,
    fee: u128,
    tick_spacing: u16,
) -> ProgramResult {
    msg!("INVARIANT: CREATE FEE TIER");

    let fee_tier = &mut ctx.accounts.fee_tier.load_init()?;
    let fee = Decimal::new(fee);

    **fee_tier = FeeTier {
        fee,
        tick_spacing,
        bump,
    };

    Ok(())
}
