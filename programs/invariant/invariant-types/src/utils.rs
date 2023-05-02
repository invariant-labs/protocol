pub type TrackableResult<T> = Result<T, String>;

#[macro_use]
pub mod trackable_result {

    #[macro_export]
    macro_rules! err_msg {
        ($error:expr) => {{
            format!(
                "ERROR CAUSED BY: {}\nINVARIANT STACK TRACE:\n-> {}",
                $error,
                &location!()
            )
        }};
    }

    #[macro_export]
    macro_rules! ok_or_mark_trace {
        ($op:expr) => {
            match $op {
                Ok(ok) => Ok(ok),
                Err(err) => Err(trace!(err)),
            }
        };
    }

    #[macro_export]
    macro_rules! function {
        () => {{
            fn f() {}
            fn type_name_of<T>(_: T) -> &'static str {
                std::any::type_name::<T>()
            }
            let name = type_name_of(f);
            &name[..name.len() - 3]
        }};
    }

    #[macro_export]
    macro_rules! location {
        () => {{
            format!("{}:{}:{}", file!(), function!(), line!())
        }};
    }

    #[macro_export]
    macro_rules! trace {
        ($deeper:expr) => {{
            format!("{} \n-> {}", $deeper, &location!())
        }};
        () => {};
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn value() -> TrackableResult<u64> {
        Ok(10u64)
    }

    fn inner_fun() -> TrackableResult<u64> {
        ok_or_mark_trace!(value())
    }

    fn outer_fun() -> TrackableResult<u64> {
        ok_or_mark_trace!(inner_fun())
    }

    fn trigger_error() -> TrackableResult<u64> {
        let _ = outer_fun().or_else(|err| Err(err_msg!(err.as_str())))?;
        Err(err_msg!("trigger error"))
    }

    fn inner_fun_err() -> TrackableResult<u64> {
        ok_or_mark_trace!(trigger_error())
    }

    fn outer_fun_err() -> TrackableResult<u64> {
        ok_or_mark_trace!(inner_fun_err())
    }

    #[test]
    fn test_trackable_result_type_flow() {
        // ok
        {
            let value = outer_fun().unwrap();
            assert_eq!(value, 10u64);
        }
        // error
        {
            let err = outer_fun_err();
            assert!(err.is_err());
            println!("{}", err.unwrap_err());
        }
    }
}
