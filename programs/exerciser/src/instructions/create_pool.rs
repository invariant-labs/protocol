use crate::structs::*;
use crate::ErrorCode::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct CreatePool<'info> {
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
}

// pub trait DepositToken<'info> {
//     fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>>;
// }

// impl<'info> DepositToken<'info> for CreateIncentive<'info> {
//     fn deposit(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         CpiContext::new(
//             self.token_program.to_account_info(),
//             Transfer {
//                 from: self.founder_token_account.to_account_info(),
//                 to: self.incentive_token_account.to_account_info(),
//                 authority: self.founder.to_account_info().clone(),
//             },
//         )
//     }
// }

pub fn handler(ctx: Context<CreatePool>) -> ProgramResult {
    msg!("CREATE POOL");

    Ok(())
}
