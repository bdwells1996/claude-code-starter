import { useState } from "react";
import { HistoryEntry } from "../App";

interface Props {
  entries: HistoryEntry[];
}

export default function HistoryList({ entries }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(entry: HistoryEntry) {
    await navigator.clipboard.writeText(entry.text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (entries.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>🎙</div>
        <div style={styles.emptyText}>Hold your shortcut to start recording</div>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {entries.map((entry) => (
        <div key={entry.id} style={styles.entry}>
          <div style={styles.entryText}>{entry.text}</div>
          <div style={styles.entryMeta}>
            <span style={styles.timestamp}>{formatTime(entry.timestamp)}</span>
            <button style={styles.copyBtn} onClick={() => copy(entry)}>
              {copiedId === entry.id ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  entry: {
    background: "#242424",
    borderRadius: 8,
    padding: "10px 12px",
    border: "1px solid #2e2e2e",
  },
  entryText: {
    lineHeight: 1.55,
    color: "#e0e0e0",
    fontSize: 13,
    marginBottom: 6,
  },
  entryMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timestamp: {
    color: "#666",
    fontSize: 11,
  },
  copyBtn: {
    background: "none",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#888",
    cursor: "pointer",
    fontSize: 11,
    padding: "2px 8px",
    transition: "color 0.15s, border-color 0.15s",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: 200,
    gap: 10,
    color: "#555",
  },
  emptyIcon: {
    fontSize: 36,
    opacity: 0.4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 220,
    lineHeight: 1.5,
  },
};
