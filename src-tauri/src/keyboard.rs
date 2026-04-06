use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// Register the push-to-talk shortcut. Emits `recording-start` on press,
/// `recording-stop` on release.
pub fn register_shortcut(app: &AppHandle, accelerator: &str) -> Result<(), String> {
    let shortcut = accelerator
        .parse::<tauri_plugin_global_shortcut::Shortcut>()
        .map_err(|e| format!("Invalid shortcut '{accelerator}': {e}"))?;

    // Unregister any existing shortcut first (best-effort).
    let _ = app.global_shortcut().unregister_all();

    let app_handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            match event.state() {
                ShortcutState::Pressed => {
                    let _ = app_handle.emit("recording-start", ());
                }
                ShortcutState::Released => {
                    let _ = app_handle.emit("recording-stop", ());
                }
            }
        })
        .map_err(|e| format!("Failed to register shortcut '{accelerator}': {e}"))?;

    Ok(())
}

/// Unregister all shortcuts (called when entering keybinding capture mode).
pub fn suspend_shortcuts(app: &AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("Failed to unregister shortcuts: {e}"))
}
