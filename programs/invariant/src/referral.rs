pub mod whitelist {
    use anchor_lang::prelude::Pubkey;
    #[cfg(feature = "jupiter")]
    use std::str::FromStr;

    #[allow(unreachable_code)]
    pub fn contains_owner(_ref_owner: Pubkey) -> bool {
        #[cfg(feature = "jupiter")]
        {
            let jup2 = Pubkey::from_str(&"BUX7s2ef2htTGb2KKoPHWkmzxPj4nTWMWRgs5CSbQxf9").unwrap();
            return jup2 == _ref_owner;
        }

        #[cfg(feature = "all")]
        return true;

        #[cfg(feature = "none")]
        return false;
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use anchor_lang::prelude::Pubkey;

    use super::whitelist::contains_owner;

    #[test]
    #[cfg_attr(not(feature = "all"), ignore)]
    fn test_is_referral_for_all() {
        let is_contains = contains_owner(Pubkey::default());
        assert!(is_contains);
    }

    #[test]
    #[cfg_attr(any(feature = "jupiter", feature = "all"), ignore)]
    fn test_is_referral_for_none() {
        let pubkey = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej").unwrap();
        assert!(!contains_owner(pubkey));
        let jup2 = Pubkey::from_str(&"BUX7s2ef2htTGb2KKoPHWkmzxPj4nTWMWRgs5CSbQxf9").unwrap();
        assert!(!contains_owner(jup2));
    }

    #[test]
    #[cfg_attr(not(feature = "jupiter"), ignore)]
    fn test_is_referral_for_jupiter() {
        let pubkey = Pubkey::from_str(&"7CKCpJWFRu1WAWfCvDkwyniP6JGpSyMf4Bkxk2U6v2Ej").unwrap();
        assert!(!contains_owner(pubkey));
        let jup2 = Pubkey::from_str(&"BUX7s2ef2htTGb2KKoPHWkmzxPj4nTWMWRgs5CSbQxf9").unwrap();
        assert!(contains_owner(jup2));
    }
}
