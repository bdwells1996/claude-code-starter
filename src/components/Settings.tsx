import { useCallback, useEffect, useState } from "react";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

// Guard: only call invoke when running inside the Tauri webview.
// Outside that context window.__TAURI_INTERNALS__ is undefined and invoke throws.
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return Promise.reject(new Error("Not running in Tauri"));
  return tauriInvoke<T>(cmd, args);
}
import {
	acceleratorToLabel,
	capturedKeysToLabel,
	eventToCapturedKeys,
	toAccelerator,
} from "../lib/keybindingUtils";
import type { CapturedKeys } from "../lib/keybindingUtils";

interface AppSettings {
	keybinding: string;
	whisper_model: string;
	ollama_model: string;
	ollama_url: string;
}

type CaptureState = "idle" | "capturing" | "saving";

export default function Settings() {
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [captureState, setCaptureState] = useState<CaptureState>("idle");
	const [capturedKeys, setCapturedKeys] = useState<CapturedKeys | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	// Draft edits for non-keybinding settings.
	const [draft, setDraft] = useState<Partial<AppSettings>>({});


	useEffect(() => {
		const defaults: AppSettings = {
			keybinding: "Alt+Space",
			whisper_model: "base.en",
			ollama_model: "llama3.2:3b",
			ollama_url: "http://localhost:11434",
		};
		invoke<AppSettings>("get_settings")
			.then((s) => {
				setSettings(s);
				setDraft({
					whisper_model: s.whisper_model,
					ollama_model: s.ollama_model,
					ollama_url: s.ollama_url,
				});
			})
			.catch(() => {
				// Backend unavailable in dev — show defaults
				setSettings(defaults);
				setDraft({
					whisper_model: defaults.whisper_model,
					ollama_model: defaults.ollama_model,
					ollama_url: defaults.ollama_url,
				});
			});
	}, []);

	// Key capture listeners.
	const cancelCapture = useCallback(async () => {
		setCaptureState("idle");
		setCapturedKeys(null);
		await invoke("resume_shortcut").catch(() => {});
	}, []);

	useEffect(() => {
		if (captureState !== "capturing") return;

		function onKeyDown(e: KeyboardEvent) {
			e.preventDefault();
			e.stopPropagation();

			if (e.key === "Escape") {
				cancelCapture();
				return;
			}

			setCapturedKeys(eventToCapturedKeys(e));
		}

		window.addEventListener("keydown", onKeyDown, true);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
		};
	}, [captureState, cancelCapture]);

	async function startCapture() {
		setError(null);
		setCapturedKeys(null);
		setCaptureState("capturing");
		await invoke("suspend_shortcut").catch(() => {});
	}

	async function saveKeybinding() {
		if (!capturedKeys) return;
		const accelerator = toAccelerator(capturedKeys);
		if (!accelerator) {
			setError(
				"Invalid combination — include at least one modifier (⌘, ⌃, ⇧, ⌥) and one key.",
			);
			return;
		}

		setCaptureState("saving");
		setError(null);

		try {
			await invoke("set_keybinding", { accelerator });
			setSettings((prev) =>
				prev ? { ...prev, keybinding: accelerator } : prev,
			);
			setCaptureState("idle");
			setCapturedKeys(null);
		} catch (err) {
			setError(String(err));
			setCaptureState("capturing");
			await invoke("resume_shortcut").catch(() => {});
		}
	}

	async function resetKeybinding() {
		setError(null);
		try {
			await invoke("reset_keybinding");
			setSettings((prev) =>
				prev ? { ...prev, keybinding: "Alt+Space" } : prev,
			);
		} catch (err) {
			setError(String(err));
		}
	}

	async function saveSettings() {
		if (!settings) return;
		const updated: AppSettings = {
			...settings,
			whisper_model: draft.whisper_model ?? settings.whisper_model,
			ollama_model: draft.ollama_model ?? settings.ollama_model,
			ollama_url: draft.ollama_url ?? settings.ollama_url,
		};
		try {
			await invoke("save_settings", { newSettings: updated });
			setSettings(updated);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch (err) {
			setError(String(err));
		}
	}

	if (!settings) {
		return <div style={styles.loading}>Loading…</div>;
	}

	const currentLabel = acceleratorToLabel(settings.keybinding);
	const liveLabel = capturedKeys ? capturedKeysToLabel(capturedKeys) : null;
	const validAccelerator = capturedKeys ? toAccelerator(capturedKeys) : null;

	return (
		<div style={styles.container}>
			{/* Keybinding section */}
			<section style={styles.section}>
				<div style={styles.sectionTitle}>Push-to-Talk Shortcut</div>

				<div style={styles.captureArea}>
					<div style={styles.keybindingDisplay}>
						{captureState === "capturing" ? (
							<kbd
								style={{
									...styles.kbd,
									...(liveLabel ? {} : styles.kbdPlaceholder),
								}}
							>
								{liveLabel ?? "Press keys…"}
							</kbd>
						) : (
							<kbd style={styles.kbd}>{currentLabel}</kbd>
						)}
					</div>

					<div style={styles.captureActions}>
						{captureState === "idle" && (
							<>
								<button
									style={styles.btnPrimary}
									onClick={startCapture}
									type="button"
								>
									Change
								</button>
								<button
									style={styles.btnGhost}
									onClick={resetKeybinding}
									type="button"
								>
									Reset to Default
								</button>
							</>
						)}

						{captureState === "capturing" && (
							<>
								<button
									style={{
										...styles.btnPrimary,
										opacity: validAccelerator ? 1 : 0.4,
										cursor: validAccelerator ? "pointer" : "not-allowed",
									}}
									onClick={saveKeybinding}
									disabled={!validAccelerator}
									type="button"
								>
									Save
								</button>
								<button
									style={styles.btnGhost}
									onClick={cancelCapture}
									type="button"
								>
									Cancel
								</button>
							</>
						)}

						{captureState === "saving" && (
							<span style={styles.savingLabel}>Saving…</span>
						)}
					</div>

					{captureState === "capturing" && (
						<div style={styles.captureHint}>
							Hold a modifier (⌘ ⇧ ⌥ ⌃) and a key, then click Save. Press Esc to
							cancel.
						</div>
					)}
				</div>

				{error && <div style={styles.errorMsg}>{error}</div>}
			</section>

			{/* Model settings */}
			<section style={styles.section}>
				<div style={styles.sectionTitle}>Transcription</div>
				<label style={styles.field}>
					<span style={styles.label}>Whisper Model</span>
					<input
						style={styles.input}
						value={draft.whisper_model ?? ""}
						onChange={(e) =>
							setDraft((d) => ({ ...d, whisper_model: e.target.value }))
						}
						placeholder="base.en"
					/>
				</label>
			</section>

			<section style={styles.section}>
				<div style={styles.sectionTitle}>LLM Cleanup (Ollama)</div>
				<label style={styles.field}>
					<span style={styles.label}>Model</span>
					<input
						style={styles.input}
						value={draft.ollama_model ?? ""}
						onChange={(e) =>
							setDraft((d) => ({ ...d, ollama_model: e.target.value }))
						}
						placeholder="llama3.2:3b"
					/>
				</label>
				<label style={styles.field}>
					<span style={styles.label}>Ollama URL</span>
					<input
						style={styles.input}
						value={draft.ollama_url ?? ""}
						onChange={(e) =>
							setDraft((d) => ({ ...d, ollama_url: e.target.value }))
						}
						placeholder="http://localhost:11434"
					/>
				</label>
			</section>

			<div style={styles.saveRow}>
				<button style={styles.btnPrimary} onClick={saveSettings} type="button">
					{saved ? "Saved!" : "Save Settings"}
				</button>
			</div>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	container: {
		padding: "12px 16px 20px",
		display: "flex",
		flexDirection: "column",
		gap: 20,
	},
	loading: {
		padding: 20,
		color: "#666",
		textAlign: "center",
		fontSize: 13,
	},
	section: {
		display: "flex",
		flexDirection: "column",
		gap: 10,
	},
	sectionTitle: {
		fontSize: 11,
		fontWeight: 600,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		color: "#666",
	},
	captureArea: {
		outline: "none",
		display: "flex",
		flexDirection: "column",
		gap: 8,
	},
	keybindingDisplay: {
		display: "flex",
		alignItems: "center",
	},
	kbd: {
		background: "#2a2a2a",
		border: "1px solid #444",
		borderRadius: 6,
		padding: "6px 14px",
		fontSize: 15,
		fontFamily: "-apple-system, sans-serif",
		color: "#e8e8e8",
		letterSpacing: 2,
		display: "inline-block",
		minWidth: 120,
		textAlign: "center",
	},
	kbdPlaceholder: {
		color: "#555",
		fontStyle: "italic",
		letterSpacing: 0,
		fontSize: 13,
	},
	captureActions: {
		display: "flex",
		gap: 8,
	},
	captureHint: {
		fontSize: 11,
		color: "#555",
		lineHeight: 1.5,
	},
	errorMsg: {
		padding: "6px 10px",
		background: "#3a1f1f",
		borderRadius: 6,
		color: "#f08080",
		fontSize: 12,
		lineHeight: 1.5,
	},
	field: {
		display: "flex",
		flexDirection: "column",
		gap: 4,
	},
	label: {
		fontSize: 12,
		color: "#888",
	},
	input: {
		background: "#242424",
		border: "1px solid #3a3a3a",
		borderRadius: 6,
		color: "#e0e0e0",
		fontSize: 13,
		padding: "6px 10px",
		outline: "none",
		width: "100%",
	},
	btnPrimary: {
		background: "#5b8cff",
		border: "none",
		borderRadius: 6,
		color: "#fff",
		cursor: "pointer",
		fontSize: 13,
		fontWeight: 500,
		padding: "6px 14px",
		transition: "background 0.15s",
	},
	btnGhost: {
		background: "none",
		border: "1px solid #3a3a3a",
		borderRadius: 6,
		color: "#888",
		cursor: "pointer",
		fontSize: 13,
		padding: "6px 14px",
		transition: "color 0.15s, border-color 0.15s",
	},
	savingLabel: {
		color: "#666",
		fontSize: 13,
		alignSelf: "center",
	},
	saveRow: {
		display: "flex",
		justifyContent: "flex-end",
	},
};
