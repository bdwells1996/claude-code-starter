import { RecordingState } from "../App";

interface Props {
  recordingState: RecordingState;
  shortcutError: string | null;
  accessibilityOk: boolean;
}

const STATE_LABELS: Record<RecordingState, string> = {
  idle: "Ready",
  recording: "Recording…",
  transcribing: "Transcribing…",
  cleaning: "Cleaning up…",
};

const STATE_COLORS: Record<RecordingState, string> = {
  idle: "#4caf7d",
  recording: "#e05252",
  transcribing: "#f5a623",
  cleaning: "#5b8cff",
};

export default function StatusBar({ recordingState, shortcutError, accessibilityOk }: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.top}>
        <div style={styles.appName}>Natter</div>
        <div style={styles.statusBadge}>
          <span
            style={{
              ...styles.dot,
              background: STATE_COLORS[recordingState],
              boxShadow: recordingState === "recording" ? `0 0 8px ${STATE_COLORS.recording}` : "none",
            }}
          />
          <span style={styles.statusLabel}>{STATE_LABELS[recordingState]}</span>
        </div>
      </div>

      {!accessibilityOk && (
        <div style={styles.warning}>
          Accessibility permission required. Go to System Settings → Privacy & Security →
          Accessibility and enable Natter.
        </div>
      )}

      {shortcutError && (
        <div style={styles.warning}>
          Shortcut conflict: {shortcutError}. Change your keybinding in Settings.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px 16px 12px",
    borderBottom: "1px solid #2a2a2a",
  },
  top: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appName: {
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: -0.3,
    color: "#fff",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#252525",
    borderRadius: 20,
    padding: "4px 10px",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    display: "inline-block",
    transition: "background 0.2s, box-shadow 0.2s",
  },
  statusLabel: {
    fontSize: 12,
    color: "#bbb",
    fontWeight: 500,
  },
  warning: {
    marginTop: 8,
    padding: "6px 10px",
    background: "#3a1f1f",
    borderRadius: 6,
    color: "#f08080",
    fontSize: 11,
    lineHeight: 1.5,
  },
};
