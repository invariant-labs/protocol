use crate::decimals::*;
use crate::structs::{Pool, State};
use crate::ErrorCode::{self, *};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

#[derive(Accounts)]
pub struct ChangeProtocolFee<'info> {
    #[account(seeds = [b"statev1".as_ref()], bump = state.load()?.bump )]
    pub state: AccountLoader<'info, State>,
    #[account(mut,
        seeds = [b"poolv1", token_x.to_account_info().key.as_ref(), token_y.to_account_info().key.as_ref(), &pool.load()?.fee.v.to_le_bytes(), &pool.load()?.tick_spacing.to_le_bytes()],
        bump = pool.load()?.bump
    )]
    pub pool: AccountLoader<'info, Pool>,
    #[account(constraint = token_x.to_account_info().key == &pool.load()?.token_x @ InvalidTokenAccount) ]
    pub token_x: InterfaceAccount<'info, Mint>,
    #[account(constraint = token_y.to_account_info().key == &pool.load()?.token_y @ InvalidTokenAccount)]
    pub token_y: InterfaceAccount<'info, Mint>,
    #[account(constraint = &state.load()?.admin == admin.key @ InvalidAdmin)]
    pub admin: Signer<'info>,
    #[account(constraint = &state.load()?.authority == program_authority.key @ InvalidAuthority)]
    /// CHECK: Ignore
    pub program_authority: AccountInfo<'info>,
}

impl<'info> ChangeProtocolFee<'info> {
    pub fn handler(&self, protocol_fee: FixedPoint) -> Result<()> {
        require!(
            protocol_fee <= FixedPoint::from_integer(1),
            ErrorCode::InvalidProtocolFee
        );
        let pool = &mut self.pool.load_mut()?;
        pool.protocol_fee = protocol_fee;

        Ok(())
    }
}
