pub mod referral {
    use anchor_lang::prelude::Pubkey;

    pub fn contains(ref_owner: Pubkey) -> bool {
        // #[cfg(feature = "jupiter")]
        // {
        //     println!("jupiter");
        //     let p_key_one = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej");
        //     let example_one = p_key_one.unwrap();
        //     let p_key_two = Pubkey::from_str(&"JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo");
        //     let example_two = p_key_two.unwrap();

        //     if ref_owner.eq(&example_two.unwrap()) {
        //         return true;
        //     } else if ref_owner.eq(&example_one.unwrap()) {
        //         return true;
        //     } else {
        //         return false;
        //     }
        // }

        #[cfg(feature = "none")]
        {
            println!("none");
            return false;
        }

        #[cfg(feature = "all")]
        {
            println!("all");
            return true;
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use std::{borrow::Borrow, str::FromStr};

    use anchor_lang::prelude::Pubkey;

    use super::referral::contains;

    #[test]
    #[cfg_attr(feature = "all", feature(all))]
    fn test_is_referral_for_all() {
        let example = contains(Pubkey::default());
        assert!(example);
    }

    #[test]
    #[cfg_attr(feature = "none", feature(none))]
    fn test_is_referral_for_none() {
        let p_key = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej");
        let example = contains(p_key.unwrap());

        assert!(!example);
    }

    #[test]
    #[cfg_attr(feature = "jupiter", feature(jupiter))]
    fn test_is_referral_for_jupiter() {
        let p_key = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej");
        let example = contains(p_key.unwrap());
        assert!(!example);
        let pub_key = Pubkey::from_str(&"JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo");
        let example = contains(pub_key.unwrap());
        assert!(example);
    }
}
