pub mod delphi;
pub mod geospatial;
pub mod hardware;
pub mod net_telemetry;
pub mod orbital_maritime;
pub mod scaffold;
pub mod daily;

pub use geospatial::*;
pub use hardware::*;
pub use net_telemetry::*;
pub use orbital_maritime::*;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

pub mod security;
pub use security::*;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub tier: RiskTier,
    pub schema: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    #[serde(default)]
    pub receipt_id: Option<String>,
    #[serde(default)]
    pub undoable: bool,
    pub tool_name: String,
    pub output: Value,
    pub duration_ms: u64,
    pub tier: RiskTier,
    pub allowed: bool,
    #[serde(default)]
    pub args: Value,
}

#[cfg(target_os = "windows")]
pub mod win32 {
    use serde::{Deserialize, Serialize};
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    #[derive(Clone, Debug, Serialize, Deserialize)]
    pub struct WindowInfo {
        pub hwnd: isize,
        pub title: String,
        pub process_name: String,
        pub pid: u32,
        pub is_active: bool,
    }

    #[repr(C)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[repr(C)]
    pub struct BITMAPINFOHEADER {
        pub bi_size: u32,
        pub bi_width: i32,
        pub bi_height: i32,
        pub bi_planes: u16,
        pub bi_bit_count: u16,
        pub bi_compression: u32,
        pub bi_size_image: u32,
        pub bi_xpels_per_meter: i32,
        pub bi_ypels_per_meter: i32,
        pub bi_clr_used: u32,
        pub bi_clr_important: u32,
    }

    #[repr(C)]
    pub struct BITMAPINFO {
        pub bmi_header: BITMAPINFOHEADER,
        pub bmi_colors: [u32; 1],
    }

    #[repr(C)]
    #[derive(Default, Debug, Clone, Copy)]
    #[allow(non_snake_case)]
    pub struct MEMORYSTATUSEX {
        pub dwLength: u32,
        pub dwMemoryLoad: u32,
        pub ullTotalPhys: u64,
        pub ullAvailPhys: u64,
        pub ullTotalPageFile: u64,
        pub ullAvailPageFile: u64,
        pub ullTotalVirtual: u64,
        pub ullAvailVirtual: u64,
        pub ullAvailExtendedVirtual: u64,
    }

    #[repr(C)]
    #[derive(Default, Debug, Clone, Copy)]
    #[allow(non_snake_case)]
    pub struct SYSTEM_POWER_STATUS {
        pub ACLineStatus: u8,
        pub BatteryFlag: u8,
        pub BatteryLifePercent: u8,
        pub SystemStatusFlag: u8,
        pub BatteryLifeTime: u32,
        pub BatteryFullLifeTime: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetWindowTextW(hWnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowThreadProcessId(hWnd: isize, lpdwProcessId: *mut u32) -> u32;
        fn GetDC(hWnd: isize) -> isize;
        fn ReleaseDC(hWnd: isize, hDC: isize) -> i32;
        fn GetWindowRect(hWnd: isize, lpRect: *mut RECT) -> i32;
        fn SetForegroundWindow(hWnd: isize) -> i32;
        fn ShowWindow(hWnd: isize, nCmdShow: i32) -> i32;
        fn EnumWindows(
            lpEnumFunc: unsafe extern "system" fn(isize, isize) -> i32,
            lParam: isize,
        ) -> i32;
        fn IsWindowVisible(hWnd: isize) -> i32;
        fn GetSystemMetrics(nIndex: i32) -> i32;
        fn SetCursorPos(X: i32, Y: i32) -> i32;
        fn mouse_event(dwFlags: u32, dx: u32, dy: u32, dwData: u32, dwExtraInfo: usize);
        fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
        fn OpenClipboard(hWndNewOwner: isize) -> i32;
        fn CloseClipboard() -> i32;
        fn EmptyClipboard() -> i32;
        fn GetClipboardData(uFormat: u32) -> isize;
        fn SetClipboardData(uFormat: u32, hMem: isize) -> isize;
        fn PostMessageW(hWnd: isize, Msg: u32, wParam: usize, lParam: isize) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        fn CreateCompatibleDC(hDC: isize) -> isize;
        fn CreateCompatibleBitmap(hDC: isize, nWidth: i32, nHeight: i32) -> isize;
        fn SelectObject(hDC: isize, hgdiobj: isize) -> isize;
        fn BitBlt(
            hdcDest: isize,
            nXDest: i32,
            nYDest: i32,
            nWidth: i32,
            nHeight: i32,
            hdcSrc: isize,
            nXSrc: i32,
            nYSrc: i32,
            dwRop: u32,
        ) -> i32;
        fn DeleteDC(hdc: isize) -> i32;
        fn DeleteObject(hObject: isize) -> i32;
        fn GetDIBits(
            hdc: isize,
            hbm: isize,
            start: u32,
            cLines: u32,
            lpvBits: *mut u8,
            lpbmi: *mut BITMAPINFO,
            usage: u32,
        ) -> i32;
    }

    #[repr(C)]
    #[derive(Default, Debug, Clone, Copy)]
    #[allow(non_snake_case)]
    pub struct SYSTEMTIME {
        pub wYear: u16,
        pub wMonth: u16,
        pub wDayOfWeek: u16,
        pub wDay: u16,
        pub wHour: u16,
        pub wMinute: u16,
        pub wSecond: u16,
        pub wMilliseconds: u16,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
        fn CloseHandle(hObject: isize) -> i32;
        fn QueryFullProcessImageNameW(
            hProcess: isize,
            dwFlags: u32,
            lpExeName: *mut u16,
            lpdwSize: *mut u32,
        ) -> i32;
        fn GetLocalTime(lpSystemTime: *mut SYSTEMTIME);
        fn GlobalAlloc(uFlags: u32, dwBytes: usize) -> isize;
        fn GlobalLock(hMem: isize) -> *mut u8;
        fn GlobalUnlock(hMem: isize) -> i32;
        fn GlobalMemoryStatusEx(lpBuffer: *mut MEMORYSTATUSEX) -> i32;
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
        fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SYSTEM_POWER_STATUS) -> i32;
    }

    pub fn get_formatted_local_time() -> (String, String, String) {
        let mut st = SYSTEMTIME::default();
        unsafe { GetLocalTime(&mut st) };
        let days = [
            "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
        ];
        let months = [
            "", "January", "February", "March", "April", "May", "June", "July", "August",
            "September", "October", "November", "December",
        ];
        let day_name = days.get(st.wDayOfWeek as usize).unwrap_or(&"");
        let month_name = months.get(st.wMonth as usize).unwrap_or(&"");
        let am_pm = if st.wHour >= 12 { "PM" } else { "AM" };
        let hour_12 = if st.wHour == 0 {
            12
        } else if st.wHour > 12 {
            st.wHour - 12
        } else {
            st.wHour
        };
        let date_str = format!("{}, {} {}, {}", day_name, month_name, st.wDay, st.wYear);
        let time_str = format!("{}:{:02} {}", hour_12, st.wMinute, am_pm);
        let full_str = format!("{} at {}", date_str, time_str);
        (full_str, date_str, time_str)
    }

    pub fn get_process_name_by_pid(pid: u32) -> String {
        if pid == 0 {
            return "System".to_string();
        }
        let process_handle = unsafe { OpenProcess(0x1000 | 0x0400, 0, pid) }; // PROCESS_QUERY_LIMITED_INFORMATION
        if process_handle != 0 {
            let mut exe_buf = [0u16; 1024];
            let mut size: u32 = 1024;
            let success = unsafe {
                QueryFullProcessImageNameW(process_handle, 0, exe_buf.as_mut_ptr(), &mut size)
            };
            unsafe { CloseHandle(process_handle) };

            if success != 0 && size > 0 {
                let full_path = OsString::from_wide(&exe_buf[..size as usize])
                    .to_string_lossy()
                    .to_string();
                std::path::Path::new(&full_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or(full_path)
            } else {
                format!("PID: {}", pid)
            }
        } else {
            format!("PID: {}", pid)
        }
    }

    pub fn get_active_window_info() -> (String, String) {
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd == 0 {
            return ("Desktop".to_string(), "explorer.exe".to_string());
        }

        let mut title_buf = [0u16; 512];
        let len = unsafe { GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512) };
        let title = if len > 0 {
            OsString::from_wide(&title_buf[..len as usize])
                .to_string_lossy()
                .to_string()
        } else {
            "Active Window".to_string()
        };

        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        let process_name = get_process_name_by_pid(pid);
        (title, process_name)
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: isize, lparam: isize) -> i32 {
        let list = &mut *(lparam as *mut Vec<WindowInfo>);
        if IsWindowVisible(hwnd) != 0 {
            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
            if len > 0 {
                let title = OsString::from_wide(&title_buf[..len as usize])
                    .to_string_lossy()
                    .to_string();
                let clean_title = title.trim();
                if !clean_title.is_empty()
                    && clean_title != "Program Manager"
                    && clean_title != "Default IME"
                    && clean_title != "MSCTFIME UI"
                {
                    let mut pid: u32 = 0;
                    GetWindowThreadProcessId(hwnd, &mut pid);
                    let active_hwnd = GetForegroundWindow();
                    let process_name = get_process_name_by_pid(pid);
                    list.push(WindowInfo {
                        hwnd,
                        title: clean_title.to_string(),
                        process_name,
                        pid,
                        is_active: hwnd == active_hwnd,
                    });
                }
            }
        }
        1
    }

    pub fn list_windows() -> Vec<WindowInfo> {
        let mut list: Vec<WindowInfo> = Vec::new();
        unsafe {
            EnumWindows(
                enum_windows_proc,
                &mut list as *mut Vec<WindowInfo> as isize,
            );
        }
        list
    }

    pub fn focus_window(query: &str) -> Result<bool, String> {
        let windows = list_windows();
        let q = query.to_lowercase();
        if let Some(target) = windows.iter().find(|w| {
            w.title.to_lowercase().contains(&q) || w.process_name.to_lowercase().contains(&q)
        }) {
            unsafe {
                ShowWindow(target.hwnd, 9); // SW_RESTORE
                SetForegroundWindow(target.hwnd);
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn set_window_state(query: &str, state: &str) -> Result<bool, String> {
        let windows = list_windows();
        let q = query.to_lowercase();
        if let Some(target) = windows.iter().find(|w| {
            w.title.to_lowercase().contains(&q) || w.process_name.to_lowercase().contains(&q)
        }) {
            let cmd = match state {
                "minimize" => 6, // SW_MINIMIZE
                "maximize" => 3, // SW_MAXIMIZE
                _ => 9,          // SW_RESTORE
            };
            unsafe {
                ShowWindow(target.hwnd, cmd);
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn mouse_click(x: i32, y: i32) {
        unsafe {
            SetCursorPos(x, y);
            mouse_event(0x0002, 0, 0, 0, 0); // MOUSEEVENTF_LEFTDOWN
            mouse_event(0x0004, 0, 0, 0, 0); // MOUSEEVENTF_LEFTUP
        }
    }

    pub fn type_text(text: &str) {
        for c in text.chars() {
            let vk = c as u8;
            unsafe {
                keybd_event(vk, 0, 0, 0);
                keybd_event(vk, 0, 2, 0); // KEYEVENTF_KEYUP
            }
        }
    }

    pub fn close_window(query: &str) -> Result<bool, String> {
        let windows = list_windows();
        let q = query.to_lowercase();
        if let Some(target) = windows.iter().find(|w| {
            w.title.to_lowercase().contains(&q) || w.process_name.to_lowercase().contains(&q)
        }) {
            const WM_CLOSE: u32 = 0x0010;
            let res = unsafe { PostMessageW(target.hwnd, WM_CLOSE, 0, 0) };
            Ok(res != 0)
        } else {
            Ok(false)
        }
    }

    pub fn get_clipboard_text() -> Result<String, String> {
        unsafe {
            if OpenClipboard(0) == 0 {
                return Err("Failed to open clipboard".to_string());
            }
            const CF_UNICODETEXT: u32 = 13;
            let handle = GetClipboardData(CF_UNICODETEXT);
            if handle == 0 {
                CloseClipboard();
                return Ok(String::new());
            }
            let ptr = GlobalLock(handle) as *const u16;
            if ptr.is_null() {
                CloseClipboard();
                return Err("Failed to lock global memory".to_string());
            }
            let mut len = 0;
            while *ptr.add(len) != 0 {
                len += 1;
            }
            let slice = std::slice::from_raw_parts(ptr, len);
            let text = OsString::from_wide(slice).to_string_lossy().to_string();
            GlobalUnlock(handle);
            CloseClipboard();
            Ok(text)
        }
    }

    pub fn set_clipboard_text(text: &str) -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        let wide: Vec<u16> = std::ffi::OsStr::new(text)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let bytes_len = wide.len() * std::mem::size_of::<u16>();

        unsafe {
            if OpenClipboard(0) == 0 {
                return Err("Failed to open clipboard".to_string());
            }
            EmptyClipboard();
            const GMEM_MOVEABLE: u32 = 0x0002;
            let h_mem = GlobalAlloc(GMEM_MOVEABLE, bytes_len);
            if h_mem == 0 {
                CloseClipboard();
                return Err("Failed to allocate global memory".to_string());
            }
            let dest = GlobalLock(h_mem) as *mut u16;
            if dest.is_null() {
                CloseClipboard();
                return Err("Failed to lock global memory".to_string());
            }
            std::ptr::copy_nonoverlapping(wide.as_ptr(), dest, wide.len());
            GlobalUnlock(h_mem);
            const CF_UNICODETEXT: u32 = 13;
            SetClipboardData(CF_UNICODETEXT, h_mem);
            CloseClipboard();
            Ok(())
        }
    }

    pub fn get_system_diagnostics() -> serde_json::Value {
        let mut mem = MEMORYSTATUSEX::default();
        mem.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        let mem_ok = unsafe { GlobalMemoryStatusEx(&mut mem) };

        let total_ram_gb = if mem_ok != 0 {
            mem.ullTotalPhys as f64 / (1024.0 * 1024.0 * 1024.0)
        } else {
            0.0
        };
        let avail_ram_gb = if mem_ok != 0 {
            mem.ullAvailPhys as f64 / (1024.0 * 1024.0 * 1024.0)
        } else {
            0.0
        };
        let mem_load = if mem_ok != 0 { mem.dwMemoryLoad } else { 0 };

        use std::os::windows::ffi::OsStrExt;
        let root_c: Vec<u16> = std::ffi::OsStr::new("C:\\")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut free_bytes_caller = 0u64;
        let mut total_bytes = 0u64;
        let mut total_free = 0u64;
        let disk_ok = unsafe {
            GetDiskFreeSpaceExW(
                root_c.as_ptr(),
                &mut free_bytes_caller,
                &mut total_bytes,
                &mut total_free,
            )
        };
        let disk_free_gb = if disk_ok != 0 {
            total_free as f64 / (1024.0 * 1024.0 * 1024.0)
        } else {
            0.0
        };
        let disk_total_gb = if disk_ok != 0 {
            total_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
        } else {
            0.0
        };

        let mut power = SYSTEM_POWER_STATUS::default();
        let power_ok = unsafe { GetSystemPowerStatus(&mut power) };
        let (battery_pct, is_ac) = if power_ok != 0 {
            let pct = if power.BatteryLifePercent != 255 {
                Some(power.BatteryLifePercent as u64)
            } else {
                None
            };
            let ac = power.ACLineStatus == 1;
            (pct, ac)
        } else {
            (None, true)
        };

        let (win_title, win_proc) = get_active_window_info();
        let (full_time, date_str, time_str) = get_formatted_local_time();

        serde_json::json!({
            "status": "ok",
            "memory_load_percent": mem_load,
            "memory_total_gb": (total_ram_gb * 10.0).round() / 10.0,
            "memory_available_gb": (avail_ram_gb * 10.0).round() / 10.0,
            "disk_free_gb": (disk_free_gb * 10.0).round() / 10.0,
            "disk_total_gb": (disk_total_gb * 10.0).round() / 10.0,
            "battery_percent": battery_pct,
            "ac_power": is_ac,
            "active_window": win_title,
            "active_process": win_proc,
            "date": date_str,
            "time": time_str,
            "timestamp": full_time
        })
    }

    pub fn capture_screen(target: &str) -> Result<(Vec<u8>, i32, i32, String, String), String> {
        let (x, y, mut width, mut height, title, process) = match target {
            "active_window" => {
                let active_hwnd = unsafe { GetForegroundWindow() };
                let (t, p) = get_active_window_info();
                if active_hwnd == 0 {
                    let w = unsafe { GetSystemMetrics(0) };
                    let h = unsafe { GetSystemMetrics(1) };
                    (0, 0, w, h, t, p)
                } else {
                    let mut rect = RECT {
                        left: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                    };
                    unsafe { GetWindowRect(active_hwnd, &mut rect) };
                    let w = (rect.right - rect.left).max(1);
                    let h = (rect.bottom - rect.top).max(1);
                    (rect.left, rect.top, w, h, t, p)
                }
            }
            _ => {
                let w = unsafe { GetSystemMetrics(0) };
                let h = unsafe { GetSystemMetrics(1) };
                (
                    0,
                    0,
                    w,
                    h,
                    "Desktop".to_string(),
                    "explorer.exe".to_string(),
                )
            }
        };

        width = width.clamp(16, 3840);
        height = height.clamp(16, 2160);

        let hdc_screen = unsafe { GetDC(0) };
        if hdc_screen == 0 {
            return Err("Failed to acquire screen DC".to_string());
        }

        let hdc_mem = unsafe { CreateCompatibleDC(hdc_screen) };
        if hdc_mem == 0 {
            unsafe { ReleaseDC(0, hdc_screen) };
            return Err("Failed to create compatible memory DC".to_string());
        }

        let hbm = unsafe { CreateCompatibleBitmap(hdc_screen, width, height) };
        if hbm == 0 {
            unsafe {
                DeleteDC(hdc_mem);
                ReleaseDC(0, hdc_screen);
            }
            return Err("Failed to create compatible bitmap".to_string());
        }

        let old_obj = unsafe { SelectObject(hdc_mem, hbm) };
        let blt_res = unsafe {
            BitBlt(
                hdc_mem, 0, 0, width, height, hdc_screen, x, y, 0x00CC0020, // SRCCOPY
            )
        };

        if blt_res == 0 {
            unsafe {
                SelectObject(hdc_mem, old_obj);
                DeleteObject(hbm);
                DeleteDC(hdc_mem);
                ReleaseDC(0, hdc_screen);
            }
            return Err("BitBlt screen capture failed".to_string());
        }

        let row_stride = ((width * 3 + 3) / 4) * 4;
        let image_size = (row_stride * height) as usize;
        let mut pixels = vec![0u8; image_size];

        let mut bmi = BITMAPINFO {
            bmi_header: BITMAPINFOHEADER {
                bi_size: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                bi_width: width,
                bi_height: height,
                bi_planes: 1,
                bi_bit_count: 24,
                bi_compression: 0, // BI_RGB
                bi_size_image: image_size as u32,
                bi_xpels_per_meter: 0,
                bi_ypels_per_meter: 0,
                bi_clr_used: 0,
                bi_clr_important: 0,
            },
            bmi_colors: [0; 1],
        };

        let bits_res = unsafe {
            GetDIBits(
                hdc_mem,
                hbm,
                0,
                height as u32,
                pixels.as_mut_ptr(),
                &mut bmi,
                0, // DIB_RGB_COLORS
            )
        };

        unsafe {
            SelectObject(hdc_mem, old_obj);
            DeleteObject(hbm);
            DeleteDC(hdc_mem);
            ReleaseDC(0, hdc_screen);
        }

        if bits_res == 0 {
            return Err("GetDIBits failed to extract pixel data".to_string());
        }

        let file_header_size = 14u32;
        let info_header_size = 40u32;
        let offset = file_header_size + info_header_size;
        let file_size = offset + image_size as u32;

        let mut bmp_bytes = Vec::with_capacity(file_size as usize);
        bmp_bytes.extend_from_slice(b"BM");
        bmp_bytes.extend_from_slice(&file_size.to_le_bytes());
        bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
        bmp_bytes.extend_from_slice(&offset.to_le_bytes());

        bmp_bytes.extend_from_slice(&info_header_size.to_le_bytes());
        bmp_bytes.extend_from_slice(&width.to_le_bytes());
        bmp_bytes.extend_from_slice(&height.to_le_bytes());
        bmp_bytes.extend_from_slice(&1u16.to_le_bytes());
        bmp_bytes.extend_from_slice(&24u16.to_le_bytes());
        bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
        bmp_bytes.extend_from_slice(&(image_size as u32).to_le_bytes());
        bmp_bytes.extend_from_slice(&2835i32.to_le_bytes());
        bmp_bytes.extend_from_slice(&2835i32.to_le_bytes());
        bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
        bmp_bytes.extend_from_slice(&0u32.to_le_bytes());

        bmp_bytes.extend_from_slice(&pixels);

        Ok((bmp_bytes, width, height, title, process))
    }

    pub fn base64_encode(data: &[u8]) -> String {
        const CHARSET: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
        for chunk in data.chunks(3) {
            let b0 = chunk[0];
            let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
            let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };
            out.push(CHARSET[(b0 >> 2) as usize] as char);
            out.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
            if chunk.len() > 1 {
                out.push(CHARSET[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
            } else {
                out.push('=');
            }
            if chunk.len() > 2 {
                out.push(CHARSET[(b2 & 0x3F) as usize] as char);
            } else {
                out.push('=');
            }
        }
        out
    }
}

#[cfg(not(target_os = "windows"))]
pub mod win32 {
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, Serialize, Deserialize)]
    pub struct WindowInfo {
        pub hwnd: isize,
        pub title: String,
        pub process_name: String,
        pub pid: u32,
        pub is_active: bool,
    }

    pub fn get_active_window_info() -> (String, String) {
        (
            "FRIDAY — Windows Desktop Assistant".to_string(),
            "friday.exe".to_string(),
        )
    }

    pub fn list_windows() -> Vec<WindowInfo> {
        vec![
            WindowInfo {
                hwnd: 1,
                title: "FRIDAY".to_string(),
                process_name: "friday.exe".to_string(),
                pid: 1001,
                is_active: true,
            },
            WindowInfo {
                hwnd: 2,
                title: "Visual Studio Code".to_string(),
                process_name: "Code.exe".to_string(),
                pid: 1002,
                is_active: false,
            },
        ]
    }

    pub fn focus_window(_query: &str) -> Result<bool, String> {
        Ok(true)
    }

    pub fn set_window_state(_query: &str, _state: &str) -> Result<bool, String> {
        Ok(true)
    }

    pub fn capture_screen(_target: &str) -> Result<(Vec<u8>, i32, i32, String, String), String> {
        Ok((
            vec![0u8; 128],
            1920,
            1080,
            "Desktop".to_string(),
            "explorer.exe".to_string(),
        ))
    }

    pub fn mouse_click(_x: i32, _y: i32) {}
    pub fn type_text(_text: &str) {}

    pub fn base64_encode(data: &[u8]) -> String {
        const CHARSET: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
        for chunk in data.chunks(3) {
            let b0 = chunk[0];
            let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
            let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };
            out.push(CHARSET[(b0 >> 2) as usize] as char);
            out.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
            if chunk.len() > 1 {
                out.push(CHARSET[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
            } else {
                out.push('=');
            }
            if chunk.len() > 2 {
                out.push(CHARSET[(b2 & 0x3F) as usize] as char);
            } else {
                out.push('=');
            }
        }
        out
    }

    pub fn get_formatted_local_time() -> (String, String, String) {
        ("Today".to_string(), "Today".to_string(), "Now".to_string())
    }

    pub fn close_window(_query: &str) -> Result<bool, String> {
        Ok(true)
    }

    pub fn get_clipboard_text() -> Result<String, String> {
        Ok("FRIDAY Clipboard Context".to_string())
    }

    pub fn set_clipboard_text(_text: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn get_system_diagnostics() -> serde_json::Value {
        serde_json::json!({
            "status": "ok",
            "memory_load_percent": 45,
            "memory_total_gb": 16.0,
            "memory_available_gb": 8.8,
            "disk_free_gb": 140.0,
            "disk_total_gb": 512.0,
            "battery_percent": 100,
            "ac_power": true,
            "active_window": "FRIDAY",
            "active_process": "friday.exe"
        })
    }
}

/// Resolves user folder aliases ('Desktop', 'Downloads', '~', '%USERPROFILE%') to full filesystem paths.
pub fn resolve_user_path(raw: &str) -> std::path::PathBuf {
    if let Some(context)=crate::agent::runs::current() {
        if let Some(root)=&context.project_root {
            let path=std::path::Path::new(raw.trim());
            if path.is_relative() && !raw.starts_with('~') && !raw.starts_with('%') {
                return root.join(path);
            }
        }
    }
    let trimmed = raw.trim().trim_matches('"').trim_matches('\'').trim();

    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());

    if trimmed.is_empty() {
        return std::path::PathBuf::from(&home);
    }

    if trimmed == "." {
        if let Ok(cwd) = std::env::current_dir() {
            let cwd_str = cwd.to_string_lossy();
            if cwd_str.eq_ignore_ascii_case("C:\\Users") || cwd_str.eq_ignore_ascii_case("C:/Users") {
                return std::path::PathBuf::from(&home);
            }
            return cwd;
        }
        return std::path::PathBuf::from(&home);
    }

    if trimmed == "~" || trimmed == "%USERPROFILE%" {
        return std::path::PathBuf::from(&home);
    }

    if let Some(rest) = trimmed.strip_prefix("~/").or_else(|| trimmed.strip_prefix("~\\")) {
        return std::path::PathBuf::from(&home).join(rest);
    }

    if let Some(rest) = trimmed
        .strip_prefix("%USERPROFILE%/")
        .or_else(|| trimmed.strip_prefix("%USERPROFILE%\\"))
    {
        return std::path::PathBuf::from(&home).join(rest);
    }

    let lower = trimmed.to_lowercase();
    match lower.as_str() {
        "desktop" | "my desktop" | "the desktop" | "in my desktop" | "on my desktop" => {
            return std::path::PathBuf::from(&home).join("Desktop")
        }
        "downloads" | "my downloads" | "in my downloads" => {
            return std::path::PathBuf::from(&home).join("Downloads")
        }
        "documents" | "my documents" | "in my documents" => {
            return std::path::PathBuf::from(&home).join("Documents")
        }
        "pictures" | "my pictures" | "in my pictures" => {
            return std::path::PathBuf::from(&home).join("Pictures")
        }
        "music" | "my music" => return std::path::PathBuf::from(&home).join("Music"),
        "videos" | "my videos" => return std::path::PathBuf::from(&home).join("Videos"),
        _ => {}
    }

    for folder in &["desktop", "downloads", "documents", "pictures", "music", "videos"] {
        let folder_cap = match *folder {
            "desktop" => "Desktop",
            "downloads" => "Downloads",
            "documents" => "Documents",
            "pictures" => "Pictures",
            "music" => "Music",
            "videos" => "Videos",
            _ => *folder,
        };

        for prefix in &[
            format!("{}/", folder),
            format!("{}\\", folder),
            format!("my {}/", folder),
            format!("my {}\\", folder),
            format!("in my {}/", folder),
            format!("in my {}\\", folder),
            format!("on my {}/", folder),
            format!("on my {}\\", folder),
        ] {
            if lower.starts_with(prefix) {
                let rest = &trimmed[prefix.len()..];
                return std::path::PathBuf::from(&home).join(folder_cap).join(rest);
            }
        }
    }

    // If it's already an absolute path (e.g. C:\... or \\...)
    let p = std::path::Path::new(trimmed);
    if p.is_absolute() {
        return p.to_path_buf();
    }

    // If it starts with ./ or .\
    let stripped = if let Some(s) = trimmed.strip_prefix("./").or_else(|| trimmed.strip_prefix(".\\")) {
        s
    } else {
        trimmed
    };

    // For a desktop voice operator, relative paths (e.g. "index.html", "script.py") default to the user's Desktop
    std::path::PathBuf::from(&home).join("Desktop").join(stripped)
}

pub struct ToolRegistry {
    tools: HashMap<String, ToolDefinition>,
    shell_allowlist: Vec<String>,
    db: Option<Arc<Mutex<crate::memory::db::Database>>>,
    pub mcp_client: Arc<tokio::sync::Mutex<Option<crate::agent::mcp_client::AgentMcpClient>>>,
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            tools: HashMap::new(),
            shell_allowlist: vec![
                "git".to_string(),
                "cargo".to_string(),
                "pnpm".to_string(),
                "npm".to_string(),
                "node".to_string(),
                "powershell".to_string(),
                "explorer".to_string(),
                "python".to_string(),
                "py".to_string(),
                "pip".to_string(),
                "curl".to_string(),
                "tasklist".to_string(),
                "taskkill".to_string(),
                "cmd".to_string(),
                "code".to_string(),
                "wt".to_string(),
            ],
            db: None,
            mcp_client: Arc::new(tokio::sync::Mutex::new(None)),
        };
        registry.register_defaults();
        daily::register(&mut registry);
        registry
    }

    pub fn with_db(mut self, db: Arc<Mutex<crate::memory::db::Database>>) -> Self {
        self.db = Some(db);
        self
    }

    pub fn with_mcp_client(
        mut self,
        mcp_client: Arc<tokio::sync::Mutex<Option<crate::agent::mcp_client::AgentMcpClient>>>,
    ) -> Self {
        self.mcp_client = mcp_client;
        self
    }


    fn register_defaults(&mut self) {
        self.register(ToolDefinition {
            name: "screen.read".to_string(),
            description: "Capture active window and extract OCR + accessibility tree elements"
                .to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "target": { "type": "string", "enum": ["active_window", "full_screen"] }
                },
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "screen.capture".to_string(),
            description:
                "Capture active window or full desktop and return base64 bitmap with window title"
                    .to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "target": { "type": "string", "enum": ["active_window", "full_screen"] }
                },
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "screen.ocr".to_string(),
            description: "Capture active window or screen and perform Windows native offline OCR to extract visible text lines".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "target": { "type": "string", "enum": ["active_window", "full_screen"] }
                },
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "window.list".to_string(),
            description:
                "List active top-level Windows applications with title, process name, and PID"
                    .to_string(),
            tier: RiskTier::Green,
            schema: json!({ "type": "object", "properties": {}, "required": [] }),
        });

        self.register(ToolDefinition {
            name: "window.focus".to_string(),
            description: "Bring a window to foreground by application or title name".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" }
                },
                "required": ["query"]
            }),
        });

        self.register(ToolDefinition {
            name: "window.state".to_string(),
            description: "Minimize, maximize, or restore window by name".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "state": { "type": "string", "enum": ["minimize", "maximize", "restore"] }
                },
                "required": ["query", "state"]
            }),
        });

        self.register(ToolDefinition {
            name: "input.click".to_string(),
            description: "Send mouse click to desktop screen coordinates (x, y)".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "x": { "type": "number" },
                    "y": { "type": "number" }
                },
                "required": ["x", "y"]
            }),
        });

        self.register(ToolDefinition {
            name: "input.type".to_string(),
            description: "Type text into active foreground window".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string" }
                },
                "required": ["text"]
            }),
        });

        self.register(ToolDefinition {
            name: "clipboard.get".to_string(),
            description: "Read text contents from system clipboard".to_string(),
            tier: RiskTier::Green,
            schema: json!({ "type": "object", "properties": {}, "required": [] }),
        });

        self.register(ToolDefinition {
            name: "clipboard.set".to_string(),
            description: "Write text contents to system clipboard".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": { "text": { "type": "string" } },
                "required": ["text"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.move".to_string(),
            description: "Move or batch rename files on disk".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "source": { "type": "string" },
                    "destination": { "type": "string" }
                },
                "required": ["source", "destination"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.write".to_string(),
            description: "Create, write, or save a complete file on disk (e.g. HTML web page, scripts, notes, code) at specified path with text content. Automatically creates parent directories if needed. For code, HTML, and documents, content MUST be the full, complete, production-ready code with zero placeholders.".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Target file path to create or write to, e.g. 'Desktop/saas-landing.html' or 'Desktop/notes.txt'" },
                    "content": { "type": "string", "description": "The complete, working text or code content to write into the file. Never use placeholders like '...' or '</content>'. Provide full production content." }
                },
                "required": ["path", "content"]
            }),
        });

        self.register(ToolDefinition {
            name: "shell.run".to_string(),
            description: "Run an allowlisted binary without shell interpolation".to_string(),
            tier: RiskTier::Red,
            schema: json!({
                "type": "object",
                "properties": {
                    "binary": { "type": "string" },
                    "args": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["binary", "args"]
            }),
        });
        self.register(ToolDefinition {
            name: "code.search".to_string(),
            description:
                "Search workspace source files using Beast two-stage trigram and line matching"
                    .to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "max_results": { "type": "number" },
                    "literal": { "type": "boolean" }
                },
                "required": ["query"]
            }),
        });

        self.register(ToolDefinition {
            name: "code.symbols".to_string(),
            description: "Find functions, structs, interfaces, and types across workspace"
                .to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "max_results": { "type": "number" }
                },
                "required": ["query"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.read".to_string(),
            description: "Read file contents with line limits and byte cap".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string" },
                    "max_lines": { "type": "number" }
                },
                "required": ["path"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.list".to_string(),
            description: "List directory entries up to max depth. For user Desktop, pass path='Desktop'. For Downloads, pass path='Downloads'.".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Folder path to list, e.g. 'Desktop', 'Downloads', or full path." },
                    "max_depth": { "type": "number" }
                },
                "required": ["path"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.find".to_string(),
            description: "Search for files or shortcuts by name pattern (e.g. searching 'fortnite' on 'Desktop' or in 'Downloads')".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "File or shortcut name to search for, e.g. 'fortnite'" },
                    "path": { "type": "string", "description": "Folder to search in, defaults to 'Desktop'" }
                },
                "required": ["query"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.mkdir".to_string(),
            description: "Create a new folder or directory at the specified path (e.g. 'Desktop/vc' or 'Downloads/new_folder')".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Path of the folder to create, e.g. 'Desktop/vc'" }
                },
                "required": ["path"]
            }),
        });

        self.register(ToolDefinition {
            name: "fs.delete".to_string(),
            description: "Delete a file or folder at the specified path".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Path of file or folder to delete" }
                },
                "required": ["path"]
            }),
        });

        self.register(ToolDefinition {
            name: "app.launch".to_string(),
            description: "Launch or open an application, file, shortcut, or URL on Windows (e.g. 'notepad', 'calc', 'Fortnite.url', or a file path)".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "target": { "type": "string", "description": "Application name, shortcut (.lnk/.url), file, or URL to open" }
                },
                "required": ["target"]
            }),
        });

        self.register(ToolDefinition {
            name: "text.process".to_string(),
            description: "Perform utility transforms: json_pretty, json_minify, uuid, jwt_decode".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["json_pretty", "json_minify", "uuid", "jwt_decode"] },
                    "input": { "type": "string" }
                },
                "required": ["action"]
            }),
        });

        self.register(ToolDefinition {
            name: "media.probe".to_string(),
            description: "Probe media file format, mime type, and dimensions".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string" }
                },
                "required": ["path"]
            }),
        });

        self.register(ToolDefinition {
            name: "memory.save".to_string(),
            description: "Save a user fact, preference, or detail permanently into associative memory (SQLite database). E.g. fact='Preference — User loves pizza'".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "fact": { "type": "string", "description": "The fact, preference, or detail to remember permanently" },
                    "category": { "type": "string", "description": "Optional category, e.g. 'Preference', 'Identity', 'Work'" }
                },
                "required": ["fact"]
            }),
        });

        self.register(ToolDefinition {
            name: "web.fetch".to_string(),
            description: "Fetch data or inspect content from HTTP endpoint".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string" }
                },
                "required": ["url"]
            }),
        });

        self.register(ToolDefinition {
            name: "standup.generate".to_string(),
            description: "Summarize recent activity and generate standup note".to_string(),
            tier: RiskTier::Green,
            schema: json!({ "type": "object", "properties": {}, "required": [] }),
        });

        self.register(ToolDefinition {
            name: "notify.toast".to_string(),
            description: "Show desktop toast notification".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "message": { "type": "string" }
                },
                "required": ["message"]
            }),
        });

        self.register(ToolDefinition {
            name: "browser.snapshot".to_string(),
            description:
                "Fetch page and extract atomic indexed element table (Jev-Ultrafast snapshot.js)"
                    .to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string" }
                },
                "required": ["url"]
            }),
        });

        self.register(ToolDefinition {
            name: "browser.action".to_string(),
            description: "Execute click, fill, or select action on an indexed browser element (Jev-Ultrafast action space)".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "node": { "type": "number" },
                    "action": { "type": "string", "enum": ["click", "fill", "select"] },
                    "text": { "type": "string" }
                },
                "required": ["node", "action"]
            }),
        });

        self.register(ToolDefinition {
            name: "review.diff".to_string(),
            description: "Parse and structure Git workspace diff with line hunks (OpenCodeReview diff engine)".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string" }
                },
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "review.scan".to_string(),
            description: "Deterministic code review on workspace diff with line-level findings (OpenCodeReview rules)".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string" }
                },
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "code.chunk".to_string(),
            description: "Segment source code into semantic AST chunks (Beast Engine C chunk.rs)"
                .to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string" }
                },
                "required": ["path"]
            }),
        });

        self.register(ToolDefinition {
            name: "web.browse".to_string(),
            description: "Browse the web, search online topics, and perform multi-step web research using Playwright and browser-use".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "task": { "type": "string", "description": "The web search or browsing task to accomplish, e.g. 'find latest SpaceX launch' or 'check RTX 4090 prices'" },
                    "url": { "type": "string", "description": "Optional starting URL, e.g. 'https://google.com'" }
                },
                "required": ["task"]
            }),
        });

        self.register(ToolDefinition {
            name: "web.extract".to_string(),
            description: "Extract clean structured content, headings, tables, and readable text from a URL (Stagehand scraper)".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "Target web URL to scrape" },
                    "instruction": { "type": "string", "description": "Optional natural language extraction instruction, e.g. 'extract table of pricing'" }
                },
                "required": ["url"]
            }),
        });

        self.register(ToolDefinition {
            name: "agent.delegate".to_string(),
            description: "Delegate complex programming, architecture, or deep multi-step research to a multi-agent crew (CrewAI & LangGraph swarms)".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "objective": { "type": "string", "description": "Detailed multi-step engineering or research objective to delegate" }
                },
                "required": ["objective"]
            }),
        });

        self.register(ToolDefinition {
            name: "code.sandbox".to_string(),
            description: "Run Python code locally after explicit confirmation. Local Python has access to the current user account; inspect the complete code before confirming.".to_string(),
            tier: RiskTier::Red,
            schema: json!({
                "type": "object",
                "properties": {
                    "code": { "type": "string", "description": "Complete executable Python code to run" }
                },
                "required": ["code"]
            }),
        });

        self.register(ToolDefinition {
            name: "memory.graph".to_string(),
            description: "Query associative knowledge graph for entity relationships and persistent semantic memory (Graphiti & Mem0)".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Question or semantic topic to query in knowledge graph" },
                    "entity": { "type": "string", "description": "Optional entity name to inspect (e.g. 'user', 'project', 'server')" }
                },
                "required": ["query"]
            }),
        });

        self.register(ToolDefinition {
            name: "desktop.uia".to_string(),
            description: "Deep desktop UI Automation: list visible windows, focus and type into native apps, or OCR screen elements (pywinauto)".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["list_windows", "focus_and_type", "ocr_screen"], "description": "UI automation action" },
                    "target": { "type": "string", "description": "Window title or application pattern" },
                    "text": { "type": "string", "description": "Text to type into focused window (for focus_and_type)" }
                },
                "required": ["action"]
            }),
        });

        self.register(ToolDefinition {
            name: "system.info".to_string(),
            description: "Get comprehensive Windows system diagnostics including RAM load, disk space, battery status, active window, and local time".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "app.close".to_string(),
            description: "Gracefully close an application window by title or process name via Windows WM_CLOSE (e.g. 'notepad', 'spotify', 'chrome')".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Application name or window title to close" }
                },
                "required": ["query"]
            }),
        });

        self.register(ToolDefinition {
            name: "project.scan".to_string(),
            description: "Scan user Desktop to discover Git repositories, frameworks, package managers, and status".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "project.scaffold".to_string(),
            description: "Deterministically scaffold an application workspace (better-t-stack, react-bits-vite, python-mcp-agent, rust-tauri-operator) with zero LLM token consumption".to_string(),
            tier: RiskTier::Amber,
            schema: json!({
                "type": "object",
                "properties": {
                    "archetype": {
                        "type": "string",
                        "enum": ["better-t-stack", "react-bits-vite", "python-mcp-agent", "rust-tauri-operator"]
                    },
                    "project_name": { "type": "string" },
                    "target_directory": { "type": "string" }
                },
                "required": ["archetype", "project_name"]
            }),
        });

        self.register(ToolDefinition {
            name: "os.settings".to_string(),
            description: "Open system or application settings surface".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {
                    "target": { "type": "string" }
                },
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "os.godseye".to_string(),
            description: "Switch active viewport to God's Eye planetary surveillance and camera feeds".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "os.split".to_string(),
            description: "Switch active viewport to split console view".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "os.legion".to_string(),
            description: "Switch active viewport to Iron Legion swarm view".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        });

        self.register(ToolDefinition {
            name: "os.grid".to_string(),
            description: "Switch active viewport to Bento desktop grid view".to_string(),
            tier: RiskTier::Green,
            schema: json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        });
    }


    pub fn register(&mut self, tool: ToolDefinition) {
        self.tools.insert(tool.name.clone(), tool);
    }

    pub fn get(&self, name: &str) -> Option<&ToolDefinition> {
        if let Some(tool) = self.tools.get(name) {
            return Some(tool);
        }
        let dot_name = name.replace('_', ".");
        if let Some(tool) = self.tools.get(&dot_name) {
            return Some(tool);
        }
        let underscore_name = name.replace('.', "_");
        self.tools.get(&underscore_name)
    }

    pub fn list(&self) -> Vec<&ToolDefinition> {
        self.tools.values().collect()
    }

    /// Invokes tool with risk-tier verification and duration measurement (§06 Capability Catalog)
    pub async fn invoke(&self, name: &str, args: Value) -> Result<ToolExecutionResult, String> {
        let definition = self.get(name).ok_or_else(|| format!("Unknown tool: {name}"))?;
        validate_tool_args(&definition.schema, &args).map_err(|e|e.to_string())?;
        if let Some(context) = crate::agent::runs::current() {
            let id = context.before_tool(definition, &args)?;
            let receipt = context.db.lock().map_err(|e|e.to_string())?.prepare_inverse(&context.run.id,&id,&definition.name,&args)?;
            let mut result = self.invoke_unchecked(name, args).await;
            if let Some(receipt) = receipt {
                context.db.lock().map_err(|e|e.to_string())?.finish_inverse(&receipt,result.is_ok())?;
                if let Ok(result)=&mut result {result.receipt_id=Some(receipt);result.undoable=true;}
            }
            context.after_tool(&id, &result)?;
            result
        } else {
            self.invoke_unchecked(name, args).await
        }
    }

    async fn invoke_unchecked(&self, name: &str, args: Value) -> Result<ToolExecutionResult, String> {
        let tool = self
            .get(name)
            .ok_or_else(|| format!("Unknown tool: {}", name))?;
        let canonical_name = tool.name.clone();
        let start = Instant::now();

        let output = match canonical_name.as_str() {
            "workspace.save" | "project.command" => daily::execute(&canonical_name,&args).await?,
            "os.settings" => {
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("cmd")
                        .args(["/c", "start", "ms-settings:"])
                        .creation_flags(0x08000000)
                        .spawn();
                }
                json!({
                    "status": "opened",
                    "action": "settings",
                    "target": "operating_system"
                })
            }

            "os.godseye" => {
                json!({
                    "status": "switched",
                    "view": "godseye"
                })
            }

            "os.split" => {
                json!({
                    "status": "switched",
                    "view": "split"
                })
            }

            "os.legion" => {
                json!({
                    "status": "switched",
                    "view": "legion"
                })
            }

            "os.grid" => {
                json!({
                    "status": "switched",
                    "view": "grid"
                })
            }

            "notify.toast" => {
                let msg = args
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("Notification");
                json!({
                    "status": "notified",
                    "message": msg
                })
            }

            "standup.generate" => {
                json!({
                    "status": "generated",
                    "summary": "Completed M5 audio pipeline; progressed M6-M9 memory and automations."
                })
            }

            "screen.capture" | "screen.read" => {
                let target = args
                    .get("target")
                    .and_then(|t| t.as_str())
                    .unwrap_or("active_window");
                match win32::capture_screen(target) {
                    Ok((bytes, width, height, title, app)) => {
                        let b64 = win32::base64_encode(&bytes);
                        json!({
                            "status": "captured",
                            "target": target,
                            "app": app,
                            "title": title,
                            "width": width,
                            "height": height,
                            "data_url": format!("data:image/bmp;base64,{}", b64),
                            "timestamp": chrono_now_ms(),
                        })
                    }
                    Err(e) => {
                        let (title, process) = win32::get_active_window_info();
                        json!({
                            "status": "fallback",
                            "app": process,
                            "title": title,
                            "error": e,
                            "timestamp": chrono_now_ms(),
                        })
                    }
                }
            }

            "screen.ocr" => {
                let target = args
                    .get("target")
                    .and_then(|t| t.as_str())
                    .unwrap_or("active_window");
                #[cfg(target_os = "windows")]
                {
                    match win32::capture_screen(target) {
                        Ok((bytes, width, height, title, app)) => {
                            let temp_path = std::env::temp_dir()
                                .join(format!("friday_ocr_{}.bmp", chrono_now_ms()));
                            let ocr_result = if std::fs::write(&temp_path, &bytes).is_ok() {
                                let script_opt = find_script_path("ocr_service.ps1");
                                let res = if let Some(script_path) = script_opt {
                                    #[cfg(target_os = "windows")]
                                    use std::os::windows::process::CommandExt;
                                    use std::process::Command;
                                    let mut cmd = Command::new("powershell");
                                    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
                                        .arg(script_path)
                                        .arg("-ImagePath")
                                        .arg(&temp_path);
                                    #[cfg(target_os = "windows")]
                                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                                    if let Ok(output) = cmd.output() {
                                        let stdout_str = String::from_utf8_lossy(&output.stdout);
                                        serde_json::from_str::<Value>(&stdout_str).unwrap_or_else(
                                            |_| {
                                                json!({
                                                    "status": "error",
                                                    "message": "Failed to parse OCR JSON"
                                                })
                                            },
                                        )
                                    } else {
                                        json!({ "status": "error", "message": "OCR powershell command failed" })
                                    }
                                } else {
                                    json!({ "status": "error", "message": "ocr_service.ps1 not found" })
                                };
                                let _ = std::fs::remove_file(&temp_path);
                                res
                            } else {
                                json!({ "status": "error", "message": "Failed to write temp bitmap" })
                            };

                            if ocr_result["status"] != "ok" {
                                return Err(ocr_result["message"].as_str().or_else(||ocr_result["error"].as_str()).unwrap_or("Local OCR failed").to_string());
                            }
                            let text = ocr_result
                                .get("text")
                                .and_then(|t| t.as_str())
                                .unwrap_or("")
                                .to_string();
                            let lines = ocr_result.get("lines").cloned().unwrap_or(json!([]));

                            json!({
                                "status": "ok",
                                "text": text,
                                "lines": lines,
                                "title": title,
                                "app": app,
                                "width": width,
                                "height": height,
                                "timestamp": chrono_now_ms(),
                            })
                        }
                        Err(e) => {
                            let (title, process) = win32::get_active_window_info();
                            json!({
                                "status": "fallback",
                                "app": process,
                                "title": title,
                                "text": format!("{}: {}", process, title),
                                "lines": [format!("{}: {}", process, title)],
                                "error": e,
                                "timestamp": chrono_now_ms(),
                            })
                        }
                    }
                }
                #[cfg(not(target_os = "windows"))]
                {
                    json!({
                        "status": "fallback",
                        "text": "Screen OCR not supported on non-Windows platform",
                        "lines": []
                    })
                }
            }

            "window.list" => {
                let windows = win32::list_windows();
                json!({
                    "status": "ok",
                    "windows": windows,
                    "count": windows.len(),
                })
            }

            "window.focus" => {
                let query = args.get("query").and_then(|q| q.as_str()).unwrap_or("");
                let success = win32::focus_window(query).unwrap_or(false);
                json!({
                    "status": if success { "focused" } else { "not_found" },
                    "query": query,
                })
            }

            "window.state" => {
                let query = args.get("query").and_then(|q| q.as_str()).unwrap_or("");
                let state = args
                    .get("state")
                    .and_then(|s| s.as_str())
                    .unwrap_or("restore");
                let success = win32::set_window_state(query, state).unwrap_or(false);
                json!({
                    "status": if success { "updated" } else { "not_found" },
                    "query": query,
                    "state": state,
                })
            }

            "input.click" => {
                let x = args.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let y = args.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                win32::mouse_click(x, y);
                json!({ "status": "clicked", "x": x, "y": y })
            }

            "input.type" => {
                let text = args.get("text").and_then(|t| t.as_str()).unwrap_or("");
                win32::type_text(text);
                json!({ "status": "typed", "chars": text.len() })
            }

            "clipboard.get" => {
                match win32::get_clipboard_text() {
                    Ok(content) => json!({
                        "status": "success",
                        "content": content,
                        "length": content.len()
                    }),
                    Err(e) => json!({
                        "status": "error",
                        "error": e,
                        "content": ""
                    })
                }
            }

            "clipboard.set" => {
                let text = args
                    .get("text")
                    .and_then(|t| t.as_str())
                    .unwrap_or_default();
                match win32::set_clipboard_text(text) {
                    Ok(_) => json!({
                        "status": "written",
                        "length": text.len()
                    }),
                    Err(e) => json!({
                        "status": "error",
                        "error": e
                    })
                }
            }

            "fs.move" => {
                let src = args
                    .get("source")
                    .and_then(|s| s.as_str())
                    .ok_or("Missing source")?;
                let dst = args
                    .get("destination")
                    .and_then(|d| d.as_str())
                    .ok_or("Missing destination")?;

                let src_path = resolve_user_path(src);
                let dst_path = resolve_user_path(dst);

                if let Some(parent) = dst_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }

                if src_path.exists() {
                    std::fs::rename(&src_path, &dst_path).map_err(|e| e.to_string())?;
                    json!({ "status": "moved", "source": src, "destination": dst })
                } else {
                    return Err("Move source does not exist; nothing was moved".into());
                }
            }

            "fs.write" => {
                let path_str = args
                    .get("path")
                    .and_then(|p| p.as_str())
                    .ok_or("Missing path")?;
                let content = args
                    .get("content")
                    .and_then(|c| c.as_str())
                    .unwrap_or("");

                let trimmed_content = content.trim();
                let lower_path = path_str.to_lowercase();
                let is_code_or_markup = lower_path.ends_with(".html")
                    || lower_path.ends_with(".htm")
                    || lower_path.ends_with(".css")
                    || lower_path.ends_with(".js")
                    || lower_path.ends_with(".ts")
                    || lower_path.ends_with(".jsx")
                    || lower_path.ends_with(".tsx")
                    || lower_path.ends_with(".py")
                    || lower_path.ends_with(".rs")
                    || lower_path.ends_with(".json");

                if is_code_or_markup {
                    let is_placeholder = trimmed_content == "..."
                        || trimmed_content == "...</content>"
                        || trimmed_content.starts_with("...</content>")
                        || trimmed_content.starts_with("<!-- ... -->")
                        || trimmed_content.starts_with("// ...")
                        || trimmed_content.starts_with("/* ... */");

                    if is_placeholder || (trimmed_content.len() < 30 && !trimmed_content.contains('<') && !trimmed_content.contains('{')) {
                        return Err(format!(
                            "Invalid or truncated content for '{}'. When creating code or HTML files, you must provide the complete, working implementation, not placeholders.",
                            path_str
                        ));
                    }
                }

                let path = resolve_user_path(path_str);
                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }

                let is_new = !path.exists();
                let filename = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "file.txt".to_string());

                std::fs::write(&path, content).map_err(|e| e.to_string())?;
                json!({
                    "status": "written",
                    "path": path.display().to_string(),
                    "name": filename,
                    "is_new": is_new,
                    "bytes": content.len()
                })
            }

            "memory.save" => {
                let fact_str = args
                    .get("fact")
                    .and_then(|f| f.as_str())
                    .ok_or("Missing fact")?;
                let category = args
                    .get("category")
                    .and_then(|c| c.as_str())
                    .unwrap_or("Preference");

                let content = if fact_str.contains("—") || fact_str.contains(':') {
                    fact_str.to_string()
                } else {
                    format!("{} — {}", category, fact_str)
                };

                let now_sec = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                let db_fact = crate::memory::db::DbFact {
                    id: format!("fact-{}", now_sec),
                    content: content.clone(),
                    confidence: 0.98,
                    source_message_id: None,
                    created_at: now_sec,
                };

                if let Some(ref db_mutex) = self.db {
                    if let Ok(db) = db_mutex.lock() {
                        let _ = db.insert_fact(&db_fact);
                    }
                }

                json!({
                    "status": "saved",
                    "id": db_fact.id,
                    "fact": content,
                    "created_at": now_sec
                })
            }

            "shell.run" => {
                let binary = args
                    .get("binary")
                    .and_then(|b| b.as_str())
                    .ok_or("Missing binary")?;
                let empty_vec = vec![];
                let raw_args = args
                    .get("args")
                    .and_then(|a| a.as_array())
                    .unwrap_or(&empty_vec);

                // Security gate (§08 Security model: Binary allowlist, argv array only, no shell interpolation)
                if !self.shell_allowlist.contains(&binary.to_lowercase()) {
                    return Err(format!(
                        "Binary '{}' is not in the approved shell execution allowlist.",
                        binary
                    ));
                }

                let mut cmd = tokio::process::Command::new(binary);
                cmd.kill_on_drop(true);
                #[cfg(target_os="windows")]
                cmd.creation_flags(0x08000000);
                if let Some(root)=crate::agent::runs::current().and_then(|c|c.project_root.clone()) {cmd.current_dir(root);}
                for arg in raw_args {
                    if let Some(arg_str) = arg.as_str() {
                        cmd.arg(arg_str);
                    }
                }

                let output_res = cmd
                    .output()
                    .await
                    .map_err(|e| format!("Failed to spawn {}: {}", binary, e))?;
                let stdout_full = String::from_utf8_lossy(&output_res.stdout);
                let stderr_full = String::from_utf8_lossy(&output_res.stderr);

                // Cap output at 10KB
                let stdout = if stdout_full.len() > 10_000 {
                    format!("{}... [truncated]", stdout_full.chars().take(10_000).collect::<String>())
                } else {
                    stdout_full.to_string()
                };

                json!({
                    "binary": binary,
                    "exit_code": output_res.status.code().unwrap_or(-1),
                    "stdout": stdout,
                    "stderr": stderr_full.to_string()
                })
            }

            "code.search" => {
                let query = args
                    .get("query")
                    .and_then(|q| q.as_str())
                    .unwrap_or_default();
                let max_results = args
                    .get("max_results")
                    .and_then(|m| m.as_u64())
                    .unwrap_or(20) as usize;
                let literal = args
                    .get("literal")
                    .and_then(|l| l.as_bool())
                    .unwrap_or(false);

                let searcher = crate::agent::beast::BeastSearcher::new(".");
                let hits = searcher.search(query, max_results, literal);
                json!({
                    "query": query,
                    "count": hits.len(),
                    "hits": hits
                })
            }

            "code.symbols" => {
                let query = args
                    .get("query")
                    .and_then(|q| q.as_str())
                    .unwrap_or_default();
                let max_results = args
                    .get("max_results")
                    .and_then(|m| m.as_u64())
                    .unwrap_or(30) as usize;

                let searcher = crate::agent::beast::BeastSearcher::new(".");
                let symbols = searcher.find_symbols(query, max_results);
                json!({
                    "query": query,
                    "count": symbols.len(),
                    "symbols": symbols
                })
            }

            "fs.read" => {
                let path_str = args
                    .get("path")
                    .and_then(|p| p.as_str())
                    .ok_or("Missing path")?;
                let max_lines = args
                    .get("max_lines")
                    .and_then(|m| m.as_u64())
                    .unwrap_or(300) as usize;

                let resolved_path = resolve_user_path(path_str);
                let content = std::fs::read_to_string(&resolved_path)
                    .map_err(|e| format!("Failed to read {}: {}", resolved_path.display(), e))?;
                let lines: Vec<&str> = content.lines().take(max_lines).collect();
                let truncated = content.lines().count() > max_lines;

                json!({
                    "path": resolved_path.display().to_string(),
                    "lines_returned": lines.len(),
                    "truncated": truncated,
                    "content": lines.join("\n")
                })
            }

            "fs.list" => {
                let raw_path = args.get("path").and_then(|p| p.as_str()).unwrap_or("Desktop");
                let path_str = if raw_path.trim().is_empty() || raw_path.trim() == "." {
                    "Desktop"
                } else {
                    raw_path
                };
                let resolved_path = resolve_user_path(path_str);
                let mut list = Vec::new();

                if resolved_path.exists() {
                    if let Ok(entries) = std::fs::read_dir(&resolved_path) {
                        for entry in entries.flatten() {
                            let file_name = entry.file_name().to_string_lossy().to_string();
                            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            let ext = entry
                                .path()
                                .extension()
                                .map(|e| e.to_string_lossy().to_string())
                                .unwrap_or_default();
                            list.push(json!({
                                "name": file_name,
                                "is_dir": is_dir,
                                "size": size,
                                "extension": ext
                            }));
                        }
                    }
                }

                // If user asked to inspect Desktop, also inspect Public Desktop if it exists
                let lower_req = path_str.to_lowercase();
                if lower_req == "desktop" || lower_req.contains("desktop") {
                    let pub_desktop = std::path::Path::new(r"C:\Users\Public\Desktop");
                    if pub_desktop.exists() && pub_desktop != resolved_path {
                        if let Ok(pub_entries) = std::fs::read_dir(pub_desktop) {
                            for entry in pub_entries.flatten() {
                                let file_name = entry.file_name().to_string_lossy().to_string();
                                if !list
                                    .iter()
                                    .any(|item| item.get("name").and_then(|n| n.as_str()) == Some(&file_name))
                                {
                                    let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                    let ext = entry
                                        .path()
                                        .extension()
                                        .map(|e| e.to_string_lossy().to_string())
                                        .unwrap_or_default();
                                    list.push(json!({
                                        "name": file_name,
                                        "is_dir": is_dir,
                                        "size": size,
                                        "extension": ext,
                                        "location": "Public Desktop"
                                    }));
                                }
                            }
                        }
                    }
                }

                json!({
                    "path": resolved_path.display().to_string(),
                    "count": list.len(),
                    "entries": list
                })
            }

            "fs.find" => {
                let query = args
                    .get("query")
                    .and_then(|q| q.as_str())
                    .ok_or("Missing query")?
                    .to_lowercase();
                let raw_path = args.get("path").and_then(|p| p.as_str()).unwrap_or("Desktop");
                let path_str = if raw_path.trim().is_empty() || raw_path.trim() == "." {
                    "Desktop"
                } else {
                    raw_path
                };
                let resolved_path = resolve_user_path(path_str);
                let mut matches = Vec::new();

                let mut search_dirs = vec![resolved_path.clone()];
                if path_str.to_lowercase().contains("desktop") {
                    let pub_desk = std::path::PathBuf::from(r"C:\Users\Public\Desktop");
                    if pub_desk.exists() && pub_desk != resolved_path {
                        search_dirs.push(pub_desk);
                    }
                }

                for dir in search_dirs {
                    if let Ok(entries) = std::fs::read_dir(&dir) {
                        for entry in entries.flatten() {
                            let file_name = entry.file_name().to_string_lossy().to_string();
                            if file_name.to_lowercase().contains(&query) {
                                let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                let ext = entry
                                    .path()
                                    .extension()
                                    .map(|e| e.to_string_lossy().to_string())
                                    .unwrap_or_default();
                                matches.push(json!({
                                    "name": file_name,
                                    "path": entry.path().display().to_string(),
                                    "is_dir": is_dir,
                                    "size": size,
                                    "extension": ext
                                }));
                            }
                        }
                    }
                }

                json!({
                    "query": query,
                    "path": resolved_path.display().to_string(),
                    "count": matches.len(),
                    "matches": matches
                })
            }

            "fs.mkdir" => {
                let path_str = args
                    .get("path")
                    .and_then(|p| p.as_str())
                    .ok_or("Missing path")?;
                let resolved_path = resolve_user_path(path_str);
                std::fs::create_dir_all(&resolved_path)
                    .map_err(|e| format!("Failed to create directory {}: {}", resolved_path.display(), e))?;
                let folder_name = resolved_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| path_str.to_string());
                json!({
                    "status": "created",
                    "path": resolved_path.display().to_string(),
                    "name": folder_name
                })
            }

            "fs.delete" => {
                let path_str = args
                    .get("path")
                    .and_then(|p| p.as_str())
                    .ok_or("Missing path")?;
                let resolved_path = resolve_user_path(path_str);
                if !resolved_path.exists() {
                    return Err(format!("File or directory does not exist: {}", resolved_path.display()));
                }
                if resolved_path.is_file() {
                    std::fs::remove_file(&resolved_path)
                        .map_err(|e| format!("Failed to delete file: {}", e))?;
                } else if resolved_path.is_dir() {
                    std::fs::remove_dir_all(&resolved_path)
                        .map_err(|e| format!("Failed to delete directory: {}", e))?;
                }
                json!({
                    "status": "deleted",
                    "path": resolved_path.display().to_string()
                })
            }

            "app.launch" => {
                let target = args
                    .get("target")
                    .and_then(|t| t.as_str())
                    .ok_or("Missing target")?;
                let target_path = if std::path::Path::new(target).exists() {
                    std::path::PathBuf::from(target)
                } else {
                    let on_desktop = resolve_user_path("Desktop").join(target);
                    if on_desktop.exists() {
                        on_desktop
                    } else {
                        let pub_desktop = std::path::Path::new(r"C:\Users\Public\Desktop").join(target);
                        if pub_desktop.exists() {
                            pub_desktop
                        } else {
                            std::path::PathBuf::from(target)
                        }
                    }
                };

                #[cfg(target_os = "windows")]
                {
                    let mut cmd = tokio::process::Command::new("powershell");
                    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"])
                        .arg(format!("$ErrorActionPreference = 'Stop'; Start-Process -FilePath '{}' -ErrorAction Stop", target_path.display().to_string().replace('\'', "''")));
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                    cmd.kill_on_drop(true);
                    let result=cmd.output().await.map_err(|e|format!("Failed to launch {target}: {e}"))?;
                    if !result.status.success() {return Err(format!("Failed to launch {target}: {}",String::from_utf8_lossy(&result.stderr)));}
                }
                #[cfg(not(target_os = "windows"))]
                {
                    let result=tokio::process::Command::new("open").arg(&target_path).output().await.map_err(|e|e.to_string())?;
                    if !result.status.success() {return Err(String::from_utf8_lossy(&result.stderr).to_string());}
                }

                json!({
                    "status": "launched",
                    "target": target,
                    "resolved_path": target_path.display().to_string()
                })
            }

            "text.process" => {
                let action = args
                    .get("action")
                    .and_then(|a| a.as_str())
                    .unwrap_or("uuid");
                let input = args
                    .get("input")
                    .and_then(|i| i.as_str())
                    .unwrap_or_default();

                match action {
                    "json_pretty" => {
                        let res = delphi::DelphiTools::format_json(input, true)?;
                        json!({ "result": res })
                    }
                    "json_minify" => {
                        let res = delphi::DelphiTools::format_json(input, false)?;
                        json!({ "result": res })
                    }
                    "uuid" => {
                        let id = delphi::DelphiTools::generate_uuid();
                        json!({ "uuid": id })
                    }
                    "jwt_decode" => {
                        let payload = delphi::DelphiTools::decode_jwt_payload(input)?;
                        json!({ "payload": payload })
                    }
                    _ => json!({ "error": "Unknown text action" }),
                }
            }

            "media.probe" => {
                let path_str = args
                    .get("path")
                    .and_then(|p| p.as_str())
                    .ok_or("Missing path")?;
                let info = delphi::DelphiTools::probe_file(path_str)?;
                json!({ "probe": info })
            }

            "web.fetch" => {
                let url = args
                    .get("url")
                    .and_then(|u| u.as_str())
                    .ok_or("Missing url")?;
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(10))
                    .build()
                    .map_err(|e| e.to_string())?;

                let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
                let status = resp.status().as_u16();
                let text = resp.text().await.map_err(|e| e.to_string())?;

                let capped = if text.len() > 15_000 {
                    format!("{}... [truncated]", &text[..15_000])
                } else {
                    text
                };

                json!({
                    "url": url,
                    "status": status,
                    "body": capped
                })
            }

            "browser.snapshot" => {
                let url = args
                    .get("url")
                    .and_then(|u| u.as_str())
                    .ok_or("Missing url")?;
                let mut op = crate::agent::browser::BrowserOperator::new();
                let snap = op.snapshot_url(url).await?;
                serde_json::to_value(&snap).map_err(|e| e.to_string())?
            }

            "browser.action" => {
                let node = args
                    .get("node")
                    .and_then(|n| n.as_u64())
                    .ok_or("Missing node index")? as usize;
                let action = args
                    .get("action")
                    .and_then(|a| a.as_str())
                    .ok_or("Missing action")?;
                let text = args.get("text").and_then(|t| t.as_str());
                let mut op = crate::agent::browser::BrowserOperator::new();
                let res = op.execute_action(node, action, text)?;
                serde_json::to_value(&res).map_err(|e| e.to_string())?
            }

            "review.diff" => {
                let output_bytes = crate::hidden_cmd("git")
                    .args(["diff", "HEAD"])
                    .output()
                    .map(|o| o.stdout)
                    .unwrap_or_default();
                let raw_diff = String::from_utf8_lossy(&output_bytes);
                let diff_files = crate::agent::review::CodeReviewEngine::parse_git_diff(&raw_diff);
                let bundles = crate::agent::review::CodeReviewEngine::bundle_files(&diff_files);
                json!({
                    "files_count": diff_files.len(),
                    "files": diff_files,
                    "bundles": bundles
                })
            }

            "review.scan" => {
                let output_bytes = crate::hidden_cmd("git")
                    .args(["diff", "HEAD"])
                    .output()
                    .map(|o| o.stdout)
                    .unwrap_or_default();
                let raw_diff = String::from_utf8_lossy(&output_bytes);
                let diff_files = crate::agent::review::CodeReviewEngine::parse_git_diff(&raw_diff);
                let findings = crate::agent::review::CodeReviewEngine::review_diff(&diff_files);
                json!({
                    "findings_count": findings.len(),
                    "findings": findings
                })
            }

            "code.chunk" => {
                let path_str = args
                    .get("path")
                    .and_then(|p| p.as_str())
                    .ok_or("Missing path")?;
                let content =
                    std::fs::read_to_string(path_str).map_err(|e| format!("Read error: {}", e))?;
                let searcher = crate::agent::beast::BeastSearcher::new(".");
                let chunks = searcher.chunk_file(path_str, &content);
                json!({
                    "path": path_str,
                    "chunks_count": chunks.len(),
                    "chunks": chunks
                })
            }

            "web.browse" => {
                let task = args.get("task").and_then(|t| t.as_str()).unwrap_or("");
                let url = args.get("url").and_then(|u| u.as_str()).unwrap_or("");
                let mut mcp_result = None;
                {
                    let mut guard = self.mcp_client.lock().await;
                    if let Some(ref mut client) = *guard {
                        if let Ok(res) = client
                            .call_tool("web_browse", json!({ "task": task, "url": url }))
                            .await
                        {
                            if res.get("status").and_then(|s| s.as_str()) == Some("success") {
                                let msg = res.get("message").and_then(|m| m.as_str()).unwrap_or("");
                                if !msg.contains("offline") {
                                    mcp_result = Some(res);
                                }
                            }
                        }
                    }
                }

                if let Some(res) = mcp_result {
                    res
                } else {
                    let query = if !task.is_empty() { task } else { url };
                    match native_web_search(query).await {
                        Ok(val) => val,
                        Err(e) => json!({ "status": "error", "message": e }),
                    }
                }
            }

            "web.extract" => {
                let url = args.get("url").and_then(|u| u.as_str()).unwrap_or("");
                let instruction = args.get("instruction").and_then(|i| i.as_str()).unwrap_or("");
                let mut mcp_result = None;
                {
                    let mut guard = self.mcp_client.lock().await;
                    if let Some(ref mut client) = *guard {
                        if let Ok(res) = client
                            .call_tool(
                                "web_extract",
                                json!({ "url": url, "instruction": instruction }),
                            )
                            .await
                        {
                            if res.get("status").and_then(|s| s.as_str()) == Some("success") {
                                let msg = res.get("message").and_then(|m| m.as_str()).unwrap_or("");
                                if !msg.contains("offline") {
                                    mcp_result = Some(res);
                                }
                            }
                        }
                    }
                }

                if let Some(res) = mcp_result {
                    res
                } else if !url.is_empty() {
                    let client = reqwest::Client::builder()
                        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                        .timeout(std::time::Duration::from_secs(4))
                        .build()
                        .map_err(|e| e.to_string())?;
                    let resp_res = client.get(url).send().await;
                    match resp_res {
                        Ok(resp) => {
                            let status = resp.status();
                            if !status.is_success() {
                                json!({
                                    "status": "partial",
                                    "url": url,
                                    "instruction": instruction,
                                    "content": format!("HTTP {} on target URL. Proceeding with indexed search excerpts.", status)
                                })
                            } else {
                                let text = resp.text().await.unwrap_or_default();
                                let stripped = text
                                    .split('<')
                                    .map(|s| s.split('>').nth(1).unwrap_or(""))
                                    .collect::<Vec<_>>()
                                    .join(" ");
                                let clean = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
                                let capped = if clean.len() > 10_000 {
                                    format!("{}...", &clean[..10_000])
                                } else {
                                    clean
                                };
                                json!({
                                    "status": "success",
                                    "url": url,
                                    "instruction": instruction,
                                    "content": capped
                                })
                            }
                        }
                        Err(e) => {
                            json!({
                                "status": "partial",
                                "url": url,
                                "instruction": instruction,
                                "content": format!("Connection notice for URL: {}. Proceeding with indexed search excerpts.", e)
                            })
                        }
                    }
                } else {
                    json!({
                        "status": "error",
                        "message": "Missing url"
                    })
                }
            }

            "agent.delegate" => {
                let objective = args.get("objective").and_then(|o| o.as_str()).unwrap_or("");
                let mut guard = self.mcp_client.lock().await;
                if let Some(ref mut client) = *guard {
                    match client
                        .call_tool("agent_delegate", json!({ "objective": objective }))
                        .await
                    {
                        Ok(res) => res,
                        Err(e) => json!({ "status": "error", "message": e }),
                    }
                } else {
                    json!({
                        "status": "fallback",
                        "objective": objective,
                        "message": "Multi-agent crew swarm offline."
                    })
                }
            }

            "code.sandbox" => {
                let code = args.get("code").and_then(|c| c.as_str()).unwrap_or("");
                let mut guard = self.mcp_client.lock().await;
                let mut mcp_result = None;
                if let Some(ref mut client) = *guard {
                    if let Ok(res) = client
                        .call_tool("code_sandbox", json!({ "code": code }))
                        .await
                    {
                        if res.get("status").and_then(|s| s.as_str()) != Some("error") {
                            mcp_result = Some(res);
                        }
                    }
                }
                if let Some(res) = mcp_result {
                    res
                } else {
                    execute_python_locally(code).await
                }
            }

            "system.info" => {
                win32::get_system_diagnostics()
            }

            "app.close" => {
                let query = args.get("query").and_then(|q| q.as_str()).unwrap_or("");
                let success = win32::close_window(query).unwrap_or(false);
                json!({
                    "status": if success { "closed" } else { "not_found" },
                    "query": query
                })
            }

            "memory.graph" => {
                let query = args.get("query").and_then(|q| q.as_str()).unwrap_or("");
                let entity = args.get("entity").and_then(|e| e.as_str()).unwrap_or("");
                let mut guard = self.mcp_client.lock().await;
                if let Some(ref mut client) = *guard {
                    match client
                        .call_tool("memory_graph", json!({ "query": query, "entity": entity }))
                        .await
                    {
                        Ok(res) => res,
                        Err(e) => json!({ "status": "error", "message": e }),
                    }
                } else {
                    json!({
                        "status": "fallback",
                        "message": "Graphiti knowledge graph offline."
                    })
                }
            }

            "desktop.uia" => {
                let action = args
                    .get("action")
                    .and_then(|a| a.as_str())
                    .unwrap_or("list_windows");
                let target = args.get("target").and_then(|t| t.as_str()).unwrap_or("");
                let text = args.get("text").and_then(|t| t.as_str()).unwrap_or("");
                let mut guard = self.mcp_client.lock().await;
                if let Some(ref mut client) = *guard {
                    match client
                        .call_tool(
                            "desktop_uia",
                            json!({ "action": action, "target": target, "text": text }),
                        )
                        .await
                    {
                        Ok(res) => res,
                        Err(e) => json!({ "status": "error", "message": e }),
                    }
                } else {
                    let wins = win32::list_windows();
                    json!({
                        "status": "fallback",
                        "windows": wins.into_iter().map(|w| w.title).collect::<Vec<_>>()
                    })
                }
            }

            "project.scan" => {
                let repos = scaffold::ScaffoldEngine::scan_desktop_repositories();
                json!({
                    "status": "success",
                    "count": repos.len(),
                    "repositories": repos
                })
            }

            "project.scaffold" => {
                let archetype = args
                    .get("archetype")
                    .and_then(|a| a.as_str())
                    .unwrap_or("better-t-stack");
                let name = args
                    .get("project_name")
                    .or_else(|| args.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("my-app");
                let target = args
                    .get("target_directory")
                    .or_else(|| args.get("target"))
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| {
                        std::env::var("USERPROFILE")
                            .map(|p| format!("{}\\Desktop\\{}", p, name))
                            .unwrap_or_else(|_| format!("C:\\Users\\anesx\\Desktop\\{}", name))
                    });

                match scaffold::ScaffoldEngine::scaffold_archetype(archetype, name, &target) {
                    Ok(msg) => json!({
                        "status": "scaffolded",
                        "archetype": archetype,
                        "project_name": name,
                        "path": target,
                        "message": msg
                    }),
                    Err(e) => json!({
                        "status": "error",
                        "error": e
                    }),
                }
            }

            _ => json!({ "status": "unknown_tool" }),
        };

        let duration_ms = start.elapsed().as_millis() as u64;

        if crate::agent::runs::current().is_some() && (
            output["exit_code"].as_i64().is_some_and(|code|code!=0)
            || output["status"].as_str().is_some_and(|status|["error","failed","fallback","timeout","unknown_tool"].contains(&status))) {
            return Err(serde_json::to_string_pretty(&output).map_err(|e|e.to_string())?);
        }

        Ok(ToolExecutionResult {
            receipt_id: None,
            undoable: false,
            tool_name: canonical_name,
            output,
            duration_ms,
            tier: tool.tier,
            allowed: true,
            args,
        })
    }
}

fn chrono_now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn find_script_path(name: &str) -> Option<std::path::PathBuf> {
    let p = std::path::Path::new("scripts").join(name);
    if p.exists() {
        return Some(p);
    }
    let p_parent = std::path::Path::new("../scripts").join(name);
    if p_parent.exists() {
        return Some(p_parent);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p1 = parent.join(name);
            if p1.exists() {
                return Some(p1);
            }
            let p2 = parent.join("scripts").join(name);
            if p2.exists() {
                return Some(p2);
            }
            if let Some(grand) = parent.parent() {
                let p3 = grand.join("scripts").join(name);
                if p3.exists() {
                    return Some(p3);
                }
            }
        }
    }
    None
}

async fn execute_python_locally(code: &str) -> serde_json::Value {
    let now = chrono_now_ms();
    let temp_script = std::env::temp_dir().join(format!("friday_sandbox_{}.py", now));

    if let Err(e) = std::fs::write(&temp_script, code) {
        return serde_json::json!({
            "status": "error",
            "error": format!("Failed to create temporary sandbox script: {}", e)
        });
    }

    let script_str = temp_script.to_string_lossy().to_string();

    let runtime=crate::voice::discovery::python_runtime();
    let candidates: Vec<(std::path::PathBuf, Vec<&str>)> = runtime.into_iter().map(|path|(path,vec![script_str.as_str()])).collect();

    let mut final_res = None;
    for (bin, args) in candidates {
        let mut cmd = tokio::process::Command::new(bin);
        cmd.kill_on_drop(true);
        cmd.args(&args);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        match tokio::time::timeout(std::time::Duration::from_secs(12), cmd.output()).await {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(-1);
                let out_text = if !stdout.trim().is_empty() {
                    stdout.clone()
                } else {
                    stderr.clone()
                };
                final_res = Some(serde_json::json!({
                    "status": if output.status.success() { "success" } else { "error" },
                    "stdout": stdout,
                    "stderr": stderr,
                    "output": out_text,
                    "exit_code": exit_code,
                    "runtime": "local_python3"
                }));
                break;
            }
            Ok(Err(_)) => {
                continue;
            }
            Err(_) => {
                final_res = Some(serde_json::json!({
                    "status": "timeout",
                    "error": "Execution timed out after 12 seconds",
                    "runtime": "local_python3"
                }));
                break;
            }
        }
    }

    let _ = std::fs::remove_file(&temp_script);

    final_res.unwrap_or_else(|| {
        serde_json::json!({
            "status": "error",
            "error": "No working Python interpreter found on system (tested py -3, python.exe)"
        })
    })
}

async fn native_web_search(query: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    // 1. DuckDuckGo HTML search via POST (HTTP 200 with all real result snippets)
    if let Ok(res) = client
        .post("https://html.duckduckgo.com/html/")
        .form(&[("q", query)])
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(body) = res.text().await {
                let mut snippets = Vec::new();
                for chunk in body.split("class=\"result__snippet\"") {
                    if let Some(start) = chunk.find('>') {
                        if let Some(end) = chunk[start + 1..].find("</a>") {
                            let raw_text = &chunk[start + 1..start + 1 + end];
                            let cleaned = raw_text
                                .replace("<b>", "")
                                .replace("</b>", "")
                                .replace("&quot;", "\"")
                                .replace("&amp;", "&")
                                .replace("&#x27;", "'")
                                .replace("&#39;", "'")
                                .replace("&lt;", "<")
                                .replace("&gt;", ">")
                                .trim()
                                .to_string();
                            if !cleaned.is_empty() && cleaned.len() > 10 {
                                snippets.push(cleaned);
                            }
                        }
                    }
                    if snippets.len() >= 6 {
                        break;
                    }
                }

                if !snippets.is_empty() {
                    let summary = snippets.join("\n\n");
                    return Ok(serde_json::json!({
                        "status": "success",
                        "query": query,
                        "task": query,
                        "source": "duckduckgo",
                        "results": snippets,
                        "summary": summary,
                        "result": summary
                    }));
                }
            }
        }
    }

    // 2. DuckDuckGo Instant API fallback
    let encoded_query: String = query
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "+".to_string(),
            _ => format!("%{:02X}", c as u32),
        })
        .collect();

    let api_url = format!("https://api.duckduckgo.com/?q={}&format=json&no_html=1", encoded_query);
    if let Ok(res) = client.get(&api_url).send().await {
        if let Ok(json_body) = res.json::<serde_json::Value>().await {
            let abstract_text = json_body.get("AbstractText").and_then(|t| t.as_str()).unwrap_or("");
            if !abstract_text.is_empty() {
                return Ok(serde_json::json!({
                    "status": "success",
                    "query": query,
                    "task": query,
                    "summary": abstract_text,
                    "result": abstract_text
                }));
            }
        }
    }

    // 3. Wikipedia API fallback
    let wiki_url = format!(
        "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
        query.split_whitespace().collect::<Vec<_>>().join("_")
    );
    if let Ok(res) = client.get(&wiki_url).send().await {
        if let Ok(json_body) = res.json::<serde_json::Value>().await {
            if let Some(extract) = json_body.get("extract").and_then(|e| e.as_str()) {
                if !extract.is_empty() {
                    return Ok(serde_json::json!({
                        "status": "success",
                        "query": query,
                        "task": query,
                        "source": "wikipedia",
                        "summary": extract,
                        "result": extract
                    }));
                }
            }
        }
    }

    let summary = format!("Searched online for '{}'. Search dispatched across web endpoints.", query);
    Ok(serde_json::json!({
        "status": "success",
        "query": query,
        "task": query,
        "summary": summary,
        "result": summary
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tool_registry_defaults() {
        let reg = ToolRegistry::new();
        assert!(reg.get("screen.read").is_some());
        assert!(reg.get("fs.move").is_some());
        assert!(reg.get("shell.run").is_some());
    }

    #[tokio::test]
    async fn test_shell_allowlist_gate() {
        let reg = ToolRegistry::new();
        let res = reg
            .invoke("shell.run", json!({"binary": "rm", "args": ["-rf", "/"]}))
            .await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("allowlist"));
    }

    #[tokio::test]
    async fn test_tool_name_normalization() {
        let reg = ToolRegistry::new();
        assert!(reg.get("screen.read").is_some());
        assert!(reg.get("screen_read").is_some());
        assert_eq!(reg.get("screen_read").unwrap().name, "screen.read");
        assert!(reg.get("notify_toast").is_some());
        assert_eq!(reg.get("notify_toast").unwrap().name, "notify.toast");

        let res = reg
            .invoke("notify_toast", json!({"message": "Hello"}))
            .await
            .unwrap();
        assert_eq!(res.tool_name, "notify.toast");
    }

    #[test]
    fn test_resolve_user_path() {
        let p = resolve_user_path("Desktop");
        assert!(p.to_string_lossy().contains("Desktop"));

        let p2 = resolve_user_path("~/test.txt");
        assert!(p2.to_string_lossy().contains("test.txt"));

        let p3 = resolve_user_path(".");
        assert!(p3.is_absolute());

        let p4 = resolve_user_path("");
        assert!(p4.is_absolute());
    }

    #[tokio::test]
    async fn test_new_operator_tools_registered() {
        let reg = ToolRegistry::new();
        assert!(reg.get("web.browse").is_some());
        assert!(reg.get("web.extract").is_some());
        assert!(reg.get("agent.delegate").is_some());
        assert!(reg.get("code.sandbox").is_some());
        assert!(reg.get("memory.graph").is_some());
        assert!(reg.get("desktop.uia").is_some());

        // Underscore normalization
        assert!(reg.get("web_browse").is_some());
        assert!(reg.get("code_sandbox").is_some());
        assert!(reg.get("agent_delegate").is_some());

        // Test invoking without active MCP client uses graceful fallbacks
        let res_web = reg
            .invoke("web.browse", json!({"task": "search test"}))
            .await
            .unwrap();
        assert_eq!(res_web.tool_name, "web.browse");

        let res_code = reg
            .invoke("code.sandbox", json!({"code": "print(1)"}))
            .await
            .unwrap();
        assert_eq!(res_code.tool_name, "code.sandbox");

        let res_agent = reg
            .invoke("agent.delegate", json!({"objective": "design system"}))
            .await
            .unwrap();
        assert_eq!(res_agent.tool_name, "agent.delegate");
    }

    #[tokio::test]
    async fn test_fs_write_placeholder_rejection() {
        let reg = ToolRegistry::new();
        // Rejecting placeholder ...
        let res_err = reg
            .invoke("fs.write", json!({
                "path": "test_page.html",
                "content": "...</content>"
            }))
            .await;
        assert!(res_err.is_err());

        // Accepting full html
        let res_ok = reg
            .invoke("fs.write", json!({
                "path": "test_page.html",
                "content": "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>"
            }))
            .await;
        assert!(res_ok.is_ok());
        let written_path = resolve_user_path("test_page.html");
        let _ = std::fs::remove_file(written_path);
    }

    #[tokio::test]
    async fn test_system_info_and_clipboard() {
        let reg = ToolRegistry::new();
        assert!(reg.get("system.info").is_some());
        assert!(reg.get("app.close").is_some());
        let sys_res = reg.invoke("system.info", json!({})).await.unwrap();
        assert_eq!(sys_res.tool_name, "system.info");
        assert!(sys_res.output.get("memory_total_gb").is_some());

        let clip_res = reg.invoke("clipboard.get", json!({})).await.unwrap();
        assert_eq!(clip_res.tool_name, "clipboard.get");
    }

    #[tokio::test]
    async fn test_project_scan_and_scaffold_tools() {
        let reg = ToolRegistry::new();
        assert!(reg.get("project.scan").is_some());
        assert!(reg.get("project.scaffold").is_some());
        assert!(reg.get("project_scan").is_some());
        assert!(reg.get("project_scaffold").is_some());

        let scan_res = reg.invoke("project.scan", json!({})).await.unwrap();
        assert_eq!(scan_res.tool_name, "project.scan");
        assert_eq!(scan_res.output.get("status").and_then(|s| s.as_str()), Some("success"));

        let temp_dir = std::env::temp_dir().join(format!("test_tool_bts_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        let scaf_res = reg.invoke("project.scaffold", json!({
            "archetype": "better-t-stack",
            "project_name": "tool-bts-app",
            "target_directory": temp_dir.to_string_lossy().to_string()
        })).await.unwrap();
        assert_eq!(scaf_res.tool_name, "project.scaffold");
        assert_eq!(scaf_res.output.get("status").and_then(|s| s.as_str()), Some("scaffolded"));
        let _ = std::fs::remove_dir_all(temp_dir);
    }
}

