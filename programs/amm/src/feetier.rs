use crate::decimal::Decimal;
use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(PartialEq, Default, Debug)]
pub struct FeeTier {
    pub fee: Decimal,
    pub tick_spacing: u16,
    pub bump: u8,
}

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
