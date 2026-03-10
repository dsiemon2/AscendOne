/**
 * useNotifications
 * Runs a background timer (every 60 s) that sends scheduled daily reminders
 * for gratitudes and journaling via the Tauri notification plugin.
 *
 * Each reminder fires once per day within the first 5 minutes of its target hour.
 * "Sent" state is persisted in localStorage so restarts don't double-fire.
 *
 * Schedule is read from localStorage key "ascendone_notif_prefs" (JSON).
 */
import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getLocalDateString } from "../utils/dateUtils";

export interface NotifSchedule {
  morning:   boolean; morningHour:   number;
  afternoon: boolean; afternoonHour: number;
  evening:   boolean; eveningHour:   number;
  journal:   boolean; journalHour:   number;
}

export const DEFAULT_NOTIF_PREFS: NotifSchedule = {
  morning:       true, morningHour:   8,
  afternoon:     true, afternoonHour: 13,
  evening:       true, eveningHour:   20,
  journal:       true, journalHour:   21,
};

const PREFS_KEY   = "ascendone_notif_prefs";
const SENT_PREFIX = "ascendone_notif_sent_";

function loadPrefs(): NotifSchedule {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_NOTIF_PREFS };
}

async function tryNotify(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    const result = await requestPermission();
    granted = result === "granted";
  }
  if (granted) {
    sendNotification({ title, body });
  }
}

function getSentKey(date: string, key: string) {
  return `${SENT_PREFIX}${date}_${key}`;
}

function checkAndSend() {
  const prefs = loadPrefs();
  const now   = new Date();
  const today = getLocalDateString();
  const h     = now.getHours();
  const m     = now.getMinutes();

  // Only fire within first 4 minutes of the target hour
  if (m > 4) return;

  const schedule: Array<{
    enabled: boolean;
    hour:    number;
    key:     string;
    title:   string;
    body:    string;
  }> = [
    {
      enabled: prefs.morning,
      hour:    prefs.morningHour,
      key:     "morning",
      title:   "🌅 Morning Gratitudes",
      body:    "Start your day with gratitude — your morning entries are waiting!",
    },
    {
      enabled: prefs.afternoon,
      hour:    prefs.afternoonHour,
      key:     "afternoon",
      title:   "☀️ Afternoon Check-in",
      body:    "Pause for a moment — what are you grateful for right now?",
    },
    {
      enabled: prefs.evening,
      hour:    prefs.eveningHour,
      key:     "evening",
      title:   "🌙 Evening Gratitudes",
      body:    "Reflect on the good in today before you wind down.",
    },
    {
      enabled: prefs.journal,
      hour:    prefs.journalHour,
      key:     "journal",
      title:   "📓 Journal Time",
      body:    "A few words in your journal can change how you see tomorrow.",
    },
  ];

  for (const s of schedule) {
    if (!s.enabled || h !== s.hour) continue;
    const sentKey = getSentKey(today, s.key);
    if (localStorage.getItem(sentKey)) continue;
    localStorage.setItem(sentKey, "1");
    tryNotify(s.title, s.body);
  }

  // Prune old sent-keys (keep only today's)
  const prefix = SENT_PREFIX;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix) && !key.includes(today)) {
      localStorage.removeItem(key);
    }
  }
}

export function useNotifications() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Fire once immediately (catches startup within a notification window)
    checkAndSend();

    // Then check every 60 seconds
    timerRef.current = setInterval(checkAndSend, 60_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}

/** Helper for Settings page to save preferences */
export function saveNotifPrefs(prefs: NotifSchedule) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
