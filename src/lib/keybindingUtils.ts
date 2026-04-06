/**
 * Utilities for translating between JavaScript KeyboardEvent properties
 * and Tauri global-shortcut accelerator strings.
 *
 * Tauri accelerator format: "Modifier+Modifier+Key"
 * Examples: "CmdOrCtrl+Shift+Space", "CmdOrCtrl+Alt+A"
 */


export const MODIFIER_KEYS = new Set([
  "Meta",
  "Control",
  "Shift",
  "Alt",
  "CapsLock",
  "Fn",
  "NumLock",
  "ScrollLock",
  "Hyper",
  "Super",
]);

export interface CapturedKeys {
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string | null; // The non-modifier key, already mapped to Tauri token
}

export function eventToCapturedKeys(e: KeyboardEvent): CapturedKeys {
  const key = MODIFIER_KEYS.has(e.key) ? null : resolveKey(e);
  return {
    meta: e.metaKey,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key,
  };
}

function resolveKey(e: KeyboardEvent): string | null {
  // Use e.code rather than e.key — e.key changes when modifiers are held
  // (e.g. Option+Space produces a non-breaking space on macOS, not " ").

  if (e.code === "Space") return "Space";

  // Letters: KeyA–KeyZ
  const letterMatch = e.code.match(/^Key([A-Z])$/);
  if (letterMatch) return letterMatch[1];

  // Digits: Digit0–Digit9
  const digitMatch = e.code.match(/^Digit(\d)$/);
  if (digitMatch) return digitMatch[1];

  // Function keys: F1–F12
  if (/^F\d{1,2}$/.test(e.code)) return e.code;

  // Named keys via explicit map (arrows, Return, etc.)
  const CODE_MAP: Record<string, string> = {
    Enter: "Return",
    Return: "Return",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
  };
  if (CODE_MAP[e.code]) return CODE_MAP[e.code];

  return null;
}

/**
 * Convert captured keys to a Tauri accelerator string.
 * Returns null if the combination is invalid (no modifier, or no key).
 */
export function toAccelerator(keys: CapturedKeys): string | null {
  const { meta, ctrl, shift, alt, key } = keys;

  if (!key) return null;
  if (!meta && !ctrl && !shift && !alt) return null; // Must have at least one modifier

  const parts: string[] = [];
  if (meta || ctrl) parts.push("CmdOrCtrl"); // Cmd and Ctrl both map to CmdOrCtrl for macOS/cross-compat
  if (shift) parts.push("Shift");
  if (alt) parts.push("Alt");
  parts.push(key);

  return parts.join("+");
}

/**
 * Human-readable label for display in the UI.
 * Example: "CmdOrCtrl+Shift+Space" → "⌘ ⇧ Space"
 */
export function acceleratorToLabel(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => {
      switch (part) {
        case "CmdOrCtrl":
        case "Cmd":
          return "⌘";
        case "Ctrl":
          return "⌃";
        case "Shift":
          return "⇧";
        case "Alt":
          return "⌥";
        case "Space":
          return "Space";
        case "Return":
          return "Return";
        default:
          return part;
      }
    })
    .join(" ");
}

/**
 * Live display while user is holding keys during capture mode.
 */
export function capturedKeysToLabel(keys: CapturedKeys): string {
  const parts: string[] = [];
  if (keys.meta) parts.push("⌘");
  if (keys.ctrl) parts.push("⌃");
  if (keys.shift) parts.push("⇧");
  if (keys.alt) parts.push("⌥");
  if (keys.key) parts.push(keys.key === "Space" ? "Space" : keys.key);
  return parts.join(" ") || "…";
}
