pub mod referral {
    use anchor_lang::prelude::Pubkey;
    #[cfg(feature = "jupiter")]
    use std::str::FromStr;

    pub fn contains(_ref_owner: Pubkey) -> bool {
        #[cfg(feature = "jupiter")]
        {
            let jup3 = Pubkey::from_str(&"JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph").unwrap();
            let jup2 = Pubkey::from_str(&"JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo").unwrap();
            if _ref_owner.eq(&jup3) || _ref_owner.eq(&jup2) {
                return true;
            }
        }

        #[cfg(feature = "all")]
        return true;

        #[cfg(not(feature = "all"))]
        return false;
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use anchor_lang::prelude::Pubkey;

    use super::referral::contains;

    #[test]
    #[cfg_attr(not(feature = "all"), ignore)]
    fn test_is_referral_for_all() {
        let is_contains = contains(Pubkey::default());
        assert!(is_contains);
    }

    #[test]
    #[cfg_attr(any(feature = "jupiter", feature = "all"), ignore)]
    fn test_is_referral_for_none() {
        let pubkey = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej").unwrap();
        assert!(!contains(pubkey));
        let jup2 = Pubkey::from_str(&"JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo").unwrap();
        assert!(!contains(jup2));
    }

    #[test]
    #[cfg_attr(not(feature = "jupiter"), ignore)]
    fn test_is_referral_for_jupiter() {
        let pubkey = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej").unwrap();
        assert!(!contains(pubkey));
        let jup2 = Pubkey::from_str(&"JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo").unwrap();
        assert!(contains(jup2));
    }
}
