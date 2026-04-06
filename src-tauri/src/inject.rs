use std::process::Command;

/// Copy text to clipboard and simulate Cmd+V in the previously focused app.
/// Uses AppleScript via osascript.
pub fn inject_text(text: &str) -> Result<(), String> {
    // Escape text for AppleScript string literal.
    let escaped = text.replace('\\', "\\\\").replace('"', "\\\"");

    let script = format!(
        r#"
set the clipboard to "{escaped}"
tell application "System Events"
    keystroke "v" using {{command down}}
end tell
"#
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to spawn osascript: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "osascript failed: {stderr}. Does Natter have Accessibility permission?"
        ));
    }

    Ok(())
}
