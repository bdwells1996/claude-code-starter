use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const DEFAULT_KEYBINDING: &str = "Alt+Space";
const DEFAULT_WHISPER_MODEL: &str = "base.en";
const DEFAULT_OLLAMA_MODEL: &str = "llama3.2:3b";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub keybinding: String,
    pub whisper_model: String,
    pub ollama_model: String,
    pub ollama_url: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            keybinding: DEFAULT_KEYBINDING.to_string(),
            whisper_model: DEFAULT_WHISPER_MODEL.to_string(),
            ollama_model: DEFAULT_OLLAMA_MODEL.to_string(),
            ollama_url: "http://localhost:11434".to_string(),
        }
    }
}

impl Settings {
    pub fn load(app_data_dir: &PathBuf) -> Self {
        let path = settings_path(app_data_dir);
        if let Ok(contents) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str::<Settings>(&contents) {
                return settings;
            }
        }
        Settings::default()
    }

    pub fn save(&self, app_data_dir: &PathBuf) -> Result<(), String> {
        let path = settings_path(app_data_dir);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create settings directory: {e}"))?;
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize settings: {e}"))?;
        fs::write(&path, json).map_err(|e| format!("Failed to write settings: {e}"))
    }
}

fn settings_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("settings.json")
}
