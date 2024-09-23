#[macro_export]
macro_rules! get_signer {
    ($nonce: expr) => {
        &[&[SEED.as_bytes(), &[$nonce]]]
    };
}

#[macro_export]
macro_rules! account_size {
    ($name: ident) => {
        impl $name {
            pub const LEN: usize = $name::INIT_SPACE + 8;
        }
    };
}
