use std::path::Path;
use std::process::Command;

/// Transcribe a WAV file using whisper.cpp.
/// `whisper_bin` is the path to the `whisper` or `whisper-cli` executable.
/// `model_path` is the path to the .bin model file.
pub fn transcribe_wav(wav_path: &Path, model_path: &Path) -> Result<String, String> {
    let output = Command::new("whisper-cli")
        .args([
            "--model",
            model_path
                .to_str()
                .ok_or("Invalid model path")?,
            "--output-txt",
            "--no-timestamps",
            "--language",
            "en",
            wav_path
                .to_str()
                .ok_or("Invalid wav path")?,
        ])
        .output()
        .map_err(|e| format!("Failed to spawn whisper-cli: {e}. Is whisper.cpp installed via Homebrew?"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("whisper-cli failed: {stderr}"));
    }

    let transcript = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    Ok(transcript)
}

/// Convert a WebM/Opus blob to WAV using ffmpeg.
pub fn webm_to_wav(webm_path: &Path, wav_path: &Path) -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            webm_path.to_str().ok_or("Invalid webm path")?,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            wav_path.to_str().ok_or("Invalid wav path")?,
        ])
        .output()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}. Is ffmpeg installed via Homebrew?"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg conversion failed: {stderr}"));
    }

    Ok(())
}
