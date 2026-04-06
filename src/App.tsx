import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import StatusBar from "./components/StatusBar";
import HistoryList from "./components/HistoryList";
import Settings from "./components/Settings";

export type RecordingState = "idle" | "recording" | "transcribing" | "cleaning";

export interface HistoryEntry {
  id: string;
  text: string;
  timestamp: Date;
}

type Tab = "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("history");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [accessibilityOk, setAccessibilityOk] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Check accessibility permission on mount.
    invoke<boolean>("check_accessibility").then((ok) => {
      setAccessibilityOk(ok);
    });

    // Listen for shortcut status from backend.
    const unlistenShortcutStatus = listen<string>("shortcut-status", (e) => {
      if (e.payload.startsWith("error:")) {
        setShortcutError(e.payload.slice(6));
      } else {
        setShortcutError(null);
      }
    });

    // Listen for recording start/stop events emitted by the global shortcut.
    const unlistenStart = listen("recording-start", () => {
      startRecording();
    });

    const unlistenStop = listen("recording-stop", () => {
      stopRecording();
    });

    const unlistenStatus = listen<string>("transcription-status", (e) => {
      setRecordingState(e.payload as RecordingState);
    });

    return () => {
      unlistenShortcutStatus.then((fn) => fn());
      unlistenStart.then((fn) => fn());
      unlistenStop.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, []);

  async function startRecording() {
    if (recordingState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const base64 = await blobToBase64(blob);

        try {
          const cleaned = await invoke<string>("process_audio", { audioBase64: base64 });
          if (cleaned) {
            setHistory((prev) => [
              { id: crypto.randomUUID(), text: cleaned, timestamp: new Date() },
              ...prev,
            ]);
          }
        } catch (err) {
          console.error("Transcription failed:", err);
        }
        setRecordingState("idle");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
    } catch (err) {
      console.error("Could not start recording:", err);
      setRecordingState("idle");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingState("transcribing");
    }
  }

  return (
    <div style={styles.container}>
      <StatusBar
        recordingState={recordingState}
        shortcutError={shortcutError}
        accessibilityOk={accessibilityOk}
      />

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === "history" ? styles.activeTab : {}) }}
          onClick={() => setTab("history")}
        >
          History
        </button>
        <button
          style={{ ...styles.tab, ...(tab === "settings" ? styles.activeTab : {}) }}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>

      <div style={styles.content}>
        {tab === "history" ? (
          <HistoryList entries={history} />
        ) : (
          <Settings />
        )}
      </div>
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#1a1a1a",
    color: "#e8e8e8",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #333",
  },
  tab: {
    flex: 1,
    padding: "10px 0",
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    transition: "color 0.15s",
  },
  activeTab: {
    color: "#e8e8e8",
    borderBottom: "2px solid #5b8cff",
  },
  content: {
    flex: 1,
    overflowY: "auto",
  },
};
