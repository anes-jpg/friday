// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {}", info);
        let _ = std::fs::write("friday_panic.log", &msg);
        eprintln!("{}", msg);
    }));

    friday_lib::run();
}
