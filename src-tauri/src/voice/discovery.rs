//! Discover external Python without binding installations to a user.
use std::path::{Path, PathBuf};

pub fn python_runtime() -> Result<PathBuf, String> {
    if let Some(value) = std::env::var_os("FRIDAY_PYTHON") {
        let path = PathBuf::from(value);
        return if path.is_file() { Ok(path) } else { Err("FRIDAY_PYTHON does not point to an installed Python executable".into()) };
    }
    let mut candidates = vec![Path::new(env!("CARGO_MANIFEST_DIR")).join("../.venv/Scripts/python.exe")];
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        if let Ok(entries) = std::fs::read_dir(PathBuf::from(local).join("Programs/Python")) {
            let mut installed: Vec<_> = entries.filter_map(Result::ok).map(|entry|entry.path().join("python.exe")).collect();
            installed.sort(); candidates.extend(installed);
        }
    }
    if let Some(paths) = std::env::var_os("PATH") {
        for path in std::env::split_paths(&paths) {
            if path.file_name().is_some_and(|name|name.to_string_lossy().eq_ignore_ascii_case("WindowsApps")) { continue; }
            candidates.push(path.join(if cfg!(windows) {"python.exe"} else {"python3"}));
        }
    }
    candidates.into_iter().find(|path|path.is_file()).ok_or_else(||"Python speech runtime was not found. Set FRIDAY_PYTHON to Python with needle, sounddevice and numpy installed.".into())
}

pub fn speech_script(resource_dir: Option<PathBuf>) -> Result<PathBuf, String> {
    if let Some(value) = std::env::var_os("FRIDAY_STT_SCRIPT") {
        let path = PathBuf::from(value);
        return if path.is_file() { Ok(path) } else { Err("FRIDAY_STT_SCRIPT does not point to stt_daemon.py".into()) };
    }
    let mut candidates = vec![];
    if let Some(root) = resource_dir { candidates.push(root.join("core/stt_daemon.py")); candidates.push(root.join("_up_/core/stt_daemon.py")); }
    if cfg!(debug_assertions) { candidates.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/stt_daemon.py")); }
    candidates.into_iter().find(|path|path.is_file()).ok_or_else(||"Speech adapter resource is missing. Repair the installation or configure FRIDAY_STT_SCRIPT.".into())
}
