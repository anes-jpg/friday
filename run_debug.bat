@echo off
set RUST_BACKTRACE=1
set RUST_LOG=debug
src-tauri\target\debug\friday.exe > crash.log 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> crash.log
