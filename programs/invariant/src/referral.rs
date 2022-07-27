pub mod referral {
    use anchor_lang::prelude::Pubkey;
    use std::{borrow::Borrow, str::FromStr};
    pub fn contains(ref_owner: Pubkey) -> bool {
        #[cfg(feature = "jupiter")]
        {
            let jup3 = Pubkey::from_str(&"JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph").unwrap();
            let jup2 = Pubkey::from_str(&"JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo").unwrap();
            if ref_owner.eq(&jup3) || ref_owner.eq(&jup2) {
                return true;
            } else {
                return false;
            }
        }

        #[cfg(feature = "all")]
        return true;

        #[cfg(feature = "none")]
        return false;

        false
    }
}

#[cfg(test)]
mod tests {
    use std::{borrow::Borrow, str::FromStr};

    use anchor_lang::prelude::Pubkey;

    use super::referral::contains;

    #[test]
    #[cfg_attr(not(feature = "all"), ignore)]
    fn test_is_referral_for_all() {
        let example = contains(Pubkey::default());
        assert!(example);
    }

    #[test]
    #[cfg_attr(any(feature = "jupiter", feature = "all"), ignore)]
    fn test_is_referral_for_none() {
        let example = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej").unwrap();
        assert!(!contains(example));
    }

    #[test]
    #[cfg_attr(not(feature = "jupiter"), ignore)]
    fn test_is_referral_for_jupiter() {
        let example = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej").unwrap();
        let example = contains(example);
        assert!(!example);
        let jup2 = Pubkey::from_str(&"JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo").unwrap();
        assert!(contains(jup2));
    }
}
