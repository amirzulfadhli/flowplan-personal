//! Windows companion visibility and z-order are managed together through Win32.
//! Tao's show() activates existing windows even when focused(false) was specified
//! at creation. Avoid mixing its cached visibility/style setters with these APIs.
use crate::database::StoreError;
use tauri::WebviewWindow;

#[cfg(windows)]
mod platform {
    use super::*;
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{
            SetForegroundWindow, SetWindowPos, ShowWindow, HWND_NOTOPMOST, HWND_TOPMOST,
            SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SW_HIDE, SW_SHOW, SW_SHOWNOACTIVATE,
        },
    };
    fn on_ui(
        window: &WebviewWindow,
        operation: impl FnOnce(HWND) -> Result<(), StoreError> + Send + 'static,
    ) -> Result<(), StoreError> {
        let target = window.clone();
        let (sender, receiver) = std::sync::mpsc::sync_channel(1);
        window
            .run_on_main_thread(move || {
                let result = target.hwnd().map_err(error).and_then(operation);
                let _ = sender.send(result);
            })
            .map_err(error)?;
        receiver.recv().map_err(error)?
    }
    pub fn visibility(
        window: &WebviewWindow,
        visible: bool,
        activate: bool,
    ) -> Result<(), StoreError> {
        on_ui(window, move |hwnd| {
            // SAFETY: this live window's handle is obtained and used on its owning
            // UI thread. ShowWindow's return value describes prior visibility.
            unsafe {
                let _ = ShowWindow(
                    hwnd,
                    if !visible {
                        SW_HIDE
                    } else if activate {
                        SW_SHOW
                    } else {
                        SW_SHOWNOACTIVATE
                    },
                );
                if visible && activate {
                    let _ = SetForegroundWindow(hwnd);
                }
            }
            Ok(())
        })
    }
    pub fn pin(window: &WebviewWindow, pinned: bool) -> Result<(), StoreError> {
        on_ui(window, move |hwnd| {
            // SAFETY: valid owned HWND, no pointers, geometry and activation preserved.
            unsafe {
                SetWindowPos(
                    hwnd,
                    Some(if pinned { HWND_TOPMOST } else { HWND_NOTOPMOST }),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                )
            }
            .map_err(error)
        })
    }
    fn error(value: impl std::fmt::Display) -> StoreError {
        StoreError::new("NATIVE", value.to_string())
    }
}

#[cfg(windows)]
pub use platform::{pin, visibility};

#[cfg(not(windows))]
pub fn visibility(window: &WebviewWindow, visible: bool, activate: bool) -> Result<(), StoreError> {
    let result = if visible {
        window.show()
    } else {
        window.hide()
    };
    result.map_err(|e| StoreError::new("NATIVE", e.to_string()))?;
    if visible && activate {
        window
            .set_focus()
            .map_err(|e| StoreError::new("NATIVE", e.to_string()))?;
    }
    Ok(())
}
#[cfg(not(windows))]
pub fn pin(window: &WebviewWindow, pinned: bool) -> Result<(), StoreError> {
    window
        .set_always_on_top(pinned)
        .map_err(|e| StoreError::new("NATIVE", e.to_string()))
}
