mod errors;
mod instructions;
mod structs;
mod util;

use anchor_lang::prelude::*;
use errors::*;
use instructions::*;

declare_id!("3nQy5Qmg52C5KPfigHs4xvwXWUV9mmGUuUuMxWyvL8EK");

#[program]
pub mod staker {

    use super::*;

    pub fn create_pool(ctx: Context<CreatePool>, amount_in: u64, ratio: u64) -> ProgramResult {
        ctx.accounts.handler(amount_in, ratio)
    }

    pub fn redeem(ctx: Context<Redeem>, _index: i32, nonce: u8) -> ProgramResult {
        instructions::redeem::handler(ctx, _index, nonce)
    }
}
