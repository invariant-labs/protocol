use std::io::Write;

use anchor_lang::{
    __private::{ErrorCode, CLOSED_ACCOUNT_DISCRIMINATOR},
    prelude::*,
};
use std::convert::TryInto;

use anchor_lang::prelude::*;

pub const STAKER_SEED: &str = "staker";

pub fn check_position_seeds<'info>(
    owner: AccountInfo<'info>,
    position: &Pubkey,
    index: u32,
) -> bool {
    &Pubkey::find_program_address(
        &[b"positionv1", owner.key.as_ref(), &index.to_le_bytes()],
        &amm::program::Amm::id(),
    )
    .0 == position
}

pub fn close<'info>(
    info: AccountInfo<'info>,
    sol_destination: AccountInfo<'info>,
) -> ProgramResult {
    let dest_starting_lamports = sol_destination.lamports();
    **sol_destination.lamports.borrow_mut() =
        dest_starting_lamports.checked_add(info.lamports()).unwrap();
    **info.lamports.borrow_mut() = 0;

    let mut data = info.try_borrow_mut_data()?;
    let dst: &mut [u8] = &mut data;
    // let mut cursor = std::io::Cursor::new(dst);
    // cursor
    //     .write_all(&CLOSED_ACCOUNT_DISCRIMINATOR)
    //     .map_err(|_| ErrorCode::AccountDidNotSerialize)?;

    Ok(())
}

pub fn get_current_timestamp() -> u64 {
    Clock::get().unwrap().unix_timestamp.try_into().unwrap()
}

pub fn get_current_slot() -> u64 {
    Clock::get().unwrap().slot
}
