use crate::decimals::*;
use crate::structs::fee_tier::FeeTier;
use crate::ErrorCode::{self, *};
use crate::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

#[derive(Accounts)]
#[instruction(fee: u128, tick_spacing: u16)]
pub struct CreateFeeTier<'info> {
    #[account(init,
        seeds = [b"feetierv1", __program_id.as_ref(), &fee.to_le_bytes(), &tick_spacing.to_le_bytes()],
        bump, payer = admin, space = FeeTier::LEN
    )]
    pub fee_tier: AccountLoader<'info, FeeTier>,
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump)]
    pub state: AccountLoader<'info, State>,
    #[account(mut, constraint = &state.load()?.admin == admin.key @ InvalidAdmin)]
    pub admin: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = system_program::ID)]
    /// CHECK: Ignore
    pub system_program: AccountInfo<'info>,
}

impl<'info> CreateFeeTier<'info> {
    pub fn handler(&self, fee: u128, tick_spacing: u16, bump: u8) -> Result<()> {
        msg!("INVARIANT: CREATE FEE TIER");

        require!(tick_spacing > 0, ErrorCode::InvalidTickSpacing);
        let fee_tier = &mut self.fee_tier.load_init()?;
        let fee = FixedPoint::new(fee);

        **fee_tier = FeeTier {
            fee,
            tick_spacing,
            bump,
        };

        Ok(())
    }
}
