use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Amount is zero")]
    ZeroAmount = 0, // 12c
    #[msg("Output would be zero")]
    ZeroOutput = 1, // 12d
    #[msg("Not the expected tick")]
    WrongTick = 2, // 12e
    #[msg("Price limit is on the wrong side of price")]
    WrongLimit = 3, // 12f
    #[msg("Tick index not divisible by spacing")]
    InvalidTickIndex = 4, // 130
    #[msg("Invalid tick_lower or tick_upper")]
    InvalidTickInterval = 5, // 131
    #[msg("There is no more tick in that direction")]
    NoMoreTicks = 6, // 132
    #[msg("Correct tick not found in context")]
    TickNotFound = 7, // 133
    #[msg("Price would cross swap limit")]
    PriceLimitReached = 8, // 134
    #[msg("Invalid tick liquidity")]
    InvalidTickLiquidity = 9, // 135
    #[msg("Disable empty position pokes")]
    EmptyPositionPokes = 10, // 136
    #[msg("Invalid tick liquidity")]
    InvalidPositionLiquidity = 11, // 135
    #[msg("Invalid pool liquidity")]
    InvalidPoolLiquidity = 12, // 136
    #[msg("Invalid position index")]
    InvalidPositionIndex = 13, // 137
    #[msg("Position liquidity would be zero")]
    PositionWithoutLiquidity = 14, // 138
}
