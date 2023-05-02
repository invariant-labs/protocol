pub mod decimals;
pub mod errors;
pub mod log;
pub mod macros;
pub mod math;
pub mod structs;
pub mod utils;

use anchor_lang::prelude::*;

declare_id!("HyaB3W9q6XdA5xwpU4XnSZV94htfmbmqJXZcEbRaJutt");
pub const SEED: &str = "Invariant";
pub const STATE_SEED: &str = "statev1";
pub const TICK_SEED: &str = "tickv1";
pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
pub const MAX_VIRTUAL_CROSS: u16 = 10;
