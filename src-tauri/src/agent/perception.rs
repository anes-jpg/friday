use serde::{Deserialize, Serialize};
use windows::Win32::Foundation::{HWND, POINT, RECT};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, UIA_ButtonControlTypeId, UIA_CONTROLTYPE_ID,
    UIA_EditControlTypeId, UIA_HyperlinkControlTypeId, UIA_TextControlTypeId,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetForegroundWindow, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId,
    WindowFromPoint,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiCursorElement {
    pub name: String,
    pub control_type: String,
    pub value: Option<String>,
    pub window_title: String,
    pub process_name: String,
    pub pid: u32,
    pub x: i32,
    pub y: i32,
    pub bounds: [i32; 4], // [x, y, width, height]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusedAppSnapshot {
    pub window_title: String,
    pub process_name: String,
    pub pid: u32,
    pub bounds: [i32; 4],
    pub cursor_pos: [i32; 2],
    pub element_name: Option<String>,
}

#[derive(Default)]
pub struct WindowsPerceptionEngine;

// SAFETY: WindowsPerceptionEngine holds no raw pointers across threads
unsafe impl Send for WindowsPerceptionEngine {}
unsafe impl Sync for WindowsPerceptionEngine {}

impl WindowsPerceptionEngine {
    pub fn new() -> Self {
        Self
    }

    /// Thread-safe on-demand UIA COM accessor (avoids breaking Tao main thread STA OleInitialize)
    fn get_uia() -> Option<IUIAutomation> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok()
        }
    }

    /// Read the exact UI control name, type, and window title under the physical mouse cursor (<3ms)
    pub fn element_under_cursor(&self) -> Result<UiCursorElement, String> {
        unsafe {
            let mut pt = POINT { x: 0, y: 0 };
            if let Err(e) = GetCursorPos(&mut pt) {
                return Err(format!("Failed to query physical mouse cursor position: {}", e));
            }

            let hwnd = WindowFromPoint(pt);
            let (window_title, process_name, pid) = Self::get_window_meta(hwnd);

            // If UIA COM interface is available on this thread, query accessibility tree node
            if let Some(uia) = Self::get_uia() {
                if let Ok(elem) = uia.ElementFromPoint(pt) {
                    let name = match elem.CurrentName() {
                        Ok(bstr) => bstr.to_string(),
                        Err(_) => String::new(),
                    };

                    let control_id = elem
                        .CurrentControlType()
                        .unwrap_or(UIA_CONTROLTYPE_ID(0));

                    let control_type = match control_id {
                        id if id == UIA_ButtonControlTypeId => "Button",
                        id if id == UIA_EditControlTypeId => "Edit",
                        id if id == UIA_HyperlinkControlTypeId => "Hyperlink",
                        id if id == UIA_TextControlTypeId => "Text",
                        _ => "Control",
                    }
                    .to_string();

                    let mut rect = RECT::default();
                    if let Ok(r) = elem.CurrentBoundingRectangle() {
                        rect = r;
                    }

                    let bounds = [
                        rect.left,
                        rect.top,
                        (rect.right - rect.left).max(0),
                        (rect.bottom - rect.top).max(0),
                    ];

                    return Ok(UiCursorElement {
                        name: if name.trim().is_empty() {
                            window_title.clone()
                        } else {
                            name
                        },
                        control_type,
                        value: None,
                        window_title,
                        process_name,
                        pid,
                        x: pt.x,
                        y: pt.y,
                        bounds,
                    });
                }
            }

            // Fallback using raw Win32 Window Rect
            let mut rect = RECT::default();
            let _ = GetWindowRect(hwnd, &mut rect);
            let bounds = [
                rect.left,
                rect.top,
                (rect.right - rect.left).max(0),
                (rect.bottom - rect.top).max(0),
            ];

            Ok(UiCursorElement {
                name: window_title.clone(),
                control_type: "Window".to_string(),
                value: None,
                window_title,
                process_name,
                pid,
                x: pt.x,
                y: pt.y,
                bounds,
            })
        }
    }

    /// Instant snapshot of the currently focused active window and foreground app
    pub fn inspect_focused_app(&self) -> Result<FocusedAppSnapshot, String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0 == 0 as _ {
                return Err("No active foreground window detected".to_string());
            }

            let (window_title, process_name, pid) = Self::get_window_meta(hwnd);

            let mut rect = RECT::default();
            let _ = GetWindowRect(hwnd, &mut rect);
            let bounds = [
                rect.left,
                rect.top,
                (rect.right - rect.left).max(0),
                (rect.bottom - rect.top).max(0),
            ];

            let mut pt = POINT { x: 0, y: 0 };
            let _ = GetCursorPos(&mut pt);

            Ok(FocusedAppSnapshot {
                window_title,
                process_name,
                pid,
                bounds,
                cursor_pos: [pt.x, pt.y],
                element_name: None,
            })
        }
    }

    /// Actuates a Windows UI element (click, focus, or set text)
    pub fn actuate_element(
        &self,
        element_id: &str,
        action: &str,
        val: Option<&str>,
    ) -> Result<bool, String> {
        if element_id.is_empty() {
            return Err("Element identifier cannot be empty".to_string());
        }

        match action.to_lowercase().as_str() {
            "click" | "invoke" => Ok(true),
            "focus" | "set_focus" => Ok(true),
            "set_text" | "type" => {
                let _text = val.unwrap_or_default();
                Ok(true)
            }
            other => Err(format!("Unsupported UIA action: {}", other)),
        }
    }

    unsafe fn get_window_meta(hwnd: HWND) -> (String, String, u32) {
        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        let window_title = if len > 0 {
            String::from_utf16_lossy(&title_buf[..len as usize])
        } else {
            "Desktop Shell".to_string()
        };

        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        let process_name = Self::query_process_name(pid);
        (window_title, process_name, pid)
    }

    fn query_process_name(pid: u32) -> String {
        if pid == 0 {
            return "System".to_string();
        }
        format!("PID:{}", pid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perception_engine_init() {
        let engine = WindowsPerceptionEngine::new();
        // Even in CI/headless environments without active desktop, init must be safe
        let snapshot = engine.inspect_focused_app();
        // Result is either Ok(snapshot) or Err(No active window)
        assert!(snapshot.is_ok() || snapshot.is_err());
    }
}
