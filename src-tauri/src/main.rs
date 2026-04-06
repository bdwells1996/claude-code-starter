// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cleanup;
mod inject;
mod keyboard;
mod settings;
mod transcribe;

use settings::Settings;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{
    AppHandle, Emitter, Manager, State,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub struct AppState {
    pub settings: Arc<Mutex<Settings>>,
    pub app_data_dir: PathBuf,
    /// Whether we're currently in keybinding capture mode (shortcut suspended).
    pub capturing: Arc<Mutex<bool>>,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn get_keybinding(state: State<'_, AppState>) -> String {
    state.settings.lock().unwrap().keybinding.clone()
}

#[tauri::command]
fn set_keybinding(
    accelerator: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Try registering the new shortcut first — if it fails the user gets an error
    // and the old shortcut stays registered.
    keyboard::register_shortcut(&app, &accelerator)?;

    let mut settings = state.settings.lock().unwrap();
    settings.keybinding = accelerator;
    settings.save(&state.app_data_dir)?;

    Ok(())
}

#[tauri::command]
fn suspend_shortcut(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *state.capturing.lock().unwrap() = true;
    keyboard::suspend_shortcuts(&app)
}

#[tauri::command]
fn resume_shortcut(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *state.capturing.lock().unwrap() = false;
    let keybinding = state.settings.lock().unwrap().keybinding.clone();
    keyboard::register_shortcut(&app, &keybinding)
}

#[tauri::command]
fn reset_keybinding(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let default = "Alt+Space".to_string();
    keyboard::register_shortcut(&app, &default)?;
    let mut settings = state.settings.lock().unwrap();
    settings.keybinding = default;
    settings.save(&state.app_data_dir)
}

#[tauri::command]
fn save_settings(new_settings: Settings, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    // Re-register shortcut if keybinding changed.
    let old_keybinding = {
        let s = state.settings.lock().unwrap();
        s.keybinding.clone()
    };

    if new_settings.keybinding != old_keybinding {
        keyboard::register_shortcut(&app, &new_settings.keybinding)?;
    }

    let mut settings = state.settings.lock().unwrap();
    *settings = new_settings;
    settings.save(&state.app_data_dir)
}

/// Called by the frontend with a base64-encoded WebM audio blob.
/// Converts to WAV, transcribes, cleans, injects.
#[tauri::command]
async fn process_audio(
    audio_base64: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    use std::io::Write;

    let _ = app.emit("transcription-status", "transcribing");

    // Decode base64 audio.
    let audio_bytes = base64_decode(&audio_base64)?;

    // Write to a temp WebM file.
    let tmp_dir = std::env::temp_dir();
    let webm_path = tmp_dir.join("natter_recording.webm");
    let wav_path = tmp_dir.join("natter_recording.wav");

    {
        let mut f = std::fs::File::create(&webm_path)
            .map_err(|e| format!("Failed to create temp file: {e}"))?;
        f.write_all(&audio_bytes)
            .map_err(|e| format!("Failed to write audio: {e}"))?;
    }

    // Convert to WAV.
    transcribe::webm_to_wav(&webm_path, &wav_path)?;

    // Transcribe.
    let (whisper_model, ollama_model, ollama_url) = {
        let s = state.settings.lock().unwrap();
        (s.whisper_model.clone(), s.ollama_model.clone(), s.ollama_url.clone())
    };

    let model_path = find_whisper_model(&whisper_model)?;
    let raw_transcript = transcribe::transcribe_wav(&wav_path, &model_path)?;

    if raw_transcript.is_empty() {
        let _ = app.emit("transcription-status", "idle");
        return Ok(String::new());
    }

    let _ = app.emit("transcription-status", "cleaning");

    // Clean up with Ollama.
    let cleaned = cleanup::clean_transcript(&raw_transcript, &ollama_url, &ollama_model).await?;

    // Inject into focused app.
    inject::inject_text(&cleaned)?;

    let _ = app.emit("transcription-status", "idle");

    // Clean up temp files (best-effort).
    let _ = std::fs::remove_file(&webm_path);
    let _ = std::fs::remove_file(&wav_path);

    Ok(cleaned)
}

#[tauri::command]
fn check_accessibility() -> bool {
    // Check if Accessibility permission has been granted via AXIsProcessTrusted.
    // We shell out to a tiny osascript to probe this.
    let output = std::process::Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to get name of first process"])
        .output();
    matches!(output, Ok(o) if o.status.success())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn find_whisper_model(model_name: &str) -> Result<PathBuf, String> {
    // Homebrew whisper.cpp stores models in $(brew --prefix)/share/whisper.cpp/models/
    let brew_prefix = std::process::Command::new("brew")
        .args(["--prefix"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "/opt/homebrew".to_string());

    let model_filename = format!("ggml-{model_name}.bin");
    let candidates = [
        PathBuf::from(&brew_prefix)
            .join("share/whisper.cpp/models")
            .join(&model_filename),
        PathBuf::from(format!("/usr/local/share/whisper.cpp/models/{model_filename}")),
        dirs::home_dir()
            .unwrap_or_default()
            .join(format!(".cache/whisper/{model_filename}")),
    ];

    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    Err(format!(
        "Whisper model '{model_name}' not found. Run: whisper-cli --download-model {model_name}"
    ))
}

fn base64_decode(encoded: &str) -> Result<Vec<u8>, String> {
    // Strip data URI prefix if present (e.g. "data:audio/webm;base64,...")
    let data = if let Some(pos) = encoded.find(',') {
        &encoded[pos + 1..]
    } else {
        encoded
    };

    // Simple base64 decode without pulling in an extra crate.
    // Tauri ships with the base64 alphabet.
    use std::io::Read;
    let mut decoder = base64_reader(data.as_bytes());
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|e| format!("Failed to decode audio: {e}"))?;
    Ok(out)
}

/// Minimal base64 decoder (MIME alphabet) using only std.
fn base64_reader(input: &[u8]) -> impl std::io::Read + '_ {
    Base64Decoder { input, pos: 0 }
}

struct Base64Decoder<'a> {
    input: &'a [u8],
    pos: usize,
}

impl std::io::Read for Base64Decoder<'_> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        const TABLE: [u8; 128] = {
            let mut t = [255u8; 128];
            let mut i = 0u8;
            while i < 26 {
                t[(b'A' + i) as usize] = i;
                t[(b'a' + i) as usize] = 26 + i;
                i += 1;
            }
            let mut i = 0u8;
            while i < 10 {
                t[(b'0' + i) as usize] = 52 + i;
                i += 1;
            }
            t[b'+' as usize] = 62;
            t[b'/' as usize] = 63;
            t
        };

        let mut written = 0;
        while written + 3 <= buf.len() {
            // Collect 4 base64 chars (skip whitespace and padding).
            let mut chars = [0u8; 4];
            let mut ci = 0;
            while ci < 4 && self.pos < self.input.len() {
                let byte = self.input[self.pos];
                self.pos += 1;
                if byte == b'=' || byte as usize >= 128 {
                    if byte == b'=' {
                        chars[ci] = 0;
                        ci += 1;
                    }
                    continue;
                }
                let val = TABLE[byte as usize];
                if val != 255 {
                    chars[ci] = val;
                    ci += 1;
                }
            }
            if ci == 0 {
                break;
            }
            buf[written] = (chars[0] << 2) | (chars[1] >> 4);
            written += 1;
            if ci > 2 {
                buf[written] = (chars[1] << 4) | (chars[2] >> 2);
                written += 1;
            }
            if ci > 3 {
                buf[written] = (chars[2] << 6) | chars[3];
                written += 1;
            }
        }
        Ok(written)
    }
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Determine app data directory.
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            // Load persisted settings.
            let settings = Settings::load(&app_data_dir);
            let keybinding = settings.keybinding.clone();

            let state = AppState {
                settings: Arc::new(Mutex::new(settings)),
                app_data_dir,
                capturing: Arc::new(Mutex::new(false)),
            };
            app.manage(state);

            // Register the global push-to-talk shortcut.
            // If it fails (e.g. conflict), log and continue — user can change it in Settings.
            if let Err(e) = keyboard::register_shortcut(app.handle(), &keybinding) {
                log::warn!("Could not register shortcut '{keybinding}': {e}");
                // Emit so the frontend can warn the user.
                let _ = app.handle().emit("shortcut-status", format!("error:{e}"));
            } else {
                let _ = app.handle().emit("shortcut-status", "ok");
            }

            // Build tray icon with a simple context menu.
            let quit_item = MenuItem::with_id(app, "quit", "Quit Natter", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Open Natter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Natter — idle")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            get_keybinding,
            set_keybinding,
            suspend_shortcut,
            resume_shortcut,
            reset_keybinding,
            save_settings,
            process_audio,
            check_accessibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Natter");
}
