use crate::decimal::Decimal;
use crate::state::fee_tier::FeeTier;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(bump: u8, fee: u64, tick_spacing: u16)]
pub struct CreateFeeTier<'info> {
    #[account(init,
        seeds = [b"feetierv1", program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()],
        bump = bump, payer = payer
    )]
    pub fee_tier: Loader<'info, FeeTier>,
    #[account(mut, signer)]
    pub payer: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<CreateFeeTier>,
    bump: u8,
    fee: u64,
    tick_spacing: u16,
) -> ProgramResult {
    msg!("INVARIANT: CREATE FEE TIER");

    let fee_tier = &mut ctx.accounts.fee_tier.load_init()?;
    let fee = Decimal::new(fee.into());

    **fee_tier = FeeTier {
        fee,
        tick_spacing,
        bump,
    };

    Ok(())
}
