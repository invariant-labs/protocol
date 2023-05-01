pub type TrackableResult<T> = Result<T, String>;

#[macro_export]
macro_rules! error {
    ($error:expr) => {{
        Err(format_error(&location!(), $error))
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

macro_rules! location {
    () => {{
        format!("{}:{}:{}", file!(), function!(), line!())
    }};
}

macro_rules! trace {
    ($error:expr) => {{
        format_trace(&location!(), $error)
    }};
    () => {};
}

fn format_error(loc: &str, error: &str) -> String {
    format!(
        "ERROR CAUSED BY: {}\nINVARIANT STACK TRACE:\n-> {}",
        error, loc
    )
}

fn format_trace(loc: &str, deeper: String) -> String {
    format!("{} \n-> {}", deeper, loc)
}

#[cfg(test)]
mod tests {

    use super::*;

    fn trigger_error() -> TrackableResult<u64> {
        error!("trigger error")
    }

    fn inner_fun_err() -> TrackableResult<u64> {
        ok_or_mark_trace!(trigger_error())
    }

    fn outer_fun_err() -> TrackableResult<u64> {
        ok_or_mark_trace!(inner_fun_err())
    }

    #[test]
    fn test_fun() {
        let err = outer_fun_err().unwrap_err();
        println!("{}", err);
    }
}
