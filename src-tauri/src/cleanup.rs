use serde::{Deserialize, Serialize};

const SYSTEM_PROMPT: &str = "Clean up the following spoken transcript. Fix filler words, run-on sentences, and punctuation. Preserve the speaker's intent and vocabulary. Return only the cleaned text — no preamble, no explanation.";

#[derive(Serialize)]
struct OllamaRequest<'a> {
    model: &'a str,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaOptions {
    temperature: f32,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

pub async fn clean_transcript(
    raw: &str,
    ollama_url: &str,
    model: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{ollama_url}/api/generate");

    let body = OllamaRequest {
        model,
        prompt: format!("{SYSTEM_PROMPT}\n\n{raw}"),
        stream: false,
        options: OllamaOptions { temperature: 0.0 },
    };

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Ollama at {ollama_url}: {e}. Is Ollama running?"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Ollama returned HTTP {}: {}",
            response.status(),
            response.text().await.unwrap_or_default()
        ));
    }

    let resp: OllamaResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {e}"))?;

    Ok(resp.response.trim().to_string())
}
