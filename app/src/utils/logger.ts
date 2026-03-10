/**
 * AscendOne Logger
 *
 * Structured wrapper over @tauri-apps/plugin-log.
 * Writes to file: %LOCALAPPDATA%\com.ascendone.app\logs\ascendone.log
 *
 * Usage:
 *   logger.info('GoalsPage', 'Goal saved', { goalId: 5 })
 *   logger.error('database', 'Migration failed', { version: 7, error: e })
 *
 * Log levels (in order of severity):
 *   trace → debug → info → warn → error
 */

import { trace, debug, info, warn, error } from "@tauri-apps/plugin-log";

const APP_VERSION = "0.1.0-beta";

// ── Helpers ─────────────────────────────────────────────────────────────────

function stringify(context: unknown): string {
  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
}

function fmt(location: string, message: string, context?: unknown): string {
  const ctx = context !== undefined ? ` | ${stringify(context)}` : "";
  return `[${location}] ${message}${ctx}`;
}

// ── Public logger API ────────────────────────────────────────────────────────

export const logger = {
  trace(location: string, message: string, context?: unknown): void {
    trace(fmt(location, message, context)).catch(() => {});
  },
  debug(location: string, message: string, context?: unknown): void {
    debug(fmt(location, message, context)).catch(() => {});
  },
  info(location: string, message: string, context?: unknown): void {
    info(fmt(location, message, context)).catch(() => {});
  },
  warn(location: string, message: string, context?: unknown): void {
    warn(fmt(location, message, context)).catch(() => {});
  },
  error(location: string, message: string, context?: unknown): void {
    // Also emit to browser console so DevTools shows it during development
    console.error(`[${location}] ${message}`, context ?? "");
    error(fmt(location, message, context)).catch(() => {});
  },
};

// ── Startup banner ───────────────────────────────────────────────────────────

/**
 * Call once at app boot. Writes a header to the log with version + system info
 * so every log session is easy to identify.
 */
export async function logStartup(): Promise<void> {
  const platform = navigator.platform;
  const screen   = `${window.screen.width}x${window.screen.height}`;
  const lang     = navigator.language;

  await info(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  ).catch(() => {});
  await info(
    `AscendOne v${APP_VERSION} — session started`
  ).catch(() => {});
  await info(
    `[Startup] Platform: ${platform} | Screen: ${screen} | Lang: ${lang}`
  ).catch(() => {});
}
