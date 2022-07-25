pub mod referral {
    use anchor_lang::prelude::Pubkey;

    pub fn contains(ref_owner: Pubkey) {
        println!("TEST IS REFERRAL");
    }
}

#[cfg(test)]
mod tests {
    use anchor_lang::prelude::Pubkey;

    use super::referral::contains;

    #[test]
    fn test_is_referral() {
        contains(Pubkey::default());
    }
}
