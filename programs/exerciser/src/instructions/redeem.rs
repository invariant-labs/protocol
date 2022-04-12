use crate::structs::*;
use crate::util::*;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(index: u32, nonce: u8)]
pub struct Redeem<'info> {
    #[account(seeds = [b"exerciser".as_ref()], bump = nonce)]
    pub authority: AccountInfo<'info>,
    pub owner: AccountInfo<'info>,
    #[account(address = token::ID)]
    pub token_program: AccountInfo<'info>,
}

// impl<'info> Redeem<'info> {
//     fn withdraw(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         CpiContext::new(
//             self.token_program.to_account_info(),
//             Transfer {
//                 from: self.incentive_token_account.to_account_info(),
//                 to: self.owner_token_account.to_account_info(),
//                 authority: self.staker_authority.to_account_info().clone(),
//             },
//         )
//     }
// }

pub fn handler(ctx: Context<Redeem>, _index: i32, nonce: u8) -> ProgramResult {
    msg!("REDEEM");

    Ok(())
}
