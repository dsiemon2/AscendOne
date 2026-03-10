import { useState, useEffect, useRef } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, X,
  Trash2, AlignLeft, LayoutGrid, CalendarDays, RefreshCw, CheckCircle,
} from "lucide-react";
import { getDb } from "../db/database";
import { useThemeStore } from "../store/themeStore";
import { useAppStore } from "../store/appStore";
import { dateToLocalString, getLocalDateString } from "../utils/dateUtils";
import { getHolidaysForRange } from "../utils/holidays";

const STREAK_BONUS_THRESHOLDS = [
  { days: 7,   pts: 15,  label: '7-day streak' },
  { days: 30,  pts: 40,  label: '30-day streak' },
  { days: 100, pts: 100, label: '100-day streak' },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalEvent {
  id: number;
  title: string;
  description: string | null;
  event_type: string;
  start_datetime: string;
  end_datetime: string | null;
  all_day: number;
  color: string;
  recurrence: string | null;     // JSON: {"type":"weekly","days":[1,4],"end_date":"..."}
  event_status: string | null;   // 'active' | 'completed' | 'cancelled' | 'rescheduled' | 'missed'
  status_reason: string | null;
  award_points: number;          // 0 or 1
  points_value: number;          // pts awarded on completion
  source: "event";
  _is_virtual?: boolean;         // true for expanded recurring occurrences
  _series_start?: string;        // master start_datetime for recurring series
  _occurrence_status?: string;   // status from event_occurrences for this specific occurrence
  _is_holiday?: boolean;         // true for auto-generated public holiday entries
}

interface CalTask {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string | null;
  points_value: number;
  source: "task";
}

interface EventOccurrence {
  event_id: number;
  occurrence_date: string;
  status: string;
  points_awarded: number;
}

type DayItem = CalEvent | CalTask;
type ViewMode = "week" | "day" | "month";

// ─── Constants ────────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64;
const DAY_START   = 6;
const DAY_END     = 22;
const TOTAL_HOURS = DAY_END - DAY_START;

const EVENT_TYPES = [
  { value: "appointment", label: "📅 Appointment", color: "#0288D1" },
  { value: "meeting",     label: "🤝 Meeting",     color: "#7C3AED" },
  { value: "work",        label: "💼 Work",         color: "#0EA5E9" },
  { value: "exercise",    label: "💪 Exercise",    color: "#10B981" },
  { value: "personal",    label: "🌟 Personal",    color: "#F59E0B" },
  { value: "errand",      label: "🛒 Errand",      color: "#F97316" },
  { value: "reminder",    label: "🔔 Reminder",    color: "#D81B60" },
  { value: "birthday",    label: "🎂 Birthday",    color: "#EC4899" },
  { value: "other",       label: "📌 Other",       color: "#6B7280" },
];

// Types that earn points by default
const AWARD_POINTS_TYPES = ["exercise", "personal", "work"];

const EVENT_STATUSES = [
  { value: "active",      label: "Active",      emoji: "🔵", color: "#5090e0" },
  { value: "completed",   label: "Completed",   emoji: "✅", color: "#10b981" },
  { value: "cancelled",   label: "Cancelled",   emoji: "🚫", color: "#ef4444" },
  { value: "rescheduled", label: "Rescheduled", emoji: "🔄", color: "#f59e0b" },
  { value: "missed",      label: "Missed",      emoji: "😬", color: "#6b7280" },
];

const PRESET_REASONS = [
  "Sick / Not feeling well",
  "Schedule conflict",
  "Forgot / Overslept",
  "Traffic / Got held up",
  "Weather",
  "Personal emergency",
  "Event cancelled by host",
];

const RECUR_DAYS = [
  { d: 0, label: "Su" },
  { d: 1, label: "Mo" },
  { d: 2, label: "Tu" },
  { d: 3, label: "We" },
  { d: 4, label: "Th" },
  { d: 5, label: "Fr" },
  { d: 6, label: "Sa" },
];

const DAY_NAMES      = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES    = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];

const MISSED_CHECK_KEY = "ascendone_missed_event_check";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) { return dateToLocalString(d); }

function getWeekStart(date: Date) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function formatHour(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h} ${ampm}`;
}

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2,"0")} ${ampm}`;
}

function priorityColor(p: string) {
  return ({ low:"#22c55e", medium:"#f59e0b", high:"#ef4444", urgent:"#dc2626" } as Record<string,string>)[p] ?? "#f59e0b";
}

function typeColor(eventType: string): string {
  return EVENT_TYPES.find(t => t.value === eventType)?.color ?? "#6B7280";
}

/**
 * Expands recurring event master records into virtual occurrences within [rangeStart, rangeEnd].
 */
function expandRecurring(
  recurringEvents: CalEvent[],
  rangeStart: string,
  rangeEnd: string,
): CalEvent[] {
  const result: CalEvent[] = [];
  const rsDate = new Date(rangeStart + "T00:00:00");
  const reDate = new Date(rangeEnd   + "T23:59:59");

  for (const ev of recurringEvents) {
    if (!ev.recurrence) continue;
    let rec: { type: string; days?: number[]; end_date?: string };
    try { rec = JSON.parse(ev.recurrence); } catch { continue; }

    const [masterDateStr, masterTime = "00:00"] = ev.start_datetime.split(" ");
    const seriesStart = new Date(masterDateStr + "T00:00:00");

    // ── Annual recurrence (birthdays) ──────────────────────────────────────
    if (rec.type === "annual") {
      const masterDate  = new Date(masterDateStr + "T00:00:00");
      const masterMonth = masterDate.getMonth();
      const masterDay   = masterDate.getDate();
      for (let y = rsDate.getFullYear(); y <= reDate.getFullYear(); y++) {
        const occ = new Date(y, masterMonth, masterDay);
        if (occ < seriesStart) continue;
        if (occ < rsDate || occ > reDate) continue;
        const dateStr = toDateStr(occ);
        result.push({
          ...ev,
          start_datetime: dateStr,
          end_datetime:   null,
          _is_virtual:    true,
          _series_start:  ev.start_datetime,
        });
      }
      continue;
    }

    // ── Weekly recurrence ───────────────────────────────────────────────────
    if (rec.type !== "weekly" || !Array.isArray(rec.days) || rec.days.length === 0) continue;

    const seriesEndLimit = rec.end_date ? new Date(rec.end_date + "T23:59:59") : null;
    let walkStart = seriesStart > rsDate ? seriesStart : rsDate;
    const walkEnd = seriesEndLimit && seriesEndLimit < reDate ? seriesEndLimit : reDate;

    let cur = new Date(walkStart);
    while (cur <= walkEnd) {
      const dow = cur.getDay();
      if (rec.days.includes(dow)) {
        const dateStr  = toDateStr(cur);
        const startDt  = masterTime ? `${dateStr} ${masterTime}` : dateStr;
        let endDt: string | null = null;
        if (ev.end_datetime) {
          const endTimePart = ev.end_datetime.split(" ")[1] ?? "";
          endDt = endTimePart ? `${dateStr} ${endTimePart}` : null;
        }
        result.push({
          ...ev,
          start_datetime: startDt,
          end_datetime:   endDt,
          _is_virtual:    true,
          _series_start:  ev.start_datetime,
        });
      }
      cur = addDays(cur, 1);
    }
  }
  return result;
}

/**
 * Returns true if an event has already started (or is all-day today).
 * Used to gate the "Mark Done" button — can't complete something that hasn't happened yet.
 */
function hasEventStarted(ev: CalEvent, dateStr: string, todayStr: string): boolean {
  if (dateStr < todayStr) return true;   // past day — always started
  if (dateStr > todayStr) return false;  // future day — never started
  // Same day: all-day events are fair game; timed events check the clock
  if (ev.all_day === 1) return true;
  const timePart = ev.start_datetime.split(" ")[1];
  if (!timePart) return true;
  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  return timePart <= nowStr;
}

/** Human-readable recurrence summary */
function recurrenceLabel(recurrenceJson: string | null): string {
  if (!recurrenceJson) return "";
  try {
    const rec = JSON.parse(recurrenceJson);
    if (rec.type === "annual") return "Every year 🎂";
    if (rec.type === "weekly" && Array.isArray(rec.days) && rec.days.length > 0) {
      const dayLabels = rec.days
        .sort((a: number, b: number) => a - b)
        .map((d: number) => DAY_NAMES[d]);
      return `Every ${dayLabels.join(", ")}`;
    }
  } catch { /* ignore */ }
  return "";
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { theme } = useThemeStore();
  const { addTodayPoints, profile } = useAppStore();
  const gridRef   = useRef<HTMLDivElement>(null);

  const [viewMode,    setViewMode]    = useState<ViewMode>("week");
  const [weekStart,   setWeekStart]   = useState(() => getWeekStart(new Date()));
  const [monthStart,  setMonthStart]  = useState(() => getMonthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => toDateStr(new Date()));

  const [events,    setEvents]    = useState<CalEvent[]>([]);
  const [tasks,     setTasks]     = useState<CalTask[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<CalEvent | null>(null);
  // Quick outcome banner state (shown in edit modal for past unresolved events)
  const [quickOutcome, setQuickOutcome] = useState<"missed" | "rescheduled" | "cancelled" | null>(null);
  const [quickReason, setQuickReason] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", event_type: "appointment",
    date: "", start_time: "", end_time: "", all_day: false,
    event_status: "active", status_reason: "",
    recurrence_type: "none",
    recurrence_days: [] as number[],
    recurrence_end_date: "",
    want_reschedule: true,
    award_points: false,
    points_value: 10,
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today    = toDateStr(new Date());

  // ─── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode === "month") loadMonthData();
    else loadWeekData();
  }, [weekStart, monthStart, viewMode]);

  async function loadWeekData() {
    await loadRange(toDateStr(weekStart), toDateStr(addDays(weekStart, 6)));
  }

  async function loadMonthData() {
    const gridStart = addDays(monthStart, -monthStart.getDay());
    await loadRange(toDateStr(gridStart), toDateStr(addDays(gridStart, 41)));
  }

  async function loadRange(start: string, end: string) {
    try {
      const db = await getDb();

      // Run missed-event detection once per day
      await runMissedEventCheck(db);

      // Regular (non-recurring) events
      const regularEvs = await db.select<CalEvent[]>(
        `SELECT *, 'event' as source FROM events
         WHERE (recurrence IS NULL OR recurrence = '')
           AND date(start_datetime, 'localtime') >= ?
           AND date(start_datetime, 'localtime') <= ?
         ORDER BY start_datetime`,
        [start, end]
      );

      // Recurring masters → expand in JS
      const recurringMasters = await db.select<CalEvent[]>(
        `SELECT *, 'event' as source FROM events
         WHERE recurrence IS NOT NULL AND recurrence != ''
         ORDER BY start_datetime`
      );

      const expandedEvs = expandRecurring(recurringMasters, start, end);

      // Load event_occurrences for this range and apply to virtual events
      const occurrences = await db.select<EventOccurrence[]>(
        `SELECT event_id, occurrence_date, status, points_awarded
         FROM event_occurrences
         WHERE occurrence_date >= ? AND occurrence_date <= ?`,
        [start, end]
      );
      const occMap = new Map<string, EventOccurrence>();
      for (const occ of occurrences) {
        occMap.set(`${occ.event_id}-${occ.occurrence_date}`, occ);
      }
      const expandedWithStatus = expandedEvs.map(ev => {
        if (ev._is_virtual) {
          const key = `${ev.id}-${ev.start_datetime.split(" ")[0]}`;
          const occ = occMap.get(key);
          if (occ) return { ...ev, event_status: occ.status, _occurrence_status: occ.status };
        }
        return ev;
      });

      // ── Merge public holidays (read-only, country-aware) ──────────────────
      const rawHolidays = getHolidaysForRange(profile?.country, start, end);
      const holidayEvs: CalEvent[] = rawHolidays.map((h, i) => ({
        id:             -(i + 1),
        title:          h.name,
        description:    null,
        event_type:     "holiday",
        start_datetime: h.date,
        end_datetime:   null,
        all_day:        1,
        color:          "#f59e0b",
        recurrence:     null,
        event_status:   "active",
        status_reason:  null,
        award_points:   0,
        points_value:   0,
        source:         "event",
        _is_holiday:    true,
      }));

      const evs = [...regularEvs, ...expandedWithStatus, ...holidayEvs].sort((a, b) =>
        a.start_datetime.localeCompare(b.start_datetime)
      );

      const tks = await db.select<CalTask[]>(
        `SELECT id, title, category, priority, status, scheduled_date, scheduled_time,
                points_value, 'task' as source
         FROM tasks WHERE scheduled_date >= ? AND scheduled_date <= ?
         ORDER BY scheduled_date, scheduled_time`,
        [start, end]
      );
      setEvents(evs);
      setTasks(tks);
    } catch (e) { console.error("Calendar load error", e); }
  }

  // ─── Missed-event detection (runs once per calendar day) ───────────────────
  async function runMissedEventCheck(db: Awaited<ReturnType<typeof getDb>>) {
    const todayStr = getLocalDateString();
    try { if (localStorage.getItem(MISSED_CHECK_KEY) === todayStr) return; } catch { return; }

    try {
      const yesterday     = dateToLocalString(new Date(Date.now() - 86400000));
      const thirtyDaysAgo = dateToLocalString(new Date(Date.now() - 30 * 86400000));

      // ── Non-recurring: past active events with award_points=1 ──
      const pastActive = await db.select<{ id: number; title: string; start_datetime: string }[]>(
        `SELECT id, title, start_datetime FROM events
         WHERE (recurrence IS NULL OR recurrence = '')
           AND award_points = 1
           AND (event_status IS NULL OR event_status = 'active')
           AND substr(start_datetime, 1, 10) <= ?
           AND substr(start_datetime, 1, 10) >= ?`,
        [yesterday, thirtyDaysAgo]
      );
      for (const ev of pastActive) {
        const evDate = ev.start_datetime.split(" ")[0];
        const ml = await db.select<{ c: number }[]>(
          `SELECT COUNT(*) as c FROM missed_log WHERE source_type='event' AND source_id=? AND missed_date=?`,
          [ev.id, evDate]
        );
        // Log to missed_log for stats — but DON'T auto-mark the event status.
        // The user must manually resolve each event (Done / Missed / Rescheduled).
        if ((ml[0]?.c ?? 0) === 0) {
          await db.execute(
            `INSERT INTO missed_log (source_type, source_id, title, missed_date) VALUES ('event', ?, ?, ?)`,
            [ev.id, ev.title, evDate]
          );
        }
      }

      // ── Recurring: check past occurrences with award_points=1 ──
      const recurEvents = await db.select<{
        id: number; title: string; start_datetime: string; recurrence: string;
      }[]>(
        `SELECT id, title, start_datetime, recurrence FROM events
         WHERE recurrence IS NOT NULL AND recurrence != '' AND award_points = 1`
      );

      for (const ev of recurEvents) {
        let rec: { type: string; days: number[]; end_date?: string };
        try { rec = JSON.parse(ev.recurrence); } catch { continue; }
        if (rec.type !== "weekly" || !Array.isArray(rec.days) || rec.days.length === 0) continue;

        const seriesStart = ev.start_datetime.split(" ")[0];
        const checkFrom   = seriesStart > thirtyDaysAgo ? seriesStart : thirtyDaysAgo;

        let cur = new Date(checkFrom + "T12:00:00");
        const endDate   = new Date(yesterday + "T12:00:00");
        const seriesEnd = rec.end_date ? new Date(rec.end_date + "T23:59:59") : null;

        while (cur <= endDate) {
          if (seriesEnd && cur > seriesEnd) break;
          if (rec.days.includes(cur.getDay())) {
            const dateStr = dateToLocalString(cur);
            const occRows = await db.select<{ c: number }[]>(
              `SELECT COUNT(*) as c FROM event_occurrences WHERE event_id=? AND occurrence_date=?`,
              [ev.id, dateStr]
            );
            if ((occRows[0]?.c ?? 0) === 0) {
              // Log for stats only — user must resolve manually (no auto-status-marking).
              const mlRows = await db.select<{ c: number }[]>(
                `SELECT COUNT(*) as c FROM missed_log WHERE source_type='event' AND source_id=? AND missed_date=?`,
                [ev.id, dateStr]
              );
              if ((mlRows[0]?.c ?? 0) === 0) {
                await db.execute(
                  `INSERT INTO missed_log (source_type, source_id, title, missed_date) VALUES ('event', ?, ?, ?)`,
                  [ev.id, ev.title, dateStr]
                );
              }
            }
          }
          cur.setDate(cur.getDate() + 1);
        }
      }

      try { localStorage.setItem(MISSED_CHECK_KEY, todayStr); } catch { /* ignore */ }
    } catch (e) { console.error("runMissedEventCheck error", e); }
  }

  // ─── Mark event complete ───────────────────────────────────────────────────
  async function markEventComplete(ev: CalEvent) {
    try {
      const db          = await getDb();
      const entryDate   = getLocalDateString();
      const occurrenceDate = ev.start_datetime.split(" ")[0];

      if (ev._is_virtual) {
        // Recurring occurrence — check if already completed
        const existing = await db.select<{ status: string }[]>(
          `SELECT status FROM event_occurrences WHERE event_id=? AND occurrence_date=?`,
          [ev.id, occurrenceDate]
        );
        if (existing.length > 0 && existing[0].status === "completed") return;

        const wasAlreadyMissed = existing.length > 0 && existing[0].status === "missed";

        await db.execute(
          `INSERT OR REPLACE INTO event_occurrences (event_id, occurrence_date, status, points_awarded)
           VALUES (?, ?, 'completed', ?)`,
          [ev.id, occurrenceDate, ev.award_points && ev.points_value > 0 ? ev.points_value : 0]
        );

        // Award points (even if it was previously marked missed — you still showed up)
        if (ev.award_points && ev.points_value > 0 && !wasAlreadyMissed) {
          await db.execute(
            `INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
             VALUES (?, ?, 'event', ?, ?)`,
            [ev.points_value, `Completed: ${ev.title}`, ev.id, entryDate]
          );
        } else if (ev.award_points && ev.points_value > 0 && wasAlreadyMissed) {
          // Was missed → now completed: still award points (they came back)
          await db.execute(
            `INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
             VALUES (?, ?, 'event', ?, ?)`,
            [ev.points_value, `Completed (late check-in): ${ev.title}`, ev.id, entryDate]
          );
        }
      } else {
        // Non-recurring event
        if (ev.event_status === "completed") return;

        await db.execute(
          `UPDATE events SET event_status='completed', updated_at=datetime('now') WHERE id=?`,
          [ev.id]
        );

        if (ev.award_points && ev.points_value > 0) {
          await db.execute(
            `INSERT INTO points_log (points, reason, source_type, source_id, entry_date)
             VALUES (?, ?, 'event', ?, ?)`,
            [ev.points_value, `Completed: ${ev.title}`, ev.id, entryDate]
          );
        }
      }

      // ── Auto check-in linked habit goals ─────────────────────────────────
      // If any active Habit goals are linked to this event's type, log a success check-in
      try {
        interface LinkedGoal {
          id: number; title: string; streak_current: number; streak_best: number;
          streak_mode: string; cheat_days_per_week: number;
        }
        const linkedGoals = await db.select<LinkedGoal[]>(
          `SELECT g.id, g.title, g.streak_current, g.streak_best, g.streak_mode, g.cheat_days_per_week
           FROM goal_event_links gl
           JOIN goals g ON g.id = gl.goal_id
           WHERE gl.event_type = ? AND g.status = 'active' AND g.goal_type = 'habit'`,
          [ev.event_type]
        );
        for (const g of linkedGoals) {
          // Only auto check-in if not already checked in today
          const existing = await db.select<[{ count: number }]>(
            `SELECT COUNT(*) as count FROM goal_check_ins WHERE goal_id=? AND check_in_date=?`,
            [g.id, entryDate]
          );
          if (existing[0].count > 0) continue;
          const newStreak = g.streak_current + 1;
          const newBest   = Math.max(newStreak, g.streak_best);
          await db.execute(
            `INSERT INTO goal_check_ins (goal_id, check_in_date, is_success, is_cheat_day, notes, points_awarded) VALUES (?,?,1,0,?,7)`,
            [g.id, entryDate, `Auto: ${ev.title}`]
          );
          await db.execute(
            `UPDATE goals SET streak_current=?, streak_best=?, last_check_in_date=? WHERE id=?`,
            [newStreak, newBest, entryDate, g.id]
          );
          await db.execute(
            `INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (7,?,'check_in',?,?)`,
            [`🔥 Auto check-in via ${ev.title}: ${g.title}`, g.id, entryDate]
          );
          addTodayPoints(7);
          const bonus = STREAK_BONUS_THRESHOLDS.find(b => b.days === newStreak);
          if (bonus) {
            await db.execute(
              `INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (?,?,'streak_bonus',?,?)`,
              [bonus.pts, `⚡ ${bonus.label}: ${g.title}`, g.id, entryDate]
            );
            addTodayPoints(bonus.pts);
          }
        }
      } catch (linkErr) { console.error("linked goal check-in error", linkErr); }

      viewMode === "month" ? loadMonthData() : loadWeekData();
    } catch (e) { console.error("markEventComplete error", e); }
  }

  // ─── Skip / unskip a single recurring occurrence ───────────────────────────
  async function skipOccurrence(ev: CalEvent) {
    try {
      const db = await getDb();
      const occurrenceDate = ev.start_datetime.split(" ")[0];
      await db.execute(
        `INSERT OR REPLACE INTO event_occurrences (event_id, occurrence_date, status, points_awarded)
         VALUES (?, ?, 'skipped', 0)`,
        [ev.id, occurrenceDate]
      );
      closeModal();
      viewMode === "month" ? loadMonthData() : loadWeekData();
    } catch (e) { console.error("skipOccurrence error", e); }
  }

  async function unskipOccurrence(ev: CalEvent) {
    try {
      const db = await getDb();
      const occurrenceDate = ev.start_datetime.split(" ")[0];
      await db.execute(
        `DELETE FROM event_occurrences WHERE event_id=? AND occurrence_date=?`,
        [ev.id, occurrenceDate]
      );
      closeModal();
      viewMode === "month" ? loadMonthData() : loadWeekData();
    } catch (e) { console.error("unskipOccurrence error", e); }
  }

  // ─── Quick outcome (from "What happened?" banner in edit modal) ────────────
  async function quickMarkOutcome(ev: CalEvent, status: "missed" | "rescheduled" | "cancelled", reason: string) {
    try {
      const db = await getDb();
      const occurrenceDate = ev.start_datetime.split(" ")[0];
      const cleanReason = reason.trim() || null;
      if (ev._is_virtual) {
        // Recurring: write to event_occurrences so only this occurrence is affected
        await db.execute(
          `INSERT OR REPLACE INTO event_occurrences (event_id, occurrence_date, status, points_awarded)
           VALUES (?, ?, ?, 0)`,
          [ev.id, occurrenceDate, status]
        );
        // Store reason on the occurrence via a separate update isn't available without schema change,
        // so also update the master event's status_reason as a best effort for single-occ display
      } else {
        await db.execute(
          `UPDATE events SET event_status=?, status_reason=?, updated_at=datetime('now') WHERE id=?`,
          [status, cleanReason, ev.id]
        );
      }
      closeModal();
      viewMode === "month" ? loadMonthData() : loadWeekData();
    } catch (e) { console.error("quickMarkOutcome error", e); }
  }

  // ─── Event CRUD ────────────────────────────────────────────────────────────
  async function saveEvent() {
    if (!form.title.trim() || !form.date) return;
    try {
      const db = await getDb();
      const startDt = form.all_day ? form.date : `${form.date} ${form.start_time || "00:00"}`;
      const endDt   = form.all_day ? null : form.end_time ? `${form.date} ${form.end_time}` : null;
      const color   = typeColor(form.event_type);
      const status  = form.event_status || "active";
      const reason  = (status === "active" || status === "completed") ? null : (form.status_reason.trim() || null);
      const awardPts = form.award_points ? 1 : 0;
      const ptsVal   = form.award_points ? Math.max(1, form.points_value) : 0;

      let recurrenceJson: string | null = null;
      if (form.recurrence_type === "annual") {
        recurrenceJson = JSON.stringify({ type: "annual" });
      } else if (form.recurrence_type === "weekly" && form.recurrence_days.length > 0) {
        const recObj: { type: string; days: number[]; end_date?: string } = {
          type: "weekly",
          days: [...form.recurrence_days].sort((a, b) => a - b),
        };
        if (form.recurrence_end_date) recObj.end_date = form.recurrence_end_date;
        recurrenceJson = JSON.stringify(recObj);
      }

      if (editEvent) {
        await db.execute(
          `UPDATE events SET title=?,description=?,event_type=?,start_datetime=?,
           end_datetime=?,all_day=?,color=?,event_status=?,status_reason=?,recurrence=?,
           award_points=?,points_value=?,updated_at=datetime('now') WHERE id=?`,
          [form.title.trim(), form.description||null, form.event_type,
           startDt, endDt, form.all_day?1:0, color, status, reason,
           recurrenceJson, awardPts, ptsVal, editEvent.id]
        );
      } else {
        await db.execute(
          `INSERT INTO events(title,description,event_type,start_datetime,end_datetime,
           all_day,color,event_status,status_reason,recurrence,award_points,points_value)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          [form.title.trim(), form.description||null, form.event_type,
           startDt, endDt, form.all_day?1:0, color, status, reason,
           recurrenceJson, awardPts, ptsVal]
        );
      }
      closeModal();
      viewMode === "month" ? loadMonthData() : loadWeekData();
    } catch (e) { console.error("Save event error", e); }
  }

  async function deleteEvent(id: number) {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM events WHERE id=?", [id]);
      viewMode === "month" ? loadMonthData() : loadWeekData();
    } catch (e) { console.error("Delete event error", e); }
  }

  // ─── Modal helpers ─────────────────────────────────────────────────────────
  function openNewEvent(date?: string, time?: string) {
    setEditEvent(null);
    const d    = date ?? selectedDay;
    const t    = time ?? "";
    const defType = "appointment";
    const defAward = AWARD_POINTS_TYPES.includes(defType);
    setForm({
      title:"", description:"", event_type: defType,
      date:d, start_time:t, end_time:"", all_day:!t,
      event_status:"active", status_reason:"",
      recurrence_type:"none", recurrence_days:[], recurrence_end_date:"",
      want_reschedule: true,
      award_points: defAward,
      points_value: 10,
    });
    setShowModal(true);
  }

  function openEditEvent(ev: CalEvent, defaultStatus?: string) {
    if (ev._is_holiday) return;   // holidays are read-only
    setQuickOutcome(null); setQuickReason("");
    setEditEvent(ev);
    const masterDt = ev._series_start ?? ev.start_datetime;
    const [date, startTime=""] = masterDt.split(" ");
    const endTime = ev.end_datetime ? ev.end_datetime.split(" ")[1] ?? "" : "";

    let recType: "none" | "weekly" | "annual" = "none";
    let recDays: number[] = [];
    let recEndDate = "";
    if (ev.recurrence) {
      try {
        const rec = JSON.parse(ev.recurrence);
        if (rec.type === "annual")       recType = "annual";
        else if (rec.type === "weekly")  recType = "weekly";
        recDays    = Array.isArray(rec.days) ? rec.days : [];
        recEndDate = rec.end_date ?? "";
      } catch { /* ignore */ }
    }

    setForm({
      title: ev.title, description: ev.description??"", event_type: ev.event_type,
      date, start_time: startTime, end_time: endTime, all_day: ev.all_day===1,
      event_status: defaultStatus ?? ev.event_status ?? "active",
      status_reason: ev.status_reason || "",
      recurrence_type: recType,
      recurrence_days: recDays,
      recurrence_end_date: recEndDate,
      want_reschedule: false,
      award_points: ev.award_points === 1,
      points_value: ev.points_value > 0 ? ev.points_value : 10,
    });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditEvent(null); setQuickOutcome(null); setQuickReason(""); }

  function toggleRecurDay(d: number) {
    setForm(f => ({
      ...f,
      recurrence_days: f.recurrence_days.includes(d)
        ? f.recurrence_days.filter(x => x !== d)
        : [...f.recurrence_days, d],
    }));
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  function prev()    { viewMode === "month" ? setMonthStart(addMonths(monthStart,-1)) : setWeekStart(addDays(weekStart,-7)); }
  function next()    { viewMode === "month" ? setMonthStart(addMonths(monthStart, 1)) : setWeekStart(addDays(weekStart, 7)); }
  function goToday() { setWeekStart(getWeekStart(new Date())); setMonthStart(getMonthStart(new Date())); setSelectedDay(toDateStr(new Date())); }

  // ─── Item getters ──────────────────────────────────────────────────────────
  function getItemsForDay(d: string): DayItem[] {
    return [
      ...events.filter(e =>
        e.start_datetime.startsWith(d) &&
        (e as CalEvent)._occurrence_status !== "skipped"
      ),
      ...tasks.filter(t => t.scheduled_date === d),
    ];
  }
  function getTimedForDay(d: string)  { return getItemsForDay(d).filter(i => i.source==="task" ? !!(i as CalTask).scheduled_time : i.all_day===0); }
  function getAllDayForDay(d: string)  { return getItemsForDay(d).filter(i => i.source==="task" ? !(i as CalTask).scheduled_time   : i.all_day===1); }

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`,
    color: theme.textPrimary, borderRadius: 10, padding: "8px 12px",
    fontSize: "0.875rem", width: "100%", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    color: theme.textSecondary, fontSize: "0.75rem", fontWeight: 600,
    display: "block", marginBottom: 4,
  };

  const dayItems    = getTimedForDay(selectedDay);
  const allDayItems = getAllDayForDay(selectedDay);
  const selDayObj   = new Date(selectedDay + "T12:00:00");

  // ─── Render: timed block (day view) ────────────────────────────────────────
  function renderTimeBlock(item: DayItem, idx: number) {
    if (item.source === "event" && (item as CalEvent)._is_holiday) return null;
    let startHour: number, endHour: number, color: string, title: string;
    if (item.source === "event") {
      const [, t1=""] = item.start_datetime.split(" ");
      const [, t2=""] = item.end_datetime?.split(" ") ?? [];
      startHour = parseTime(t1) || DAY_START;
      endHour   = t2 ? parseTime(t2) : startHour + 1;
      color = typeColor(item.event_type); title = item.title;
    } else {
      startHour = item.scheduled_time ? parseTime(item.scheduled_time) : DAY_START;
      endHour   = startHour + 0.75;
      color = priorityColor(item.priority); title = item.title;
    }
    const cs = Math.max(startHour, DAY_START), ce = Math.min(endHour, DAY_END);
    if (ce <= cs) return null;
    const top = (cs - DAY_START) * HOUR_HEIGHT, height = Math.max((ce - cs) * HOUR_HEIGHT, 28);

    const evStatus       = item.source === "event" ? (item.event_status || "active") : "active";
    const isCompleted    = evStatus === "completed";
    const isAffectedNeg  = ["cancelled", "rescheduled", "missed"].includes(evStatus);
    const isPastUnres    = item.source === "event" && evStatus === "active"
      && selectedDay <= today && hasEventStarted(item as CalEvent, selectedDay, today);
    const statusMeta  = EVENT_STATUSES.find(s => s.value === evStatus);
    const blockColor  = isCompleted ? "#10b981"
      : isAffectedNeg ? (statusMeta?.color ?? color)
      : isPastUnres ? "#f59e0b"
      : color;
    const isRecurring = item.source === "event" && !!(item as CalEvent).recurrence;

    return (
      <div key={`${item.source}-${item.id}-${idx}`}
        style={{ position:"absolute", top, left:2, width:"calc(100% - 4px)", height,
          background: isCompleted ? "#10b98115" : isAffectedNeg ? `${blockColor}14` : isPastUnres ? "#f59e0b0e" : `${color}20`,
          border:`1px solid ${blockColor}44`, borderLeft:`3px solid ${blockColor}`,
          borderRadius:8, padding:"4px 8px", overflow:"hidden", zIndex:10+idx,
          opacity: isAffectedNeg ? 0.72 : 1, transition:"opacity 0.15s",
          cursor: item.source === "event" ? "pointer" : "default" }}>
        {/* Main click → edit modal */}
        <div onClick={() => item.source === "event" && openEditEvent(item as CalEvent)}
          style={{ position:"absolute", inset:0, zIndex:1 }}
          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.06)")}
          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")} />
        <div style={{ position:"relative", zIndex:2, pointerEvents:"none" }}>
          <div style={{ color: blockColor, fontSize:"0.73rem", fontWeight:700, lineHeight:1.3,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            textDecoration: isAffectedNeg ? "line-through" : "none" }}>
            {item.source==="task" ? "✓ " : ""}
            {isRecurring && <RefreshCw size={9} style={{ display:"inline", marginRight:3, opacity:0.7 }} />}
            {title}
            {(isCompleted || isAffectedNeg) && statusMeta && (
              <span style={{ marginLeft:4, fontSize:"0.65rem", fontWeight:600, textDecoration:"none", opacity:0.9 }}>
                {statusMeta.emoji}
              </span>
            )}
          </div>
          {height >= 40 && (
            <div style={{ color:blockColor, opacity:0.75, fontSize:"0.62rem", marginTop:2 }}>
              {item.source==="event" && item.start_datetime.split(" ")[1]
                ? formatTime12(item.start_datetime.split(" ")[1])
                : item.source==="task" && (item as CalTask).scheduled_time
                ? formatTime12((item as CalTask).scheduled_time!)
                : ""}
              {item.source==="event" && item.end_datetime?.split(" ")[1]
                ? ` – ${formatTime12(item.end_datetime.split(" ")[1])}` : ""}
            </div>
          )}
        </div>
        {/* Quick Done button — only once the event has started */}
        {item.source === "event" && evStatus === "active" && height >= 36
          && selectedDay <= today && hasEventStarted(item as CalEvent, selectedDay, today) && (
          <button
            onClick={e => { e.stopPropagation(); markEventComplete(item as CalEvent); }}
            style={{ position:"absolute", bottom:4, right:4, zIndex:3,
              display:"flex", alignItems:"center", gap:3, padding:"2px 6px",
              borderRadius:6, border:"none", cursor:"pointer", fontSize:"0.6rem", fontWeight:700,
              background:"#10b98130", color:"#10b981" }}>
            <CheckCircle size={9} />
            Done{(item as CalEvent).award_points ? ` +${(item as CalEvent).points_value}` : ""}
          </button>
        )}
      </div>
    );
  }

  // ─── Week list: one day row ─────────────────────────────────────────────────
  function renderWeekListDay(day: Date) {
    const dateStr = toDateStr(day);
    const items   = getItemsForDay(dateStr);
    const isToday = dateStr === today;
    const isPast  = dateStr < today;

    return (
      <div key={dateStr} style={{ marginBottom: 14 }}>
        {/* Day label */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
          marginBottom:6, borderRadius:12,
          background: isToday ? theme.accent : "transparent",
          borderBottom: isToday ? "none" : `1px solid ${theme.bgCardBorder}`,
        }}>
          <span style={{ fontWeight:700, fontSize:"0.95rem",
            color: isToday ? "#fff" : isPast ? theme.textMuted : theme.textPrimary }}>
            {DAY_NAMES_LONG[day.getDay()]}
          </span>
          <span style={{ fontSize:"0.82rem",
            color: isToday ? "rgba(255,255,255,0.75)" : theme.textMuted }}>
            {MONTH_NAMES[day.getMonth()]} {day.getDate()}
          </span>
          {isToday && (
            <span style={{ fontSize:"0.7rem", fontWeight:700, borderRadius:20, padding:"2px 8px",
              background:"rgba(255,255,255,0.2)", color:"#fff" }}>TODAY</span>
          )}
          <button onClick={() => openNewEvent(dateStr)} style={{ marginLeft:"auto",
            display:"flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:8,
            fontSize:"0.72rem", fontWeight:600, border:"none", cursor:"pointer",
            background: isToday ? "rgba(255,255,255,0.18)" : theme.accentLight,
            color: isToday ? "#fff" : theme.accent }}>
            <Plus size={11} /> Add
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <p style={{ color:theme.textMuted, fontSize:"0.78rem", fontStyle:"italic",
            padding:"4px 14px 0", margin:0 }}>Nothing scheduled</p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:5, padding:"0 4px" }}>
            {items.map(item => {
              if (item.source === "event" && (item as CalEvent)._is_holiday) {
                return (
                  <div key={`holiday-${item.id}-${item.start_datetime}`}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px",
                      borderRadius:8, background:"#f59e0b0d",
                      border:"1px solid #f59e0b25", borderLeft:"3px solid #f59e0b60" }}>
                    <span style={{ fontSize:"0.72rem", color:"#f59e0b", fontWeight:700,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize:"0.62rem", color:"#f59e0b80", fontWeight:600,
                      flexShrink:0, background:"#f59e0b15", padding:"1px 6px", borderRadius:10 }}>
                      Holiday
                    </span>
                  </div>
                );
              }
              if (item.source === "event") {
                const time = item.all_day ? "All day"
                  : item.start_datetime.split(" ")[1] ? formatTime12(item.start_datetime.split(" ")[1]) : "";
                const evColor       = typeColor(item.event_type);
                const evStatus      = item.event_status || "active";
                const isCompleted   = evStatus === "completed";
                const isAffectedNeg = ["cancelled", "rescheduled", "missed"].includes(evStatus);
                const statusMeta    = EVENT_STATUSES.find(s => s.value === evStatus);
                const isRecurring   = !!item.recurrence;
                const recLabel      = recurrenceLabel(item.recurrence);
                // Past event that hasn't been resolved yet — needs user action
                const isPastUnresolved = evStatus === "active"
                  && dateStr <= today
                  && hasEventStarted(item, dateStr, today);
                const borderColor = isCompleted   ? "#10b981"
                  : isAffectedNeg ? (statusMeta?.color ?? evColor)
                  : isPastUnresolved ? "#f59e0b"
                  : evColor;
                return (
                  <div key={`ev-${item.id}-${item.start_datetime}`}
                    onClick={() => openEditEvent(item)}
                    style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 14px",
                      borderRadius:10, cursor:"pointer",
                      opacity: isAffectedNeg ? 0.72 : 1,
                      background: isCompleted ? "#10b98110"
                        : isAffectedNeg ? theme.bgInput
                        : isPastUnresolved ? "#f59e0b08"
                        : `${evColor}12`,
                      border:`1px solid ${isCompleted ? "#10b98140"
                        : isAffectedNeg ? theme.bgCardBorder
                        : isPastUnresolved ? "#f59e0b35"
                        : `${evColor}30`}`,
                      borderLeft:`3px solid ${borderColor}` }}>
                    <span style={{ color: (isCompleted ? "#10b981" : isAffectedNeg ? theme.textMuted : evColor),
                      fontSize:"0.75rem", flexShrink:0, marginTop:1 }}>
                      <Clock size={12} style={{ display:"inline", marginRight:4 }} />{time}
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontWeight:600, fontSize:"0.86rem",
                        color: isAffectedNeg ? theme.textMuted : theme.textPrimary,
                        textDecoration: isAffectedNeg ? "line-through" : "none",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>
                        {item.title}
                      </span>
                      {isRecurring && !isCompleted && !isAffectedNeg && (
                        <span style={{ fontSize:"0.68rem", color:theme.textMuted, display:"flex", alignItems:"center", gap:3, marginTop:2 }}>
                          <RefreshCw size={9} /> {recLabel}
                        </span>
                      )}
                      {isAffectedNeg && item.status_reason && (
                        <span style={{ fontSize:"0.7rem", color:theme.textMuted, fontStyle:"italic" }}>
                          {item.status_reason}
                        </span>
                      )}
                      {isCompleted && item.award_points === 1 && (
                        <span style={{ fontSize:"0.68rem", color:"#10b981", fontWeight:600 }}>
                          +{item.points_value} pts earned
                        </span>
                      )}
                    </div>

                    {/* Status badge or Mark Done button */}
                    {isCompleted ? (
                      <span style={{ fontSize:"0.68rem", padding:"2px 8px", borderRadius:7, flexShrink:0,
                        background:"#10b98120", color:"#10b981", fontWeight:700 }}>
                        ✅ Done
                      </span>
                    ) : isAffectedNeg ? (
                      <span style={{ fontSize:"0.68rem", padding:"2px 8px", borderRadius:7, flexShrink:0,
                        background:`${statusMeta?.color}20`, color:statusMeta?.color, fontWeight:700 }}>
                        {statusMeta?.emoji} {statusMeta?.label}
                      </span>
                    ) : isPastUnresolved ? (
                      /* Past unresolved — user must pick what happened */
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}
                        onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => markEventComplete(item)}
                          style={{ display:"flex", alignItems:"center", gap:3, padding:"4px 9px",
                            borderRadius:7, border:"none", cursor:"pointer",
                            background:"#10b98118", color:"#10b981",
                            fontSize:"0.68rem", fontWeight:700, whiteSpace:"nowrap" }}>
                          <CheckCircle size={11} />
                          Done{item.award_points === 1 ? ` +${item.points_value}` : ""}
                        </button>
                        <div style={{ display:"flex", gap:4 }}>
                          <button
                            onClick={() => openEditEvent(item, "missed")}
                            style={{ padding:"3px 7px", borderRadius:7, border:"none",
                              cursor:"pointer", background:"#6b728018", color:"#6b7280",
                              fontSize:"0.65rem", fontWeight:700 }}>
                            😬 Missed
                          </button>
                          <button
                            onClick={() => openEditEvent(item, "rescheduled")}
                            style={{ padding:"3px 7px", borderRadius:7, border:"none",
                              cursor:"pointer", background:"#f59e0b18", color:"#f59e0b",
                              fontSize:"0.65rem", fontWeight:700 }}>
                            🔄 Reschedule
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Future / not-yet-started — just show the type badge */
                      <span style={{ fontSize:"0.7rem", padding:"2px 8px", borderRadius:7,
                        background:`${evColor}20`, color:evColor, flexShrink:0 }}>
                        {item.event_type}
                      </span>
                    )}
                  </div>
                );
              } else {
                const task = item as CalTask;
                const pc = priorityColor(task.priority);
                return (
                  <div key={`tk-${task.id}`}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
                      borderRadius:10,
                      background: task.status==="completed" ? theme.iconBg : `${pc}0e`,
                      border:`1px solid ${task.status==="completed" ? theme.bgCardBorder : `${pc}30`}`,
                      borderLeft:`3px solid ${task.status==="completed" ? theme.bgCardBorder : pc}`,
                      opacity: task.status==="completed" ? 0.6 : 1 }}>
                    <span style={{ fontSize:"0.72rem" }}>
                      {task.status==="completed" ? "✅" : "⬜"}
                    </span>
                    <span style={{ flex:1, fontWeight:600, fontSize:"0.86rem", color:theme.textPrimary,
                      textDecoration:task.status==="completed" ? "line-through" : "none",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {task.title}
                    </span>
                    {task.scheduled_time && (
                      <span style={{ color:theme.textMuted, fontSize:"0.75rem", flexShrink:0 }}>
                        {formatTime12(task.scheduled_time)}
                      </span>
                    )}
                    <span style={{ fontSize:"0.68rem", padding:"2px 8px", borderRadius:20,
                      background:`${pc}20`, color:pc, flexShrink:0 }}>
                      {task.priority}
                    </span>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Month view ────────────────────────────────────────────────────────────
  function renderMonthView() {
    const gridStart  = addDays(monthStart, -monthStart.getDay());
    const cells      = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const curMonth   = monthStart.getMonth();

    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", background:theme.bgCard }}>
        {/* DoW header */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)",
          borderBottom:`1px solid ${theme.bgCardBorder}`, flexShrink:0 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ padding:"7px 0", textAlign:"center", color:theme.textMuted,
              fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>
              {d}
            </div>
          ))}
        </div>

        {/* 6-week grid */}
        <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7, 1fr)",
          gridTemplateRows:"repeat(6, 1fr)", overflow:"hidden" }}>
          {cells.map(day => {
            const dateStr     = toDateStr(day);
            const isToday     = dateStr === today;
            const isSelected  = dateStr === selectedDay;
            const isCurMonth  = day.getMonth() === curMonth;
            const items       = getItemsForDay(dateStr);
            const visible     = items.slice(0, 3);
            const extra       = items.length - 3;

            return (
              <div key={dateStr}
                onClick={() => { setSelectedDay(dateStr); setWeekStart(getWeekStart(day)); setViewMode("day"); }}
                onMouseEnter={e => { if (!isSelected && !isToday) (e.currentTarget as HTMLDivElement).style.background = `${theme.accent}0c`; }}
                onMouseLeave={e => { if (!isSelected && !isToday) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                style={{ borderRight:`1px solid ${theme.bgCardBorder}`,
                  borderBottom:`1px solid ${theme.bgCardBorder}`,
                  padding:"10px 8px 6px", cursor:"pointer", overflow:"hidden",
                  display:"flex", flexDirection:"column", gap:3,
                  background: isSelected ? `${theme.accent}1a` : isToday ? theme.accentLight : "transparent",
                  transition:"background 0.1s" }}>

                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <span style={{ fontSize:"0.75rem",
                    fontWeight: isToday ? 800 : isCurMonth ? 600 : 400,
                    color: isToday ? "#fff" : isCurMonth ? theme.textPrimary : theme.textMuted,
                    background: isToday ? theme.accent : "transparent",
                    borderRadius:"50%", width:22, height:22,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {day.getDate()}
                  </span>
                </div>

                {visible.map(item => {
                  const evStatus = item.source === "event" ? (item.event_status || "active") : null;
                  const isComp   = evStatus === "completed";
                  const color = isComp ? "#10b981" :
                    item.source==="event" ? typeColor((item as CalEvent).event_type)
                    : priorityColor((item as CalTask).priority);
                  const isRec = item.source === "event" && !!(item as CalEvent).recurrence;
                  return (
                    <div key={`${item.source}-${item.id}-${item.source==="event" ? (item as CalEvent).start_datetime : ""}`}
                      style={{ fontSize:"0.6rem", fontWeight:600, padding:"1px 4px", borderRadius:3,
                        background:`${color}22`, color, borderLeft:`2px solid ${color}`,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.5,
                        display:"flex", alignItems:"center", gap:2 }}>
                      {isRec && <RefreshCw size={7} style={{ flexShrink:0 }} />}
                      {isComp && "✅ "}
                      {item.source==="task" ? "✓ " : ""}{item.title}
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div style={{ fontSize:"0.58rem", color:theme.textMuted, paddingLeft:2 }}>
                    +{extra} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Header label ──────────────────────────────────────────────────────────
  const headerLabel = viewMode === "month"
    ? `${MONTH_NAMES[monthStart.getMonth()]} ${monthStart.getFullYear()}`
    : `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  const isEditingRecurring = !!(editEvent?.recurrence);

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 140px)" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:10, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Calendar size={24} style={{ color:theme.accent }} />
          <div>
            <h1 style={{ color:theme.textPrimary, fontSize:"1.6rem", fontWeight:700, margin:0 }}>
              Time Management
            </h1>
            <p style={{ color:theme.textMuted, fontSize:"0.78rem", margin:"2px 0 0" }}>
              {headerLabel}
            </p>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {/* View toggle */}
          <div style={{ display:"flex", padding:3, borderRadius:11, gap:2,
            background:theme.iconBg, border:`1px solid ${theme.bgCardBorder}` }}>
            {([
              { v:"week"  as ViewMode, icon:<AlignLeft size={12}/>,    label:"Week"  },
              { v:"month" as ViewMode, icon:<CalendarDays size={12}/>,  label:"Month" },
              { v:"day"   as ViewMode, icon:<LayoutGrid size={12}/>,   label:"Day"   },
            ]).map(btn => (
              <button key={btn.v} onClick={() => setViewMode(btn.v)}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px",
                  borderRadius:8, fontSize:"0.73rem", fontWeight:600, border:"none", cursor:"pointer",
                  background: viewMode===btn.v ? theme.accent : "transparent",
                  color: viewMode===btn.v ? "#fff" : theme.textMuted,
                  transition:"all 0.15s" }}>
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button onClick={prev} style={{ padding:"5px 7px", borderRadius:9,
            border:`1px solid ${theme.bgCardBorder}`, background:theme.iconBg,
            color:theme.textMuted, cursor:"pointer" }}>
            <ChevronLeft size={15} />
          </button>
          <button onClick={goToday} style={{ padding:"5px 11px", borderRadius:9,
            fontSize:"0.75rem", fontWeight:600, cursor:"pointer",
            background:theme.accentLight, color:theme.accent,
            border:`1px solid ${theme.bgCardBorder}` }}>
            Today
          </button>
          <button onClick={next} style={{ padding:"5px 7px", borderRadius:9,
            border:`1px solid ${theme.bgCardBorder}`, background:theme.iconBg,
            color:theme.textMuted, cursor:"pointer" }}>
            <ChevronRight size={15} />
          </button>

          {/* Add event */}
          <button onClick={() => openNewEvent(selectedDay)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px",
              borderRadius:9, fontSize:"0.8rem", fontWeight:600, border:"none", cursor:"pointer",
              background:theme.accentGradient, color:"#fff" }}>
            <Plus size={14} /> Add Event
          </button>
        </div>
      </div>

      {/* ── Week strip — hidden in month mode ── */}
      {viewMode !== "month" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4,
          marginBottom:12, padding:8, borderRadius:16, flexShrink:0,
          background:theme.bgCard, border:`1px solid ${theme.bgCardBorder}` }}>
          {weekDays.map(day => {
            const dateStr    = toDateStr(day);
            const isToday    = dateStr === today;
            const isSelected = dateStr === selectedDay;
            const count      = getItemsForDay(dateStr).length;
            return (
              <button key={dateStr}
                onClick={() => { setSelectedDay(dateStr); setViewMode("day"); }}
                style={{ display:"flex", flexDirection:"column", alignItems:"center",
                  padding:"10px 4px", borderRadius:12, border:"none", cursor:"pointer",
                  background: isSelected ? theme.accent : isToday ? theme.accentLight : "transparent",
                  outline: isToday && !isSelected ? `1px solid ${theme.accent}` : "none",
                  transition:"all 0.12s" }}>
                <span style={{ fontSize:"0.7rem", letterSpacing:"0.04em", fontWeight:600,
                  color: isSelected ? "rgba(255,255,255,0.7)" : theme.textMuted }}>
                  {DAY_NAMES[day.getDay()]}
                </span>
                <span style={{ fontSize:"1.15rem", fontWeight:700, lineHeight:1.4,
                  color: isSelected ? "#fff" : isToday ? theme.accent : theme.textPrimary }}>
                  {day.getDate()}
                </span>
                {count > 0 ? (
                  <span style={{ marginTop:3, width:18, height:18, borderRadius:"50%",
                    fontSize:"0.6rem", fontWeight:700,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background: isSelected ? "rgba(255,255,255,0.25)" : theme.accentLight,
                    color: isSelected ? "#fff" : theme.accent }}>
                    {count}
                  </span>
                ) : <span style={{ height:18 }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content area ── */}
      <div style={{ flex:1, overflow:"hidden", borderRadius:14,
        border:`1px solid ${theme.bgCardBorder}` }}>

        {/* ── WEEK LIST ── */}
        {viewMode === "week" && (
          <div style={{ height:"100%", overflowY:"auto", padding:"16px 14px",
            background:theme.bgCard }}>
            {weekDays.map(renderWeekListDay)}
          </div>
        )}

        {/* ── MONTH GRID ── */}
        {viewMode === "month" && renderMonthView()}

        {/* ── DAY / TIME GRID ── */}
        {viewMode === "day" && (
          <div style={{ height:"100%", display:"flex", flexDirection:"column", background:theme.bgCard }}>
            {/* Sub-header */}
            <div style={{ padding:"8px 14px", flexShrink:0, display:"flex",
              alignItems:"center", justifyContent:"space-between",
              borderBottom:`1px solid ${theme.bgCardBorder}` }}>
              <div>
                <h2 style={{ color:theme.textPrimary, fontSize:"0.98rem", fontWeight:700, margin:0 }}>
                  {DAY_NAMES_LONG[selDayObj.getDay()]}, {MONTH_NAMES[selDayObj.getMonth()]} {selDayObj.getDate()}
                  {selectedDay === today && (
                    <span style={{ marginLeft:8, padding:"1px 8px", borderRadius:20,
                      fontSize:"0.65rem", fontWeight:700, background:theme.accent, color:"#fff" }}>
                      TODAY
                    </span>
                  )}
                </h2>
                <p style={{ color:theme.textMuted, fontSize:"0.72rem", margin:"1px 0 0" }}>
                  {dayItems.length + allDayItems.length} item{dayItems.length + allDayItems.length !== 1 ? "s" : ""} scheduled
                </p>
              </div>
              <button onClick={() => openNewEvent(selectedDay)}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px",
                  borderRadius:9, fontSize:"0.72rem", fontWeight:600, cursor:"pointer", border:"none",
                  background:theme.accentLight, color:theme.accent }}>
                <Plus size={12} /> Add Event
              </button>
            </div>

            {/* All-day strip */}
            {allDayItems.length > 0 && (
              <div style={{ padding:"5px 12px", flexShrink:0, display:"flex", flexWrap:"wrap", gap:5,
                borderBottom:`1px solid ${theme.bgCardBorder}`, background:theme.iconBg }}>
                <span style={{ color:theme.textMuted, fontSize:"0.64rem", alignSelf:"center", marginRight:3 }}>
                  ALL DAY
                </span>
                {allDayItems.map(item => {
                  if (item.source === "event" && (item as CalEvent)._is_holiday) {
                    return (
                      <span key={`holiday-${item.id}`}
                        style={{ padding:"2px 8px", borderRadius:7, fontSize:"0.7rem", fontWeight:600,
                          background:"#f59e0b15", color:"#f59e0b", border:"1px dashed #f59e0b50",
                          cursor:"default" }}>
                        {item.title}
                      </span>
                    );
                  }
                  const color = item.source==="event" ? typeColor((item as CalEvent).event_type) : priorityColor((item as CalTask).priority);
                  return (
                    <span key={`${item.source}-${item.id}`}
                      onClick={() => item.source==="event" && openEditEvent(item as CalEvent)}
                      style={{ padding:"2px 8px", borderRadius:7, fontSize:"0.7rem", fontWeight:600,
                        background:`${color}22`, color, border:`1px solid ${color}40`, cursor:"pointer" }}>
                      {item.source==="task" ? "✓ " : ""}{item.title}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Time grid */}
            <div style={{ flex:1, overflowY:"auto" }} ref={gridRef}>
              <div style={{ display:"flex", minHeight:TOTAL_HOURS * HOUR_HEIGHT }}>
                {/* Hour labels */}
                <div style={{ width:50, flexShrink:0 }}>
                  {Array.from({ length: TOTAL_HOURS + 1 }, (_,i) => (
                    <div key={i} style={{ height:HOUR_HEIGHT, display:"flex",
                      alignItems:"flex-start", paddingTop:4, paddingRight:8,
                      justifyContent:"flex-end", color:theme.textMuted, fontSize:"0.6rem" }}>
                      {i < TOTAL_HOURS ? formatHour(DAY_START + i) : ""}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div style={{ flex:1, position:"relative" }}>
                  {Array.from({ length: TOTAL_HOURS + 1 }, (_,i) => (
                    <div key={i} style={{ position:"absolute", top:i*HOUR_HEIGHT, left:0, right:0,
                      borderTop:`1px solid ${theme.bgCardBorder}`, zIndex:1 }} />
                  ))}
                  {Array.from({ length: TOTAL_HOURS }, (_,i) => (
                    <div key={`h-${i}`} style={{ position:"absolute",
                      top:i*HOUR_HEIGHT + HOUR_HEIGHT/2, left:0, right:0,
                      borderTop:`1px dashed ${theme.bgCardBorder}`, opacity:0.4, zIndex:1 }} />
                  ))}
                  {selectedDay === today && (() => {
                    const now = new Date(), nowH = now.getHours() + now.getMinutes()/60;
                    if (nowH >= DAY_START && nowH < DAY_END) return (
                      <div style={{ position:"absolute", top:(nowH-DAY_START)*HOUR_HEIGHT-1,
                        left:0, right:0, height:2, background:theme.accent, zIndex:20, borderRadius:1 }}>
                        <div style={{ position:"absolute", left:-4, top:-4, width:10, height:10,
                          borderRadius:"50%", background:theme.accent }} />
                      </div>
                    );
                    return null;
                  })()}
                  {Array.from({ length: TOTAL_HOURS * 2 }, (_,i) => {
                    const h = Math.floor(i/2) + DAY_START;
                    const m = i%2===0 ? "00" : "30";
                    return (
                      <div key={`slot-${i}`}
                        onClick={() => openNewEvent(selectedDay, `${String(h).padStart(2,"0")}:${m}`)}
                        style={{ position:"absolute", top:i*(HOUR_HEIGHT/2), left:0, right:0,
                          height:HOUR_HEIGHT/2, zIndex:5, cursor:"pointer" }}
                        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = `${theme.accent}0e`)}
                        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")} />
                    );
                  })}
                  <div style={{ position:"relative", height:TOTAL_HOURS*HOUR_HEIGHT }}>
                    {dayItems.map((item, idx) => renderTimeBlock(item, idx))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex",
          alignItems:"center", justifyContent:"center",
          background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)" }}>
          <div style={{ maxWidth:500, width:"100%", margin:"0 16px", maxHeight:"92vh",
            overflowY:"auto", borderRadius:22, padding:22, background:theme.bgCard,
            boxShadow:`0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px ${theme.bgCardBorder}` }}>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <h2 style={{ color:theme.textPrimary, fontSize:"1.1rem", fontWeight:700, margin:0 }}>
                {editEvent ? "✏️ Edit Event" : "📅 New Event"}
              </h2>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                {editEvent && (
                  <button
                    onClick={() => { setConfirmDeleteEvent(editEvent); }}
                    style={{ padding:"4px 6px", borderRadius:7, border:"none", cursor:"pointer",
                      color:"#ef4444", background:"#ef444420" }}>
                    <Trash2 size={14} />
                  </button>
                )}
                <button onClick={closeModal}
                  style={{ padding:"4px 6px", borderRadius:20, border:"none", cursor:"pointer",
                    color:theme.textMuted, background:theme.iconBg }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Recurring series notice */}
            {isEditingRecurring && (
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
                borderRadius:10, marginBottom:12,
                background: `${theme.accent}15`, border:`1px solid ${theme.accent}30` }}>
                <RefreshCw size={13} style={{ color:theme.accent, flexShrink:0 }} />
                <span style={{ color:theme.accent, fontSize:"0.75rem", fontWeight:600, flex:1 }}>
                  Editing affects all occurrences in this recurring series
                </span>
                {editEvent?._is_virtual && (
                  editEvent._occurrence_status === "skipped" ? (
                    <button onClick={() => unskipOccurrence(editEvent)}
                      style={{ padding:"3px 9px", borderRadius:20, cursor:"pointer", fontWeight:600,
                        fontSize:"0.68rem", whiteSpace:"nowrap", flexShrink:0,
                        border:"1px solid #10b981", background:"#10b98115", color:"#10b981" }}>
                      ↩ Restore
                    </button>
                  ) : (
                    <button onClick={() => skipOccurrence(editEvent)}
                      style={{ padding:"3px 9px", borderRadius:20, cursor:"pointer", fontWeight:600,
                        fontSize:"0.68rem", whiteSpace:"nowrap", flexShrink:0,
                        border:"1px solid #f9731680", background:"#f9731612", color:"#f97316" }}>
                      🏖 Skip date
                    </button>
                  )
                )}
              </div>
            )}

            {/* ── "What happened?" quick-outcome banner ── */}
            {editEvent && (form.event_status === "active" || !form.event_status) &&
              hasEventStarted(editEvent, editEvent.start_datetime.split(" ")[0], today) &&
              editEvent.start_datetime.split(" ")[0] <= today && (
              <div style={{ background:"#f59e0b12", border:"1px solid #f59e0b40",
                borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
                <p style={{ color:"#f59e0b", fontSize:"0.78rem", fontWeight:700, margin:"0 0 10px",
                  display:"flex", alignItems:"center", gap:6 }}>
                  ⚠️ This event is unresolved — what happened?
                </p>
                <div style={{ display:"flex", gap:6, marginBottom: quickOutcome && quickOutcome !== "completed" ? 10 : 0 }}>
                  <button
                    onClick={() => { markEventComplete(editEvent); closeModal(); }}
                    style={{ flex:1, padding:"7px 4px", borderRadius:9, border:"2px solid #10b981",
                      background:"#10b98115", color:"#10b981", cursor:"pointer",
                      fontWeight:700, fontSize:"0.78rem" }}>
                    ✅ Done
                  </button>
                  <button
                    onClick={() => setQuickOutcome(quickOutcome === "missed" ? null : "missed")}
                    style={{ flex:1, padding:"7px 4px", borderRadius:9,
                      border:`2px solid ${quickOutcome === "missed" ? "#6b7280" : "#6b728040"}`,
                      background: quickOutcome === "missed" ? "#6b728020" : "transparent",
                      color:"#6b7280", cursor:"pointer", fontWeight:700, fontSize:"0.78rem" }}>
                    😬 Missed
                  </button>
                  <button
                    onClick={() => setQuickOutcome(quickOutcome === "rescheduled" ? null : "rescheduled")}
                    style={{ flex:1, padding:"7px 4px", borderRadius:9,
                      border:`2px solid ${quickOutcome === "rescheduled" ? "#f59e0b" : "#f59e0b40"}`,
                      background: quickOutcome === "rescheduled" ? "#f59e0b15" : "transparent",
                      color:"#f59e0b", cursor:"pointer", fontWeight:700, fontSize:"0.78rem" }}>
                    🔄 Reschedule
                  </button>
                  {isEditingRecurring && editEvent?._is_virtual && (
                    <button
                      onClick={() => skipOccurrence(editEvent)}
                      style={{ flex:1, padding:"7px 4px", borderRadius:9,
                        border:"2px solid #f9731640", background:"transparent",
                        color:"#f97316", cursor:"pointer", fontWeight:700, fontSize:"0.78rem" }}>
                      🏖 Skip
                    </button>
                  )}
                </div>

                {/* Reason picker — shown when Missed or Rescheduled selected */}
                {(quickOutcome === "missed" || quickOutcome === "rescheduled") && (
                  <div style={{ marginTop:8 }}>
                    <p style={{ color:theme.textMuted, fontSize:"0.72rem", margin:"0 0 6px" }}>
                      Why? <span style={{ opacity:0.6 }}>(optional)</span>
                    </p>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                      {PRESET_REASONS.map(r => (
                        <button key={r}
                          onClick={() => setQuickReason(quickReason === r ? "" : r)}
                          style={{ padding:"4px 10px", borderRadius:20, fontSize:"0.72rem", fontWeight:600,
                            cursor:"pointer", border:"none",
                            background: quickReason === r ? theme.accent : theme.bgInput,
                            color: quickReason === r ? "#fff" : theme.textSecondary,
                            transition:"all 0.12s" }}>
                          {r}
                        </button>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <input
                        value={quickReason}
                        onChange={e => setQuickReason(e.currentTarget.value)}
                        placeholder="Or type a reason..."
                        style={{ flex:1, background:theme.bgInput, border:`1px solid ${theme.bgCardBorder}`,
                          borderRadius:8, padding:"7px 10px", color:theme.textPrimary,
                          fontSize:"0.8rem", outline:"none" }}
                      />
                      <button
                        onClick={() => quickMarkOutcome(editEvent, quickOutcome, quickReason)}
                        style={{ padding:"7px 16px", borderRadius:8, border:"none",
                          background: quickOutcome === "missed" ? "#6b7280" : "#f59e0b",
                          color:"#fff", cursor:"pointer", fontWeight:700, fontSize:"0.8rem",
                          whiteSpace:"nowrap" }}>
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
              {/* Title */}
              <div>
                <label style={labelStyle}>Event Title *</label>
                <input style={inputStyle} placeholder="What's happening?" value={form.title}
                  onChange={e => setForm({...form, title:e.target.value})} autoFocus />
              </div>

              {/* Type */}
              <div>
                <label style={labelStyle}>Event Type</label>
                <select style={inputStyle} value={form.event_type}
                  onChange={e => {
                    const newType = e.target.value;
                    if (newType === "birthday") {
                      setForm(f => ({ ...f, event_type: "birthday", award_points: false,
                        all_day: true, recurrence_type: "annual", recurrence_days: [] }));
                    } else {
                      const defaultAward = AWARD_POINTS_TYPES.includes(newType);
                      setForm(f => ({ ...f, event_type: newType, award_points: defaultAward,
                        recurrence_type: f.recurrence_type === "annual" ? "none" : f.recurrence_type }));
                    }
                  }}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Birthday reminder card — shown only when Birthday type is selected */}
              {form.event_type === "birthday" && (
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                  borderRadius:12, background:"#EC489910", border:"2px solid #EC489940" }}>
                  <span style={{ fontSize:"1.5rem", flexShrink:0 }}>🎂</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#EC4899", fontWeight:700, fontSize:"0.82rem" }}>
                      Repeats every year on this date
                    </div>
                    <div style={{ color:theme.textMuted, fontSize:"0.72rem", marginTop:2 }}>
                      This birthday will show up automatically each year so you never miss it
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0,
                    padding:"4px 10px", borderRadius:20,
                    background:"#EC489920", border:"1px solid #EC489960" }}>
                    <span style={{ fontSize:"0.68rem", color:"#EC4899", fontWeight:700 }}>🔔 Annual</span>
                  </div>
                </div>
              )}

              {/* ── Points toggle ── */}
              <div>
                <label style={labelStyle}>Points on Completion</label>
                <div
                  onClick={() => setForm(f => ({ ...f, award_points: !f.award_points }))}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                    borderRadius:10, cursor:"pointer",
                    background: form.award_points ? `${theme.accent}10` : theme.bgInput,
                    border:`1px solid ${form.award_points ? `${theme.accent}40` : theme.bgCardBorder}`,
                    transition:"all 0.15s" }}>
                  {/* Toggle pill */}
                  <div style={{ width:36, height:20, borderRadius:10, position:"relative", flexShrink:0,
                    background: form.award_points ? theme.accent : theme.progressBg, transition:"background 0.2s" }}>
                    <div style={{ position:"absolute", top:2,
                      left: form.award_points ? 18 : 2,
                      width:16, height:16, borderRadius:"50%", background:"#fff",
                      transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.25)" }} />
                  </div>
                  <div>
                    <div style={{ color:theme.textPrimary, fontSize:"0.83rem", fontWeight:600 }}>
                      Award points on completion
                    </div>
                    <div style={{ color:theme.textMuted, fontSize:"0.7rem", marginTop:1 }}>
                      {form.award_points
                        ? "Marking this done earns you points"
                        : "No points — obligation / duty event"}
                    </div>
                  </div>
                </div>
                {form.award_points && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:7,
                    padding:"8px 12px", borderRadius:10,
                    background:theme.bgInput, border:`1px solid ${theme.bgCardBorder}` }}>
                    <span style={{ color:theme.textSecondary, fontSize:"0.8rem", fontWeight:600, flexShrink:0 }}>
                      Points value:
                    </span>
                    <input
                      type="number" min={1} max={100}
                      style={{ ...inputStyle, width:70, textAlign:"center", padding:"5px 8px" }}
                      value={form.points_value}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setForm(f => ({ ...f, points_value: Math.max(1, parseInt(e.target.value) || 1) }))} />
                    <span style={{ color:theme.textMuted, fontSize:"0.75rem" }}>pts per completion</span>
                  </div>
                )}
              </div>

              {/* ── Date / Time ── */}
              {editEvent && !form.want_reschedule ? (
                <div style={{ borderRadius:12, border:`1px solid ${theme.bgCardBorder}`,
                  background:theme.bgInput, padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                    <div>
                      <p style={{ color:theme.textMuted, fontSize:"0.7rem", fontWeight:600,
                        textTransform:"uppercase", letterSpacing:"0.05em", margin:"0 0 3px" }}>
                        Current date &amp; time
                      </p>
                      <p style={{ color:theme.textPrimary, fontSize:"0.9rem", fontWeight:600, margin:0 }}>
                        {new Date(form.date + "T12:00:00").toLocaleDateString("en-US",
                          { weekday:"short", month:"short", day:"numeric" })}
                        {form.start_time && ` · ${formatTime12(form.start_time)}`}
                        {form.end_time   && ` – ${formatTime12(form.end_time)}`}
                        {form.all_day    && " · All day"}
                      </p>
                    </div>
                    <button
                      onClick={() => setForm({...form, want_reschedule:true})}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
                        borderRadius:9, border:"none", cursor:"pointer", fontWeight:600,
                        fontSize:"0.8rem", background:theme.accentLight, color:theme.accent }}>
                      📅 Reschedule
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                    <div>
                      <label style={labelStyle}>
                        {form.recurrence_type === "weekly" ? "Series Start Date *" : "Date *"}
                      </label>
                      <input type="date" style={inputStyle} value={form.date}
                        onChange={e => setForm({...form, date:e.target.value})} />
                    </div>
                    <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:8 }}>
                      <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                        color:theme.textSecondary, fontSize:"0.84rem" }}>
                        <input type="checkbox" checked={form.all_day}
                          onChange={e => setForm({...form, all_day:e.target.checked})}
                          style={{ accentColor:theme.accent, width:16, height:16 }} />
                        All day
                      </label>
                    </div>
                  </div>
                  {!form.all_day && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                      <div>
                        <label style={labelStyle}>Start Time</label>
                        <input type="time" style={inputStyle} value={form.start_time}
                          onChange={e => setForm({...form, start_time:e.target.value})} />
                      </div>
                      <div>
                        <label style={labelStyle}>End Time</label>
                        <input type="time" style={inputStyle} value={form.end_time}
                          onChange={e => setForm({...form, end_time:e.target.value})} />
                      </div>
                    </div>
                  )}
                  {editEvent && (
                    <button
                      onClick={() => setForm({...form, want_reschedule:false})}
                      style={{ alignSelf:"flex-start", background:"none", border:"none",
                        color:theme.textMuted, fontSize:"0.75rem", cursor:"pointer",
                        padding:"0", textDecoration:"underline" }}>
                      ✕ Keep original date &amp; time
                    </button>
                  )}
                </>
              )}

              {/* ── Recurrence (hidden for birthday — annual is auto-set) ── */}
              {form.event_type !== "birthday" && (
                <div>
                  <label style={labelStyle}>Repeat</label>
                  <div style={{ display:"flex", gap:6 }}>
                    {[
                      { value:"none",   label:"Does not repeat" },
                      { value:"weekly", label:"🔁 Weekly" },
                    ].map(opt => (
                      <button key={opt.value}
                        onClick={() => setForm({...form, recurrence_type: opt.value as "none"|"weekly",
                          recurrence_days: opt.value === "none" ? [] : form.recurrence_days })}
                        style={{ flex:1, padding:"8px", borderRadius:10, border:"none", cursor:"pointer",
                          background: form.recurrence_type===opt.value ? `${theme.accent}20` : theme.bgInput,
                          outline: form.recurrence_type===opt.value
                            ? `2px solid ${theme.accent}` : `1px solid ${theme.bgCardBorder}`,
                          color: form.recurrence_type===opt.value ? theme.accent : theme.textSecondary,
                          fontSize:"0.78rem", fontWeight:600, transition:"all 0.12s" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-of-week picker */}
              {form.recurrence_type === "weekly" && (
                <>
                  <div>
                    <label style={labelStyle}>Repeat on</label>
                    <div style={{ display:"flex", gap:6 }}>
                      {RECUR_DAYS.map(({ d, label }) => {
                        const active = form.recurrence_days.includes(d);
                        return (
                          <button key={d} onClick={() => toggleRecurDay(d)}
                            style={{ width:36, height:36, borderRadius:"50%", border:"none",
                              cursor:"pointer", fontWeight:active?700:400, fontSize:"0.76rem",
                              background: active ? theme.accent : theme.bgInput,
                              color: active ? "#fff" : theme.textSecondary,
                              outline: active ? "none" : `1px solid ${theme.bgCardBorder}`,
                              transition:"all 0.12s" }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {form.recurrence_days.length === 0 && (
                      <p style={{ color:"#f59e0b", fontSize:"0.7rem", margin:"6px 0 0" }}>
                        ⚠ Select at least one day to repeat on
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>End Date (optional — leave blank to repeat forever)</label>
                    <input type="date" style={inputStyle} value={form.recurrence_end_date}
                      onChange={e => setForm({...form, recurrence_end_date:e.target.value})} />
                  </div>

                  {form.recurrence_days.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
                      borderRadius:10, background:`${theme.accent}10`, border:`1px solid ${theme.accent}25` }}>
                      <RefreshCw size={12} style={{ color:theme.accent, flexShrink:0 }} />
                      <span style={{ color:theme.accent, fontSize:"0.75rem", fontWeight:600 }}>
                        {recurrenceLabel(JSON.stringify({ type:"weekly", days:form.recurrence_days }))}
                        {form.recurrence_end_date ? ` · until ${form.recurrence_end_date}` : " · no end date"}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea style={{...inputStyle, resize:"none"}} rows={2}
                  placeholder="Add notes or details…" value={form.description}
                  onChange={e => setForm({...form, description:e.target.value})} />
              </div>

              {/* Color preview */}
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                borderRadius:10, background:theme.bgInput, border:`1px solid ${theme.bgCardBorder}` }}>
                <div style={{ width:14, height:14, borderRadius:"50%",
                  background: typeColor(form.event_type), flexShrink:0 }} />
                <span style={{ color:theme.textMuted, fontSize:"0.78rem" }}>
                  Color set automatically based on event type
                </span>
              </div>

              {/* ── Event Status (non-recurring or full series) ── */}
              {isEditingRecurring ? (
                <div style={{ padding:"8px 12px", borderRadius:10, fontSize:"0.72rem",
                  color:theme.accent, background:`${theme.accent}10`, border:`1px solid ${theme.accent}25` }}>
                  💡 Mark individual occurrences done using the <strong>✓ Done</strong> button on the calendar.
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Event Status</label>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {EVENT_STATUSES.map(s => (
                      <button key={s.value}
                        onClick={() => setForm({...form, event_status: s.value,
                          status_reason: (s.value === "active" || s.value === "completed") ? "" : form.status_reason })}
                        style={{ flex:"1 1 auto", minWidth:72, padding:"8px 4px", borderRadius:10, border:"none",
                          cursor:"pointer", textAlign:"center",
                          background: form.event_status===s.value ? `${s.color}20` : theme.bgInput,
                          outline: form.event_status===s.value ? `2px solid ${s.color}` : `1px solid ${theme.bgCardBorder}`,
                          transition:"all 0.12s" }}>
                        <div style={{ fontSize:"1.1rem", lineHeight:1 }}>{s.emoji}</div>
                        <div style={{ fontSize:"0.62rem", fontWeight:700, marginTop:3,
                          color: form.event_status===s.value ? s.color : theme.textMuted }}>
                          {s.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason — only for negative statuses */}
              {form.event_status !== "active" && form.event_status !== "completed" && !isEditingRecurring && (
                <div>
                  <label style={labelStyle}>Reason</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                    {PRESET_REASONS.map(r => (
                      <button key={r}
                        onClick={() => setForm({...form, status_reason: r})}
                        style={{ padding:"4px 10px", borderRadius:20, fontSize:"0.72rem",
                          fontWeight:600, cursor:"pointer", border:"none",
                          background: form.status_reason===r ? theme.accent : theme.bgInput,
                          color: form.status_reason===r ? "#fff" : theme.textSecondary,
                          outline: form.status_reason===r ? "none" : `1px solid ${theme.bgCardBorder}` }}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <input style={inputStyle}
                    placeholder="Or type a custom reason…"
                    value={PRESET_REASONS.includes(form.status_reason) ? "" : form.status_reason}
                    onChange={e => setForm({...form, status_reason: e.target.value})} />
                  {PRESET_REASONS.includes(form.status_reason) && (
                    <div style={{ marginTop:5, padding:"5px 10px", borderRadius:8, fontSize:"0.73rem",
                      background:`${theme.accent}15`, color:theme.accent, fontWeight:600 }}>
                      ✓ {form.status_reason}
                    </div>
                  )}
                </div>
              )}

              {/* Delete series warning */}
              {isEditingRecurring && (
                <div style={{ padding:"7px 12px", borderRadius:9, fontSize:"0.7rem",
                  color:"#ef4444", background:"#ef444410", border:"1px solid #ef444430" }}>
                  🗑 Deleting this event removes <strong>all recurring occurrences</strong>.
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:"flex", gap:9, paddingTop:3 }}>
                <button onClick={closeModal}
                  style={{ flex:1, padding:"8px 0", borderRadius:10, fontSize:"0.82rem",
                    fontWeight:600, cursor:"pointer", border:`1px solid ${theme.bgCardBorder}`,
                    background:theme.iconBg, color:theme.textMuted }}>
                  Cancel
                </button>
                <button
                  onClick={saveEvent}
                  disabled={
                    !form.title.trim() || !form.date ||
                    (form.recurrence_type === "weekly" && form.recurrence_days.length === 0)
                  }
                  style={{ flex:1, padding:"8px 0", borderRadius:10, fontSize:"0.82rem",
                    fontWeight:700, border:"none",
                    cursor: (form.title.trim() && form.date && !(form.recurrence_type==="weekly" && form.recurrence_days.length===0)) ? "pointer" : "not-allowed",
                    background: (form.title.trim() && form.date && !(form.recurrence_type==="weekly" && form.recurrence_days.length===0)) ? theme.accentGradient : theme.progressBg,
                    color: (form.title.trim() && form.date && !(form.recurrence_type==="weekly" && form.recurrence_days.length===0)) ? "#fff" : theme.textMuted }}>
                  {editEvent ? "Save Changes" : "Add to Calendar 📅"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE EVENT CONFIRM MODAL ═══ */}
      {confirmDeleteEvent && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000 }}>
          <div style={{ background:theme.bgCard, borderRadius:20, padding:28, width:"100%", maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
              <h2 style={{ color:theme.textPrimary, fontSize:20, fontWeight:700, margin:"0 0 8px" }}>Delete Event?</h2>
              <p style={{ color:theme.textMuted, fontSize:14, margin:0, lineHeight:1.5 }}>
                {confirmDeleteEvent.recurrence
                  ? <>This is a <strong style={{ color:theme.textPrimary }}>recurring event</strong>. All occurrences of "<strong style={{ color:theme.textPrimary }}>{confirmDeleteEvent.title}</strong>" will be permanently deleted.</>
                  : <>"<strong style={{ color:theme.textPrimary }}>{confirmDeleteEvent.title}</strong>" will be permanently deleted.</>
                }
                {" "}This cannot be undone.
              </p>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={() => setConfirmDeleteEvent(null)}
                style={{ flex:1, background:theme.bgInput, color:theme.textSecondary, border:"none", borderRadius:10, padding:"12px", cursor:"pointer", fontWeight:600, fontSize:14 }}
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteEvent(confirmDeleteEvent.id); setConfirmDeleteEvent(null); closeModal(); }}
                style={{ flex:1, background:"#ef4444", color:"#fff", border:"none", borderRadius:10, padding:"12px", cursor:"pointer", fontWeight:700, fontSize:14 }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
