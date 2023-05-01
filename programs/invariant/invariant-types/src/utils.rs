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

macro_rules! get_location {
    () => {{
        format!("{}:{}:{}", file!(), function!(), line!())
    }};
}

macro_rules! error {
    ($error:expr) => {{
        print_error(&get_location!(), $error)
    }};
}

macro_rules! propagate {
    ($error:expr) => {{
        propagate_error(&get_location!(), $error)
    }};
    () => {};
}

pub fn print_error(loc: &str, error: &str) -> String {
    format!(
        "ERROR CAUSED BY: {}\nINVARIANT STACK TRACE:\n-> {}",
        error, loc
    )
}

pub fn propagate_error(loc: &str, deeper: String) -> String {
    format!("{} \n-> {}", deeper, loc)
}
