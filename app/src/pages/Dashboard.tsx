import { useEffect, useState, useCallback, useRef } from "react";
import {
  Sun, Target, CheckSquare, Heart, Sparkles, Star,
  TrendingUp, Calendar, Flame, LayoutGrid, Clock,
  BookOpen, GripVertical, X, Plus, ClipboardList, Map as MapIcon, Image as ImageIcon, Mail,
} from "lucide-react";
import { getDb } from "../db/database";
import { useAppStore } from "../store/appStore";
import { useThemeStore, type ThemeColors } from "../store/themeStore";
import { getLocalDateString, dateToLocalString } from "../utils/dateUtils";

type ThemeType = ThemeColors;

// ─── Module registry ──────────────────────────────────────────────────────────
interface ModuleMeta {
  id: string;
  label: string;
  icon: string;
  size: "full" | "half";
  pageId: string | null;
  desc: string;
}

const ALL_MODULES: ModuleMeta[] = [
  { id: "affirmation",      label: "Affirmation Banner",  icon: "✨", size: "full", pageId: "affirmations", desc: "Your daily affirmation displayed prominently at the top" },
  { id: "stats",            label: "Stats Overview",       icon: "📊", size: "full", pageId: null,           desc: "Tasks, goals, gratitudes & points at a glance" },
  { id: "todoWidget",       label: "Today's To-Do List",   icon: "📋", size: "full", pageId: "todo",         desc: "Quick view & manage today's to-do items" },
  { id: "schedule",         label: "Today's Schedule",     icon: "📅", size: "full", pageId: "calendar",     desc: "Tasks & calendar events scheduled for today" },
  { id: "recentGratitudes", label: "Recent Gratitudes",    icon: "🙏", size: "full", pageId: "gratitudes",   desc: "Your most recent gratitude entries" },
  { id: "quickActions",     label: "Quick Actions",        icon: "⚡", size: "half", pageId: null,           desc: "One-click shortcuts to common actions" },
  { id: "momentum",         label: "Your Momentum",        icon: "🔥", size: "half", pageId: null,           desc: "Current streak & 7-day activity tracker" },
  { id: "affirmationCard",  label: "Affirmation Card",     icon: "🌟", size: "half", pageId: "affirmations", desc: "Reflect on and explore your daily affirmation" },
  { id: "journalExcerpt",   label: "Journal Excerpt",      icon: "📓", size: "half", pageId: "journal",      desc: "A preview of your last journal entry" },
  { id: "goalsWidget",      label: "Active Goals",         icon: "🎯", size: "half", pageId: "goals",        desc: "Your active goals with task progress" },
  { id: "pointsWidget",     label: "Points & Rewards",     icon: "⭐", size: "half", pageId: "points",       desc: "Recent points activity and total score" },
  { id: "visionWidget",     label: "Vision Board",         icon: "🖼️", size: "half", pageId: "vision-board", desc: "Rotating slideshow of your vision board images" },
];

const MODULE_MAP = new Map(ALL_MODULES.map(m => [m.id, m]));

// ─── Config ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "ascendone_dashboard_v2";
const OLD_KEY     = "ascendone_dashboard_modules";

interface DashConfig { order: string[]; visible: string[]; }

const DEFAULT_CONFIG: DashConfig = {
  order: [
    "affirmation", "stats", "quickActions", "momentum",
    "schedule", "affirmationCard", "journalExcerpt",
    "recentGratitudes", "todoWidget", "goalsWidget", "pointsWidget", "visionWidget",
  ],
  visible: [
    "affirmation", "stats", "quickActions", "momentum",
    "schedule", "affirmationCard", "journalExcerpt", "recentGratitudes",
  ],
};

function loadConfig(): DashConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<DashConfig>;
      const order   = p.order   ?? DEFAULT_CONFIG.order;
      const visible = p.visible ?? DEFAULT_CONFIG.visible;
      // Append any new modules not yet in saved order
      const inOrder = new Set(order);
      const extras  = ALL_MODULES.map(m => m.id).filter(id => !inOrder.has(id));
      return { order: [...order, ...extras], visible };
    }
  } catch { /* fall through */ }
  // Migrate from old localStorage key
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const visible = JSON.parse(old) as string[];
      return { ...DEFAULT_CONFIG, visible };
    }
  } catch { /* fall through */ }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg: DashConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardStats {
  tasksToday: number; tasksCompleted: number;
  goalsActive: number; gratitudesToday: number;
  todayAffirmation: string; streak: number; last7: boolean[];
}

interface TodayItem {
  id: number; title: string; time: string | null;
  type: "task" | "event"; status?: string; color?: string;
}

interface JournalEntry {
  id: number; entry_date: string; content: string;
  mood: number | null; word_count: number | null;
}

interface RecentGratitude {
  id: number; entry_date: string; period: string; text: string;
}

interface DashTodo {
  id: number; text: string; completed: number; sort_order: number;
}

interface GoalPreview {
  id: number; title: string; category: string;
  target_date: string | null; taskDone: number; taskTotal: number;
}

interface PointEntry {
  id: number; points: number; reason: string; entry_date: string;
}

interface VisionWidgetItem {
  id: number; title: string; description: string;
  image_url: string; accent_color: string;
  image_fit: string; text_font: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MOOD_EMOJIS = ["", "😞", "😕", "😊", "😄", "🌟"];
const PERIOD_ICON: Record<string, string> = {
  morning: "🌅", afternoon: "☀️", evening: "🌙",
};

async function calcStreak(): Promise<{ streak: number; last7: boolean[] }> {
  try {
    const db = await getDb();
    const rows = await db.select<{ d: string }[]>(`
      SELECT DISTINCT date_val as d FROM (
        SELECT date(completed_at, 'localtime') as date_val FROM tasks WHERE status='completed' AND completed_at IS NOT NULL
        UNION
        SELECT entry_date as date_val FROM gratitudes
      ) ORDER BY d DESC
    `);
    const dateSet = new Set(rows.map(r => r.d));
    const today   = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return dateSet.has(dateToLocalString(d));
    });
    let streak = 0;
    const check = new Date(today);
    if (!dateSet.has(dateToLocalString(check))) check.setDate(check.getDate() - 1);
    while (dateSet.has(dateToLocalString(check))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return { streak, last7 };
  } catch { return { streak: 0, last7: Array(7).fill(false) }; }
}

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function truncate(text: string, maxLen: number) {
  if (!text) return "";
  return text.length <= maxLen ? text : text.slice(0, maxLen).trimEnd() + "…";
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ theme, icon, label, value, sub, progress }: {
  theme: ThemeType; icon: React.ReactNode; label: string;
  value: string; sub: string; progress?: number;
}) {
  return (
    <div className="rounded-xl" style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`, padding: "16px 18px 14px" }}>
      <div style={{ marginBottom: 10 }}>{icon}</div>
      <div className="font-bold" style={{ color: theme.textPrimary, fontSize: "1.75rem", lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: theme.textSecondary, fontSize: "0.78rem", marginTop: 5, fontWeight: 500 }}>{label}</div>
      {progress !== undefined && (
        <div className="rounded-full overflow-hidden" style={{ height: 4, background: theme.progressBg, marginTop: 10 }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: theme.progressFill, transition: "width 0.5s ease" }} />
        </div>
      )}
      <div style={{ color: theme.textMuted, fontSize: "0.72rem", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function ModuleHeader({ icon, title, theme, action }: {
  icon: React.ReactNode; title: string; theme: ThemeType;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
      <h2 className="font-semibold flex items-center gap-2" style={{ color: theme.textPrimary, fontSize: "0.92rem" }}>
        {icon}{title}
      </h2>
      {action && (
        <button onClick={action.onClick}
          style={{ color: theme.accent, fontSize: "0.76rem", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
          {action.label} →
        </button>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, todayPoints, setCurrentPage } = useAppStore();
  const { theme } = useThemeStore();

  // ── Config ────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<DashConfig>(loadConfig);
  const visibleSet  = new Set(config.visible);
  const moduleOrder = config.order;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<DashboardStats>({
    tasksToday: 0, tasksCompleted: 0, goalsActive: 0,
    gratitudesToday: 0, todayAffirmation: "",
    streak: 0, last7: Array(7).fill(false),
  });
  const [todayItems,       setTodayItems]       = useState<TodayItem[]>([]);
  const [lastJournal,      setLastJournal]       = useState<JournalEntry | null>(null);
  const [recentGratitudes, setRecentGratitudes]  = useState<RecentGratitude[]>([]);
  const [todayTodos,       setTodayTodos]        = useState<DashTodo[]>([]);
  const [activeGoals,      setActiveGoals]       = useState<GoalPreview[]>([]);
  const [recentPoints,     setRecentPoints]      = useState<PointEntry[]>([]);
  const [totalPts,         setTotalPts]          = useState(0);
  const [visionItems,      setVisionItems]       = useState<VisionWidgetItem[]>([]);
  const [visionIdx,        setVisionIdx]         = useState(0);
  const [unlockedLetter,   setUnlockedLetter]    = useState(false);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [editing,       setEditing]       = useState(false);
  const [dragId,        setDragId]        = useState<string | null>(null);
  const [dropTargetId,  setDropTargetId]  = useState<string | null>(null);
  const dragStateRef = useRef<{ id: string; dropTargetId: string | null } | null>(null);
  const [quickTodoText, setQuickTodoText] = useState("");

  const hour      = new Date().getHours();
  const greeting  = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.first_name ?? "Friend";

  useEffect(() => { loadAll(); }, []);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const db    = await getDb();
      const today = getLocalDateString();

      // Core stats
      const [[tt], [tc], [ga], [gt], [aff]] = await Promise.all([
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM tasks WHERE scheduled_date=? OR due_date=?", [today, today]),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM tasks WHERE status='completed' AND date(completed_at,'localtime')=?", [today]),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM goals WHERE status='active'"),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM gratitudes WHERE entry_date=?", [today]),
        db.select<[{ text: string }]>("SELECT text FROM affirmations WHERE is_active=1 ORDER BY RANDOM() LIMIT 1"),
      ]);
      const { streak, last7 } = await calcStreak();
      setStats({
        tasksToday: tt.count, tasksCompleted: tc.count,
        goalsActive: ga.count, gratitudesToday: gt.count,
        todayAffirmation: aff?.text ?? "You are capable of amazing things.",
        streak, last7,
      });

      // Today's schedule
      const tasks = await db.select<{ id: number; title: string; scheduled_time: string | null; status: string }[]>(
        "SELECT id, title, scheduled_time, status FROM tasks WHERE (scheduled_date=? OR due_date=?) ORDER BY scheduled_time NULLS LAST, title",
        [today, today]
      );
      const events = await db.select<{ id: number; title: string; start_datetime: string; color: string }[]>(
        "SELECT id, title, start_datetime, color FROM events WHERE date(start_datetime,'localtime')=? ORDER BY start_datetime",
        [today]
      );
      const items: TodayItem[] = [
        ...events.map(e => ({ id: e.id, title: e.title, type: "event" as const, time: e.start_datetime.split(" ")[1] ?? null, color: e.color })),
        ...tasks.map(t => ({ id: t.id, title: t.title, type: "task" as const, time: t.scheduled_time, status: t.status })),
      ].sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });
      setTodayItems(items);

      // Last journal
      const journals = await db.select<JournalEntry[]>(
        "SELECT id, entry_date, content, mood, word_count FROM journal_entries ORDER BY entry_date DESC, id DESC LIMIT 1"
      );
      setLastJournal(journals[0] ?? null);

      // Recent gratitudes
      const grats = await db.select<RecentGratitude[]>(
        "SELECT id, entry_date, period, text FROM gratitudes ORDER BY entry_date DESC, id DESC LIMIT 8"
      );
      setRecentGratitudes(grats);

      // Today's todos
      try {
        const todos = await db.select<DashTodo[]>(
          `SELECT id, text, completed, sort_order FROM todos WHERE "date"=? ORDER BY sort_order ASC, id ASC`,
          [today]
        );
        setTodayTodos(todos);
      } catch { /* todos table may not exist yet */ }

      // Active goals
      try {
        const goals = await db.select<GoalPreview[]>(`
          SELECT g.id, g.title, g.category, g.target_date,
            COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.goal_id=g.id AND t.status='completed'),0) as taskDone,
            COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.goal_id=g.id),0) as taskTotal
          FROM goals g WHERE g.status='active' ORDER BY g.created_at DESC LIMIT 5
        `);
        setActiveGoals(goals);
      } catch { /* fallback */ }

      // Points
      try {
        const pts = await db.select<PointEntry[]>(
          "SELECT id, points, reason, entry_date FROM points_log ORDER BY id DESC LIMIT 5"
        );
        setRecentPoints(pts);
        const [pRow] = await db.select<[{ t: number }]>(
          "SELECT COALESCE(SUM(points),0) as t FROM points_log"
        );
        setTotalPts(pRow?.t ?? 0);
      } catch { /* points_log may not exist */ }

      // Check for unlocked future letters
      try {
        const letterRows = await db.select<[{ count: number }]>(
          `SELECT COUNT(*) as count FROM future_letters WHERE unlock_date <= ? AND opened_at IS NULL`,
          [today]
        );
        setUnlockedLetter((letterRows[0]?.count ?? 0) > 0);
      } catch { /* table may not exist yet */ }

      // Vision board items
      try {
        const vItems = await db.select<VisionWidgetItem[]>(
          `SELECT id, title, description, image_url, accent_color, image_fit, text_font
           FROM vision_board_items ORDER BY sort_order ASC, created_at ASC`
        );
        setVisionItems(vItems);
        if (vItems.length > 0) {
          setVisionIdx(Math.floor(Math.random() * vItems.length));
        }
      } catch { /* vision_board_items may not exist yet */ }

    } catch (e) { console.error("Dashboard load error", e); }
  }, []);

  // ── Vision Board auto-rotate ──────────────────────────────────────────────
  const isVisionVisible = config.visible.includes("visionWidget");
  useEffect(() => {
    if (visionItems.length <= 1 || !isVisionVisible) return;
    const timer = setInterval(() => {
      setVisionIdx(prev => (prev + 1) % visionItems.length);
    }, 8000); // rotate every 8 seconds
    return () => clearInterval(timer);
  }, [visionItems.length, isVisionVisible]);

  // ── Config helpers ────────────────────────────────────────────────────────
  function updateConfig(changes: Partial<DashConfig>) {
    const next = { ...config, ...changes };
    setConfig(next);
    saveConfig(next);
  }

  function hideModule(id: string) {
    updateConfig({ visible: config.visible.filter(v => v !== id) });
  }

  function showModule(id: string) {
    if (visibleSet.has(id)) return;
    const order = [...config.order];
    // Move to just after the last currently visible module
    const lastVisIdx = Math.max(0, ...config.visible.map(v => order.indexOf(v)));
    const curIdx = order.indexOf(id);
    if (curIdx > -1) order.splice(curIdx, 1);
    const insertAt = Math.min(lastVisIdx + 1, order.length);
    order.splice(insertAt, 0, id);
    updateConfig({ visible: [...config.visible, id], order });
  }

  // ── Drag & drop (mouse-event based for Tauri WebView2 compatibility) ──────
  function startDrag(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = { id, dropTargetId: null };
    setDragId(id);
    setDropTargetId(null);

    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      // Walk up from the element under the cursor to find a module card
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const card = el?.closest("[data-module-id]") as HTMLElement | null;
      const targetId = card?.dataset.moduleId ?? null;
      if (targetId !== dragStateRef.current.id) {
        dragStateRef.current.dropTargetId = targetId;
        setDropTargetId(targetId);
      }
    };

    const onUp = () => {
      const state = dragStateRef.current;
      if (state?.dropTargetId && state.dropTargetId !== state.id) {
        // Use functional update so we always operate on the latest config
        setConfig(prev => {
          const order    = [...prev.order];
          const fromIdx  = order.indexOf(state.id);
          const toTarget = state.dropTargetId!;
          const toIdx    = order.indexOf(toTarget);
          if (fromIdx !== -1 && toIdx !== -1) {
            order.splice(fromIdx, 1);
            const newToIdx = order.indexOf(toTarget);
            order.splice(newToIdx, 0, state.id);
            const next = { ...prev, order };
            saveConfig(next);
            return next;
          }
          return prev;
        });
      }
      dragStateRef.current = null;
      setDragId(null);
      setDropTargetId(null);
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup",   onUp,   true);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup",   onUp,   true);
  }

  // ── Todo widget actions ───────────────────────────────────────────────────
  async function toggleTodo(todo: DashTodo) {
    try {
      const db = await getDb();
      const next = todo.completed ? 0 : 1;
      await db.execute("UPDATE todos SET completed=? WHERE id=?", [next, todo.id]);
      setTodayTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: next } : t));
    } catch { /* ignore */ }
  }

  async function addQuickTodo() {
    const text = quickTodoText.trim();
    if (!text) return;
    try {
      const db    = await getDb();
      const today = getLocalDateString();
      const maxOrd = todayTodos.length > 0 ? Math.max(...todayTodos.map(t => t.sort_order)) + 1 : 0;
      await db.execute(
        `INSERT INTO todos (text, completed, sort_order, "date") VALUES (?, 0, ?, ?)`,
        [text, maxOrd, today]
      );
      setQuickTodoText("");
      const rows = await db.select<DashTodo[]>(
        `SELECT id, text, completed, sort_order FROM todos WHERE "date"=? ORDER BY sort_order ASC, id ASC`,
        [today]
      );
      setTodayTodos(rows);
    } catch { /* ignore */ }
  }

  // ── Module rendering ──────────────────────────────────────────────────────
  const taskPct = stats.tasksToday > 0 ? Math.round((stats.tasksCompleted / stats.tasksToday) * 100) : 0;
  const gratPct = Math.min((stats.gratitudesToday / 9) * 100, 100);

  const renderAffirmation = () => (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: theme.accentGradient }}>
      <Sparkles size={18} color="rgba(255,255,255,0.8)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.68rem", letterSpacing: "0.1em", marginBottom: 5 }}>
          TODAY'S AFFIRMATION
        </p>
        <p className="italic font-medium leading-relaxed" style={{ color: "#fff", fontSize: "1rem" }}>
          "{stats.todayAffirmation}"
        </p>
      </div>
    </div>
  );

  const renderStats = () => (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      <StatCard theme={theme} icon={<CheckSquare size={18} style={{ color: theme.accent }} />}
        label="Tasks Today" value={`${stats.tasksCompleted}/${stats.tasksToday}`}
        sub={`${taskPct}% done`} progress={taskPct} />
      <StatCard theme={theme} icon={<Target size={18} style={{ color: theme.accent }} />}
        label="Active Goals" value={String(stats.goalsActive)} sub="In progress" />
      <StatCard theme={theme} icon={<Heart size={18} style={{ color: "#ef4444" }} />}
        label="Gratitudes" value={`${stats.gratitudesToday}/9`} sub="AM · PM · Eve" progress={gratPct} />
      <StatCard theme={theme} icon={<Star size={18} style={{ color: theme.accent }} fill={theme.accent} />}
        label="Points Today" value={String(todayPoints)} sub="Keep going!" />
    </div>
  );

  const renderTodoWidget = () => {
    const done  = todayTodos.filter(t => t.completed).length;
    const total = todayTodos.length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <>
        <ModuleHeader
          theme={theme}
          icon={<ClipboardList size={14} style={{ color: theme.accent }} />}
          title="Today's To-Do List"
          action={{ label: "Open list", onClick: () => setCurrentPage("todo") }}
        />
        {total > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: theme.progressBg }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.progressFill, transition: "width 0.4s ease" }} />
            </div>
            <span style={{ color: theme.textMuted, fontSize: "0.72rem", flexShrink: 0 }}>
              {done}/{total} done
            </span>
          </div>
        )}
        {todayTodos.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: "0.83rem", marginBottom: 12 }}>
            Nothing on your list yet today.
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {todayTodos.slice(0, 7).map(todo => (
              <div key={todo.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`, opacity: todo.completed ? 0.55 : 1 }}>
                <div
                  onClick={() => toggleTodo(todo)}
                  className="flex-shrink-0 flex items-center justify-center cursor-pointer"
                  style={{
                    width: 20, height: 20,
                    borderRadius: 5,
                    border: `2px solid ${todo.completed ? theme.accent : theme.bgCardBorder}`,
                    background: todo.completed ? theme.accent : "transparent",
                    transition: "all 0.15s",
                  }}>
                  {todo.completed && (
                    <svg width="11" height="11" viewBox="0 0 9 9" fill="none">
                      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{
                  color: theme.textPrimary, fontSize: "0.86rem",
                  textDecoration: todo.completed ? "line-through" : "none", flex: 1,
                }}>
                  {todo.text}
                </span>
              </div>
            ))}
            {todayTodos.length > 7 && (
              <button onClick={() => setCurrentPage("todo")}
                style={{ color: theme.accent, fontSize: "0.72rem", background: "none", border: "none", cursor: "pointer", textAlign: "center", padding: "4px 0" }}>
                +{todayTodos.length - 7} more — view all
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={quickTodoText}
            onChange={e => setQuickTodoText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addQuickTodo()}
            placeholder="Quick add a task…"
            style={{
              flex: 1, background: theme.iconBg,
              border: `1px solid ${theme.bgCardBorder}`,
              color: theme.textPrimary, borderRadius: 10,
              padding: "7px 12px", fontSize: "0.83rem",
              outline: "none",
            }}
          />
          <button
            onClick={addQuickTodo}
            className="rounded-xl px-3 flex items-center justify-center"
            style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = theme.accent; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = theme.accentLight; (e.currentTarget as HTMLButtonElement).style.color = theme.accent; }}>
            <Plus size={14} />
          </button>
        </div>
      </>
    );
  };

  const renderSchedule = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<Calendar size={14} style={{ color: theme.accent }} />}
        title="Today at a Glance"
        action={{ label: "Open calendar", onClick: () => setCurrentPage("calendar") }}
      />
      {todayItems.length === 0 ? (
        <p style={{ color: theme.textMuted, fontSize: "0.83rem" }}>
          Nothing scheduled yet.{" "}
          <button onClick={() => setCurrentPage("tasks")} style={{ color: theme.accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Add a task</button>
          {" "}or{" "}
          <button onClick={() => setCurrentPage("calendar")} style={{ color: theme.accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>schedule an event</button>.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {todayItems.slice(0, 8).map(item => {
            const color = item.type === "event" ? (item.color ?? theme.accent) : theme.accent;
            return (
              <div key={`${item.type}-${item.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: `${color}12`, border: `1px solid ${color}28`, borderLeft: `3px solid ${color}`, opacity: item.status === "completed" ? 0.5 : 1 }}>
                <span style={{ fontSize: "0.8rem", color }}>
                  {item.type === "event" ? "📅" : item.status === "completed" ? "✅" : "⬜"}
                </span>
                <span className="flex-1 truncate font-medium" style={{ color: theme.textPrimary, fontSize: "0.84rem", textDecoration: item.status === "completed" ? "line-through" : "none" }}>
                  {item.title}
                </span>
                {item.time && (
                  <span className="flex items-center gap-1 flex-shrink-0" style={{ color: theme.textMuted, fontSize: "0.72rem" }}>
                    <Clock size={10} /> {formatTime12(item.time)}
                  </span>
                )}
              </div>
            );
          })}
          {todayItems.length > 8 && (
            <p style={{ color: theme.textMuted, fontSize: "0.72rem", textAlign: "center", marginTop: 2 }}>
              +{todayItems.length - 8} more —{" "}
              <button onClick={() => setCurrentPage("tasks")} style={{ color: theme.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                view all
              </button>
            </p>
          )}
        </div>
      )}
    </>
  );

  const renderQuickActions = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<TrendingUp size={14} style={{ color: theme.accent }} />}
        title="Quick Actions"
      />
      <div className="flex flex-col gap-2">
        {[
          { label: "Add gratitude",   emoji: "🙏", page: "gratitudes"  },
          { label: "Log a task",       emoji: "✅", page: "tasks"       },
          { label: "Write in journal", emoji: "📓", page: "journal"     },
          { label: "Review goals",     emoji: "🎯", page: "goals"       },
        ].map(({ label, emoji, page }) => (
          <button key={label} onClick={() => setCurrentPage(page)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-full"
            style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`, color: theme.textSecondary, fontSize: "0.83rem", transition: "all 0.15s" }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = theme.accentLight; b.style.borderColor = theme.accent; b.style.color = theme.accent; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = theme.iconBg; b.style.borderColor = theme.bgCardBorder; b.style.color = theme.textSecondary; }}>
            <span style={{ fontSize: "1rem" }}>{emoji}</span>{label}
          </button>
        ))}
      </div>
    </>
  );

  const renderMomentum = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<Flame size={14} style={{ color: theme.accent }} />}
        title="Your Momentum"
      />
      <div className="flex flex-col items-center justify-center gap-3 py-1">
        <div className="rounded-full flex items-center justify-center"
          style={{ width: 76, height: 76, background: stats.streak > 0 ? theme.accentGradient : theme.progressBg, boxShadow: stats.streak > 0 ? `0 4px 24px ${theme.bgCardShadow}` : "none" }}>
          <div className="text-center">
            <div style={{ color: stats.streak > 0 ? "#fff" : theme.textMuted, fontSize: "1.7rem", fontWeight: 800, lineHeight: 1 }}>
              {stats.streak}
            </div>
            <div style={{ color: stats.streak > 0 ? "rgba(255,255,255,0.7)" : theme.textMuted, fontSize: "0.58rem" }}>DAYS</div>
          </div>
        </div>
        <p style={{ color: theme.textSecondary, fontSize: "0.8rem" }}>
          {stats.streak === 0 ? "Start your streak today!" : stats.streak === 1 ? "Day 1 — great start! 🌱" : `${stats.streak}-day streak! 🔥`}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {stats.last7.map((active, i) => (
            <div key={i} className="rounded-full"
              style={{ width: 11, height: 11, background: active ? theme.accent : theme.progressBg, transition: "background 0.3s", boxShadow: active ? `0 0 6px ${theme.accent}88` : "none" }} />
          ))}
        </div>
        <p style={{ color: theme.textMuted, fontSize: "0.65rem" }}>Last 7 days</p>
      </div>
    </>
  );

  const renderAffirmationCard = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<Sparkles size={14} style={{ color: theme.accent }} />}
        title="Affirmation"
        action={{ label: "View all", onClick: () => setCurrentPage("affirmations") }}
      />
      {stats.todayAffirmation ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl flex-1"
            style={{ background: `${theme.accent}14`, border: `1px solid ${theme.accent}30`, minHeight: 90, padding: "14px 16px" }}>
            <p className="italic leading-relaxed" style={{ color: theme.textPrimary, fontSize: "0.92rem" }}>
              "{stats.todayAffirmation}"
            </p>
          </div>
          <button onClick={() => setCurrentPage("affirmations")}
            className="w-full py-2 rounded-xl text-sm font-medium"
            style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent, transition: "all 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = theme.bgCardBorder}>
            Reflect on this ✨
          </button>
        </div>
      ) : (
        <p style={{ color: theme.textMuted, fontSize: "0.82rem" }}>No affirmations yet.</p>
      )}
    </>
  );

  const renderJournalExcerpt = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<BookOpen size={14} style={{ color: theme.accent }} />}
        title="Last Journal Entry"
        action={{ label: "Open journal", onClick: () => setCurrentPage("journal") }}
      />
      {lastJournal ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span style={{ color: theme.textMuted, fontSize: "0.76rem" }}>📅 {formatDate(lastJournal.entry_date)}</span>
            {lastJournal.mood != null && lastJournal.mood > 0 && (
              <span style={{ fontSize: "1rem" }} title={`Mood: ${lastJournal.mood}/5`}>
                {MOOD_EMOJIS[lastJournal.mood] ?? ""}
              </span>
            )}
            {lastJournal.word_count != null && lastJournal.word_count > 0 && (
              <span style={{ color: theme.textMuted, fontSize: "0.72rem", marginLeft: "auto" }}>
                {lastJournal.word_count} words
              </span>
            )}
          </div>
          <div className="rounded-xl"
            style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`, minHeight: 90, padding: "14px 16px" }}>
            {lastJournal.content ? (
              <>
                <span style={{ color: theme.accent, fontSize: "1.4rem", lineHeight: 1, display: "block", marginBottom: 4, opacity: 0.5 }}>"</span>
                <p style={{ color: theme.textSecondary, fontSize: "0.87rem", lineHeight: 1.65, fontStyle: "italic" }}>
                  {truncate(lastJournal.content, 200)}
                </p>
              </>
            ) : (
              <p style={{ color: theme.textMuted, fontSize: "0.84rem", fontStyle: "italic" }}>No content in this entry.</p>
            )}
          </div>
          <button onClick={() => setCurrentPage("journal")}
            className="w-full py-2 rounded-xl text-sm font-medium"
            style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`, color: theme.textSecondary, transition: "all 0.15s" }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = theme.accentLight; b.style.borderColor = theme.accent; b.style.color = theme.accent; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = theme.iconBg; b.style.borderColor = theme.bgCardBorder; b.style.color = theme.textSecondary; }}>
            Write today's entry 📓
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <p style={{ color: theme.textMuted, fontSize: "0.84rem" }}>No journal entries yet.</p>
          <button onClick={() => setCurrentPage("journal")}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent }}>
            Start writing 📓
          </button>
        </div>
      )}
    </>
  );

  const renderGoalsWidget = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<Target size={14} style={{ color: theme.accent }} />}
        title="Active Goals"
        action={{ label: "View all", onClick: () => setCurrentPage("goals") }}
      />
      {activeGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-4">
          <p style={{ color: theme.textMuted, fontSize: "0.83rem" }}>No active goals yet.</p>
          <button onClick={() => setCurrentPage("goals")}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent }}>
            Set a goal 🎯
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {activeGoals.map(goal => {
            const pct = goal.taskTotal > 0 ? Math.round((goal.taskDone / goal.taskTotal) * 100) : 0;
            return (
              <div key={goal.id} className="px-3 rounded-xl" style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`, padding: "12px 14px" }}>
                <div className="flex items-start justify-between gap-2" style={{ marginBottom: goal.taskTotal > 0 ? 8 : 4 }}>
                  <span className="font-medium leading-snug" style={{ color: theme.textPrimary, fontSize: "0.86rem", flex: 1 }}>
                    {goal.title}
                  </span>
                  {goal.taskTotal > 0 && (
                    <span style={{ color: theme.textMuted, fontSize: "0.72rem", flexShrink: 0, paddingTop: 1 }}>
                      {goal.taskDone}/{goal.taskTotal} tasks
                    </span>
                  )}
                </div>
                {goal.taskTotal > 0 && (
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: theme.progressBg }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.progressFill, transition: "width 0.4s ease" }} />
                  </div>
                )}
                {(goal.category || goal.target_date) && (
                  <div style={{ color: theme.textMuted, fontSize: "0.72rem", marginTop: 6 }}>
                    {goal.category}
                    {goal.target_date && ` · Due ${formatDate(goal.target_date)}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderPointsWidget = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<Star size={14} style={{ color: theme.accent }} fill={theme.accent} />}
        title="Points & Rewards"
        action={{ label: "View all", onClick: () => setCurrentPage("points") }}
      />
      <div className="flex items-end gap-4 mb-4">
        <div>
          <div style={{ color: theme.textPrimary, fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
            {totalPts > 0 ? totalPts : todayPoints}
          </div>
          <div style={{ color: theme.textMuted, fontSize: "0.72rem", marginTop: 2 }}>
            {totalPts > 0 ? "total points" : "points today"}
          </div>
        </div>
        <div className="rounded-xl px-3 py-1.5 mb-1" style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}` }}>
          <span style={{ color: theme.accent, fontSize: "0.78rem", fontWeight: 600 }}>+{todayPoints} today</span>
        </div>
      </div>
      {recentPoints.length === 0 ? (
        <p style={{ color: theme.textMuted, fontSize: "0.78rem" }}>No points logged yet. Complete tasks, add gratitudes, and hit your goals!</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {recentPoints.slice(0, 4).map(p => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}` }}>
              <span style={{ color: theme.accent, fontSize: "0.78rem", fontWeight: 700, flexShrink: 0 }}>+{p.points}</span>
              <span className="truncate" style={{ color: theme.textSecondary, fontSize: "0.78rem", flex: 1 }}>{p.reason}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderRecentGratitudes = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<Heart size={14} style={{ color: "#e05070" }} />}
        title="Recent Gratitudes"
        action={{ label: "Add gratitude", onClick: () => setCurrentPage("gratitudes") }}
      />
      {recentGratitudes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <p style={{ color: theme.textMuted, fontSize: "0.84rem" }}>No gratitudes logged yet.</p>
          <button onClick={() => setCurrentPage("gratitudes")}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent }}>
            Log your first gratitude 🙏
          </button>
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
          {recentGratitudes.map(g => (
            <div key={g.id} className="flex items-start gap-2.5 rounded-xl"
              style={{ background: theme.iconBg, border: `1px solid ${theme.bgCardBorder}`, padding: "10px 14px" }}>
              <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>
                {PERIOD_ICON[g.period] ?? "🙏"}
              </span>
              <div className="min-w-0">
                <p className="truncate" style={{ color: theme.textPrimary, fontSize: "0.85rem", fontWeight: 500 }}>{g.text}</p>
                <p style={{ color: theme.textMuted, fontSize: "0.7rem", marginTop: 2 }}>
                  {formatDate(g.entry_date)} · {g.period}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderVisionWidget = () => {
    const safeIdx = visionItems.length > 0 ? visionIdx % visionItems.length : 0;
    const item    = visionItems[safeIdx];
    const hasImage = !!item?.image_url;
    const accent   = item?.accent_color || theme.accent;
    const fontFam  = item?.text_font ? `"${item.text_font}", cursive` : "inherit";

    return (
      <>
        {/* CSS for fade-in animation */}
        <style>{`
          @keyframes visionFadeIn {
            from { opacity: 0; transform: scale(1.03); }
            to   { opacity: 1; transform: scale(1);    }
          }
        `}</style>

        <ModuleHeader
          theme={theme}
          icon={<ImageIcon size={14} style={{ color: theme.accent }} />}
          title="Vision Board"
          action={{ label: "View board", onClick: () => setCurrentPage("vision-board") }}
        />

        {visionItems.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl"
            style={{ height: 200, background: theme.iconBg, border: `1px dashed ${theme.bgCardBorder}` }}>
            <span style={{ fontSize: "2.5rem" }}>🖼️</span>
            <p style={{ color: theme.textMuted, fontSize: "0.83rem" }}>No vision board items yet.</p>
            <button onClick={() => setCurrentPage("vision-board")}
              className="px-4 py-1.5 rounded-xl text-sm font-medium"
              style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent }}>
              Build your vision board →
            </button>
          </div>
        ) : (
          <>
            {/* Image / text card */}
            <div
              key={safeIdx}
              className="relative rounded-2xl overflow-hidden"
              onClick={() => setCurrentPage("vision-board")}
              style={{
                height: 220,
                cursor: "pointer",
                background: accent,
                animation: "visionFadeIn 0.55s ease-in-out",
              }}
            >
              {hasImage ? (
                <img
                  src={item.image_url}
                  alt={item.title || "Vision"}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: item.image_fit === "contain" ? "contain" : "cover",
                    display: "block",
                  }}
                />
              ) : (
                /* Text-only vision card */
                <div className="flex items-center justify-center w-full h-full"
                  style={{ background: `linear-gradient(135deg, ${accent}cc, ${accent})`, padding: 24 }}>
                  <div style={{ textAlign: "center" }}>
                    {item.title && (
                      <p style={{ color: "#fff", fontSize: "1.35rem", fontWeight: 700, fontFamily: fontFam, lineHeight: 1.3, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                        {item.title}
                      </p>
                    )}
                    {item.description && (
                      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", fontFamily: fontFam, marginTop: 8 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Title overlay for image cards */}
              {hasImage && (item.title || item.description) && (
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  padding: "28px 14px 12px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
                }}>
                  {item.title && (
                    <p style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 600, fontFamily: fontFam, lineHeight: 1.3 }}>
                      {item.title}
                    </p>
                  )}
                  {item.description && (
                    <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.74rem", fontFamily: fontFam, marginTop: 2 }}>
                      {item.description}
                    </p>
                  )}
                </div>
              )}

              {/* Dot nav indicators (top-right) */}
              {visionItems.length > 1 && (
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 5 }}>
                  {visionItems.map((_, i) => (
                    <div
                      key={i}
                      onClick={e => { e.stopPropagation(); setVisionIdx(i); }}
                      style={{
                        width: i === safeIdx ? 18 : 7, height: 7,
                        borderRadius: 4,
                        background: i === safeIdx ? "#fff" : "rgba(255,255,255,0.45)",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer: counter + rotation hint */}
            {visionItems.length > 1 && (
              <div className="flex items-center justify-between mt-2 px-1">
                <span style={{ color: theme.textMuted, fontSize: "0.68rem" }}>
                  {safeIdx + 1} of {visionItems.length}
                </span>
                <span style={{ color: theme.textMuted, fontSize: "0.68rem" }}>
                  auto-rotates every 8s
                </span>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderRoadmapPlaceholder = () => (
    <>
      <ModuleHeader
        theme={theme}
        icon={<MapIcon size={14} style={{ color: theme.accent }} />}
        title="Roadmap"
        action={{ label: "Open roadmap", onClick: () => setCurrentPage("roadmap") }}
      />
      <div className="flex flex-col items-center justify-center gap-2 py-4">
        <span style={{ fontSize: "2rem" }}>🗺️</span>
        <p style={{ color: theme.textMuted, fontSize: "0.83rem" }}>Your roadmap milestones at a glance.</p>
        <button onClick={() => setCurrentPage("roadmap")}
          className="px-4 py-1.5 rounded-xl text-sm font-medium"
          style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent }}>
          View Roadmap →
        </button>
      </div>
    </>
  );

  function renderModule(id: string): React.ReactNode {
    switch (id) {
      case "affirmation":      return renderAffirmation();
      case "stats":            return renderStats();
      case "todoWidget":       return renderTodoWidget();
      case "schedule":         return renderSchedule();
      case "quickActions":     return renderQuickActions();
      case "momentum":         return renderMomentum();
      case "affirmationCard":  return renderAffirmationCard();
      case "journalExcerpt":   return renderJournalExcerpt();
      case "goalsWidget":      return renderGoalsWidget();
      case "pointsWidget":     return renderPointsWidget();
      case "recentGratitudes": return renderRecentGratitudes();
      case "visionWidget":     return renderVisionWidget();
      case "roadmapWidget":    return renderRoadmapPlaceholder();
      default:                 return null;
    }
  }

  // ── Visible ordered modules for render ────────────────────────────────────
  const visibleOrdered = moduleOrder.filter(id => visibleSet.has(id));
  const hiddenModules  = ALL_MODULES.filter(m => !visibleSet.has(m.id));

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Sun size={26} style={{ color: theme.accent }} />
            <h1 className="font-bold" style={{ color: theme.textPrimary, fontSize: "1.7rem" }}>
              {greeting}, {firstName}!
            </h1>
          </div>
          <p style={{ color: theme.textMuted, fontSize: "0.88rem" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {editing && (
              <span style={{ marginLeft: 10, color: theme.accent, fontWeight: 500 }}>
                · {visibleSet.size} of {ALL_MODULES.length} modules visible
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
          style={{
            background: editing ? theme.accentLight : theme.iconBg,
            border: `1px solid ${editing ? theme.accent : theme.bgCardBorder}`,
            color: editing ? theme.accent : theme.textMuted,
            transition: "all 0.15s",
          }}>
          <LayoutGrid size={14} /> {editing ? "Done" : "Edit Layout"}
        </button>
      </div>

      {/* ── Edit mode banner ── */}
      {editing && (
        <div className="rounded-xl px-4 py-2.5 mb-6 flex items-center gap-3 text-sm"
          style={{ background: theme.accentLight, border: `1px solid ${theme.bgCardBorder}`, color: theme.accent }}>
          <GripVertical size={14} />
          <span>
            <strong>Drag</strong> cards to reorder &nbsp;·&nbsp;
            Click <strong>✕</strong> to hide a module &nbsp;·&nbsp;
            <strong>Add modules</strong> from the panel below
          </span>
        </div>
      )}

      {/* ── Unlocked letter banner ── */}
      {unlockedLetter && (
        <button
          onClick={() => setCurrentPage("challenges")}
          className="w-full rounded-xl px-4 py-3 mb-6 flex items-center gap-3 text-sm"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.12))",
            border: "1px solid rgba(245,158,11,0.4)",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <Mail size={18} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>📬 Your Letter to Future Self has unlocked! </span>
            <span style={{ color: theme.textMuted }}>Click to open and read what you wrote a year ago.</span>
          </div>
          <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: "1.1rem" }}>→</span>
        </button>
      )}

      {/* ── Module grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {visibleOrdered.map(id => {
          const meta = MODULE_MAP.get(id);
          if (!meta) return null;
          const isDragging = dragId === id;
          const isOver     = dropTargetId === id && dragId !== id;

          return (
            <div
              key={id}
              data-module-id={id}
              className="rounded-2xl relative"
              style={{
                gridColumn: meta.size === "full" ? "1 / -1" : "span 1",
                padding: "20px 22px",
                paddingTop: editing ? "38px" : "20px",
                background: theme.bgCard,
                border: `1px solid ${isOver ? theme.accent : theme.bgCardBorder}`,
                boxShadow: isOver
                  ? `0 4px 24px ${theme.bgCardShadow}, 0 0 0 2px ${theme.accent}40`
                  : `0 4px 24px ${theme.bgCardShadow}, 0 0 0 1px ${theme.accent}22, 0 0 18px ${theme.accent}1a`,
                opacity: isDragging ? 0.4 : 1,
                transition: "opacity 0.15s, border-color 0.15s, box-shadow 0.3s, background 0.4s",
              }}
            >
              {editing && (
                <>
                  {/* Drag handle */}
                  <div
                    onMouseDown={e => startDrag(e, id)}
                    style={{
                      position: "absolute", top: 10, left: 12,
                      color: theme.textMuted, cursor: "grab",
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: "0.7rem", userSelect: "none",
                    }}
                    title="Drag to reorder">
                    <GripVertical size={13} />
                    <span style={{ fontSize: "0.68rem", letterSpacing: "0.05em" }}>{meta.label}</span>
                  </div>
                  {/* Hide button */}
                  <button
                    onClick={() => hideModule(id)}
                    title={`Hide ${meta.label}`}
                    className="flex items-center justify-center rounded-full"
                    style={{
                      position: "absolute", top: 8, right: 8,
                      width: 22, height: 22,
                      background: theme.iconBg,
                      border: `1px solid ${theme.bgCardBorder}`,
                      color: theme.textMuted, cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.background = "#ef444420";
                      b.style.borderColor = "#ef4444";
                      b.style.color = "#ef4444";
                    }}
                    onMouseLeave={e => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.background = theme.iconBg;
                      b.style.borderColor = theme.bgCardBorder;
                      b.style.color = theme.textMuted;
                    }}>
                    <X size={10} />
                  </button>
                </>
              )}
              {renderModule(id)}
            </div>
          );
        })}
      </div>

      {/* ── Add Modules panel (edit mode) ── */}
      {editing && hiddenModules.length > 0 && (
        <div style={{ marginTop: 36, paddingTop: 28, borderTop: `1px solid ${theme.bgCardBorder}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Plus size={15} style={{ color: theme.accent }} />
            <h3 style={{ color: theme.textPrimary, fontSize: "0.88rem", fontWeight: 600 }}>
              Add Modules
            </h3>
            <span style={{ color: theme.textMuted, fontSize: "0.75rem" }}>
              — click a card to add it to your dashboard
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
            {hiddenModules.map(m => (
              <button
                key={m.id}
                onClick={() => showModule(m.id)}
                className="flex items-start gap-3 rounded-2xl text-left"
                style={{
                  padding: "14px 16px",
                  background: theme.iconBg,
                  border: `1.5px dashed ${theme.bgCardBorder}`,
                  color: theme.textSecondary,
                  transition: "all 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.borderColor = theme.accent;
                  b.style.background  = theme.accentLight;
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.borderColor = theme.bgCardBorder;
                  b.style.background  = theme.iconBg;
                }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: theme.textPrimary, fontSize: "0.83rem", fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ color: theme.textMuted, fontSize: "0.72rem", lineHeight: 1.4 }}>{m.desc}</div>
                </div>
                <Plus size={13} style={{ color: theme.accent, flexShrink: 0, alignSelf: "center", marginLeft: 4 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── All modules added confirmation ── */}
      {editing && hiddenModules.length === 0 && (
        <div style={{ marginTop: 36, paddingTop: 28, borderTop: `1px solid ${theme.bgCardBorder}`, textAlign: "center" }}>
          <p style={{ color: theme.textMuted, fontSize: "0.83rem" }}>
            ✅ All available modules are on your dashboard.
          </p>
        </div>
      )}

    </div>
  );
}
