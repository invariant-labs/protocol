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
    #[msg("Tick index not divisible by spacing or over limit")]
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
    InvalidPositionLiquidity = 11, // 137
    #[msg("Invalid pool liquidity")]
    InvalidPoolLiquidity = 12, // 138
    #[msg("Invalid position index")]
    InvalidPositionIndex = 13, // 139
    #[msg("Position liquidity would be zero")]
    PositionWithoutLiquidity = 14, // 13a
    #[msg("You are not admin")]
    Unauthorized = 15, // 13b
    #[msg("Invalid pool token addresses")]
    InvalidPoolTokenAddresses = 16, // 13c
    #[msg("Time cannot be negative")]
    NegativeTime = 17, // 13d
    #[msg("Oracle is already initialized")]
    OracleAlreadyInitialized = 18, // 13e
    #[msg("Absolute price limit was reached")]
    LimitReached = 19, // 13f
}
