import { useState, useEffect } from "react";
import {
  Plus, Circle, CheckCircle2, Trash2, Edit3,
  CalendarDays, Star, X, AlertCircle, RotateCcw, Ban, MessageSquare,
} from "lucide-react";
import { getDb } from "../db/database";
import { useThemeStore } from "../store/themeStore";
import { useAppStore } from "../store/appStore";
import { getLocalDateString } from "../utils/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Task {
  id: number;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  goal_id: number | null;
  goal_title?: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  due_date: string | null;
  completed_at: string | null;
  points_value: number;
  is_comeback: number;
  created_at: string;
}

interface Goal {
  id: number;
  title: string;
}

type TabType = "today" | "upcoming" | "all" | "completed" | "missed";
type SortType = "priority" | "due_date" | "points" | "created";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const SORT_OPTIONS: { id: SortType; label: string; emoji: string }[] = [
  { id: "priority", label: "Priority", emoji: "🎯" },
  { id: "due_date", label: "Due Date", emoji: "📅" },
  { id: "points",   label: "Points",   emoji: "💎" },
  { id: "created",  label: "Newest",   emoji: "🕐" },
];

const PRIORITY_CONFIG: Record<string, { color: string; label: string; dot: string }> = {
  low:    { color: "#22c55e", label: "Low",     dot: "🟢" },
  medium: { color: "#f59e0b", label: "Medium",  dot: "🟡" },
  high:   { color: "#ef4444", label: "High",    dot: "🔴" },
  urgent: { color: "#dc2626", label: "Urgent!", dot: "🚨" },
};

const CATEGORY_EMOJIS: Record<string, string> = {
  general:   "📋",
  health:    "💪",
  work:      "💼",
  personal:  "🌟",
  financial: "💰",
  family:    "👨‍👩‍👧",
  spiritual: "🙏",
};

const TASK_CATEGORIES = [
  { id: "general",   label: "General",   emoji: "📋" },
  { id: "health",    label: "Health",    emoji: "💪" },
  { id: "work",      label: "Work",      emoji: "💼" },
  { id: "personal",  label: "Personal",  emoji: "🌟" },
  { id: "financial", label: "Financial", emoji: "💰" },
  { id: "family",    label: "Family",    emoji: "👨‍👩‍👧" },
  { id: "spiritual", label: "Spiritual", emoji: "🙏" },
];

const MISS_REASONS = [
  { emoji: "🤒", label: "Sick / Not well" },
  { emoji: "😴", label: "Overslept" },
  { emoji: "🚗", label: "Traffic / Late" },
  { emoji: "👨‍👩‍👧", label: "Family" },
  { emoji: "⚡", label: "Emergency" },
  { emoji: "☁️", label: "Weather" },
  { emoji: "😔", label: "Lost motivation" },
  { emoji: "💼", label: "Work conflict" },
];

// ─── TasksPage ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { theme } = useThemeStore();
  const { addTodayPoints } = useAppStore();

  const [tasks, setTasks]               = useState<Task[]>([]);
  const [goals, setGoals]               = useState<Goal[]>([]);
  const [activeTab, setActiveTab]       = useState<TabType>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortType>("priority");
  const [showModal, setShowModal]       = useState(false);
  const [editingTask, setEditingTask]   = useState<Task | null>(null);
  const [loading, setLoading]           = useState(true);
  const [justCompleted, setJustCompleted] = useState<number | null>(null);
  const [taskStats, setTaskStats]       = useState({ todayCount: 0, overdueCount: 0, urgentCount: 0, completedCount: 0 });

  // ── Miss modal state ──
  const [missTarget, setMissTarget]           = useState<Task | null>(null);
  const [missReflection, setMissReflection]   = useState("");
  const [missReschedule, setMissReschedule]   = useState("");
  const [showMissModal, setShowMissModal]     = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
    priority: "medium",
    scheduled_date: "",
    scheduled_time: "",
    due_date: "",
    goal_id: "",
    points_value: "5",
  });

  useEffect(() => { loadTasks(); }, [activeTab]);
  useEffect(() => { loadGoals(); loadStats(); }, []);

  // ─── Data ─────────────────────────────────────────────────────────────────
  async function loadTasks() {
    setLoading(true);
    try {
      const db = await getDb();
      const today = getLocalDateString();
      let query = `
        SELECT t.*, g.title as goal_title
        FROM tasks t
        LEFT JOIN goals g ON t.goal_id = g.id
      `;
      let params: string[] = [];

      if (activeTab === "today") {
        query += " WHERE t.status NOT IN ('completed','missed') AND (t.scheduled_date = ? OR t.due_date = ?)";
        params = [today, today];
      } else if (activeTab === "upcoming") {
        query += " WHERE t.status NOT IN ('completed','missed') AND (t.scheduled_date > ? OR (t.due_date > ? AND t.scheduled_date IS NULL))";
        params = [today, today];
      } else if (activeTab === "completed") {
        query += " WHERE t.status = 'completed' ORDER BY t.completed_at DESC LIMIT 100";
      } else if (activeTab === "missed") {
        query += " WHERE t.status = 'missed' ORDER BY t.created_at DESC LIMIT 100";
      } else {
        // "all" = all active (not completed, not missed), include unscheduled
        query += " WHERE t.status NOT IN ('completed','missed')";
      }

      if (activeTab !== "completed" && activeTab !== "missed") {
        query += ` ORDER BY
          CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
          CASE WHEN t.scheduled_date IS NOT NULL THEN t.scheduled_date ELSE '9999-12-31' END,
          t.created_at DESC`;
      }

      const results = await db.select<Task[]>(query, params);
      setTasks(results);
    } catch (e) {
      console.error("Load tasks error", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadGoals() {
    try {
      const db = await getDb();
      const results = await db.select<Goal[]>(
        "SELECT id, title FROM goals WHERE status = 'active' ORDER BY title"
      );
      setGoals(results);
    } catch (e) {
      console.error("Load goals error", e);
    }
  }

  async function loadStats() {
    try {
      const db = await getDb();
      const today = getLocalDateString();
      const [todayR, overdueR, urgentR, completedR] = await Promise.all([
        db.select<[{ c: number }]>(
          `SELECT COUNT(*) as c FROM tasks WHERE status NOT IN ('completed','missed') AND scheduled_date = ?`, [today]
        ),
        db.select<[{ c: number }]>(
          `SELECT COUNT(*) as c FROM tasks WHERE status NOT IN ('completed','missed') AND (scheduled_date < ? OR (due_date < ? AND scheduled_date IS NULL))`, [today, today]
        ),
        db.select<[{ c: number }]>(
          `SELECT COUNT(*) as c FROM tasks WHERE status NOT IN ('completed','missed') AND priority = 'urgent'`
        ),
        db.select<[{ c: number }]>(
          `SELECT COUNT(*) as c FROM tasks WHERE status = 'completed'`
        ),
      ]);
      setTaskStats({
        todayCount:    todayR[0].c,
        overdueCount:  overdueR[0].c,
        urgentCount:   urgentR[0].c,
        completedCount: completedR[0].c,
      });
    } catch (e) {
      console.error("Load stats error", e);
    }
  }

  // ─── Complete (with comeback bonus) ──────────────────────────────────────
  async function completeTask(task: Task) {
    setJustCompleted(task.id);
    try {
      const db  = await getDb();
      const now   = new Date().toISOString();           // UTC timestamp for completed_at
      const today = getLocalDateString();               // local date for points_log entry_date
      await db.execute(
        "UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
        [now, now, task.id]
      );

      const isComeback  = task.is_comeback === 1;
      const base        = task.points_value;
      const bonus       = isComeback ? Math.ceil(base * 0.5) : 0;
      const total       = base + bonus;
      const reason      = isComeback
        ? `🔄 Comeback: ${task.title} (+${bonus} bonus!)`
        : `Completed: ${task.title}`;

      await db.execute(
        "INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (?, ?, 'task', ?, ?)",
        [total, reason, task.id, today]
      );
      addTodayPoints(total);
      setTimeout(() => { setJustCompleted(null); loadTasks(); loadStats(); }, 500);
    } catch (e) {
      console.error("Complete task error", e);
      setJustCompleted(null);
    }
  }

  async function uncompleteTask(task: Task) {
    try {
      const db = await getDb();
      await db.execute(
        "UPDATE tasks SET status = 'pending', completed_at = NULL, updated_at = datetime('now') WHERE id = ?",
        [task.id]
      );
      loadTasks();
    } catch (e) {
      console.error("Uncomplete task error", e);
    }
  }

  async function deleteTask(id: number) {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM tasks WHERE id = ?", [id]);
      loadTasks();
    } catch (e) {
      console.error("Delete task error", e);
    }
  }

  // ─── Miss modal ───────────────────────────────────────────────────────────
  function openMissModal(task: Task) {
    setMissTarget(task);
    setMissReflection("");
    setMissReschedule("");
    setShowMissModal(true);
  }

  function closeMissModal() {
    setMissTarget(null);
    setMissReflection("");
    setMissReschedule("");
    setShowMissModal(false);
  }

  async function confirmMiss() {
    if (!missTarget) return;
    const db    = await getDb();
    const today = getLocalDateString();

    // Mark task as missed
    await db.execute(
      "UPDATE tasks SET status = 'missed', updated_at = datetime('now') WHERE id = ?",
      [missTarget.id]
    );

    // Log to missed_log
    const reflPts = missReflection.trim() ? 1 : 0;
    await db.execute(
      `INSERT INTO missed_log (source_type, source_id, title, reflection_text, reflection_points, missed_date)
       VALUES ('task', ?, ?, ?, ?, ?)`,
      [missTarget.id, missTarget.title, missReflection.trim() || null, reflPts, today]
    );

    // Award reflection points
    if (reflPts > 0) {
      await db.execute(
        "INSERT INTO points_log (points, reason, source_type, entry_date) VALUES (?, ?, 'reflection', ?)",
        [reflPts, `💭 Reflection: ${missTarget.title}`, today]
      );
      addTodayPoints(reflPts);
    }

    // Create comeback task if reschedule date provided
    if (missReschedule.trim()) {
      await db.execute(
        `INSERT INTO tasks (title, description, category, priority, scheduled_date, scheduled_time, due_date, goal_id, points_value, is_comeback)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          missTarget.title,
          missTarget.description || null,
          missTarget.category,
          missTarget.priority,
          missReschedule.trim(),
          missTarget.scheduled_time || null,
          null,
          missTarget.goal_id || null,
          missTarget.points_value,
        ]
      );
    }

    closeMissModal();
    loadTasks();
    loadStats();
  }

  // ─── Save task ────────────────────────────────────────────────────────────
  async function saveTask() {
    if (!form.title.trim()) return;
    try {
      const db = await getDb();
      if (editingTask) {
        await db.execute(
          `UPDATE tasks SET title=?, description=?, category=?, priority=?,
           scheduled_date=?, scheduled_time=?, due_date=?, goal_id=?, points_value=?,
           updated_at=datetime('now') WHERE id=?`,
          [
            form.title.trim(),
            form.description || null,
            form.category,
            form.priority,
            form.scheduled_date || null,
            form.scheduled_time || null,
            form.due_date || null,
            form.goal_id ? parseInt(form.goal_id) : null,
            parseInt(form.points_value) || 5,
            editingTask.id,
          ]
        );
      } else {
        await db.execute(
          `INSERT INTO tasks (title, description, category, priority, scheduled_date, scheduled_time, due_date, goal_id, points_value)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            form.title.trim(),
            form.description || null,
            form.category,
            form.priority,
            form.scheduled_date || null,
            form.scheduled_time || null,
            form.due_date || null,
            form.goal_id ? parseInt(form.goal_id) : null,
            parseInt(form.points_value) || 5,
          ]
        );
      }
      closeModal();
      loadTasks();
    } catch (e) {
      console.error("Save task error", e);
    }
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────
  function openNewTask(prefillDate?: string) {
    const today = prefillDate ?? getLocalDateString();
    setEditingTask(null);
    setForm({
      title: "", description: "", category: "general", priority: "medium",
      scheduled_date: today, scheduled_time: "", due_date: "", goal_id: "", points_value: "5",
    });
    setShowModal(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      priority: task.priority,
      scheduled_date: task.scheduled_date ?? "",
      scheduled_time: task.scheduled_time ?? "",
      due_date: task.due_date ?? "",
      goal_id: task.goal_id ? String(task.goal_id) : "",
      points_value: String(task.points_value),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTask(null);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function formatDate(d: string | null) {
    if (!d) return null;
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function isOverdue(task: Task) {
    if (task.status === "completed" || task.status === "missed") return false;
    const today = getLocalDateString();
    const dateToCheck = task.due_date ?? task.scheduled_date;
    return dateToCheck ? dateToCheck < today : false;
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  const tabs: { id: TabType; label: string; emoji: string }[] = [
    { id: "today",     label: "Today",      emoji: "📅" },
    { id: "upcoming",  label: "Upcoming",   emoji: "🗓️" },
    { id: "all",       label: "All Active", emoji: "📋" },
    { id: "completed", label: "Completed",  emoji: "✅" },
    { id: "missed",    label: "Missed",     emoji: "😔" },
  ];

  // ─── Shared input style ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: theme.bgInput,
    border: `1px solid ${theme.bgCardBorder}`,
    color: theme.textPrimary,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: "0.875rem",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    color: theme.textSecondary,
    fontSize: "0.75rem",
    fontWeight: 600,
    display: "block",
    marginBottom: 6,
    letterSpacing: "0.02em",
  };

  // ─── Empty state messages ─────────────────────────────────────────────────
  const emptyMessages: Record<TabType, { emoji: string; msg: string }> = {
    today:     { emoji: "🌟", msg: "No tasks scheduled for today — you're free!" },
    upcoming:  { emoji: "🗓️", msg: "No upcoming tasks. Plan ahead and add some!" },
    all:       { emoji: "📋", msg: "No active tasks. Press + New Task to get started." },
    completed: { emoji: "🏆", msg: "No completed tasks yet. Start checking things off!" },
    missed:    { emoji: "🌱", msg: "Nothing missed — you're on a roll!" },
  };

  const reflPts = missReflection.trim() ? 2 : 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: theme.textPrimary, fontSize: 28, fontWeight: 800, margin: 0 }}>Tasks</h1>
          <p style={{ color: theme.textMuted, fontSize: 14, margin: "4px 0 0" }}>
            Stay on track and get things done
          </p>
        </div>
        <button
          onClick={() => openNewTask()}
          style={{ background: theme.accent, color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}
        >
          <Plus size={17} /> New Task
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Today",    value: taskStats.todayCount,     color: PRIORITY_CONFIG.medium.color, icon: "📅" },
          { label: "Overdue",  value: taskStats.overdueCount,   color: PRIORITY_CONFIG.high.color,   icon: "⚠️" },
          { label: "Urgent",   value: taskStats.urgentCount,    color: PRIORITY_CONFIG.urgent.color,  icon: "🚨" },
          { label: "Completed",value: taskStats.completedCount, color: "#10b981",                    icon: "✅" },
        ].map(s => (
          <div key={s.label} style={{ background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`, borderTop: `3px solid ${s.color}`, borderRadius: 14, padding: "14px 16px", textAlign: "center", boxShadow: theme.bgCardShadow }}>
            <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: theme.textMuted, fontSize: 11, fontWeight: 600, marginTop: 4, letterSpacing: "0.03em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          const missedActive = active && tab.id === "missed";
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setCategoryFilter("all"); }}
              style={{
                padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                background: missedActive ? "#ef4444" : active ? theme.accent : theme.bgCard,
                color: active ? "#fff" : theme.textSecondary,
                transition: "all 0.15s",
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Category filter ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => setCategoryFilter("all")}
          style={{ padding: "5px 12px", borderRadius: 14, border: `1px solid ${categoryFilter === "all" ? theme.accent : theme.bgCardBorder}`, cursor: "pointer", background: categoryFilter === "all" ? theme.accentLight : "transparent", color: categoryFilter === "all" ? theme.accent : theme.textMuted, fontWeight: categoryFilter === "all" ? 700 : 500, fontSize: 12, transition: "all 0.15s" }}>
          All
        </button>
        {TASK_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
            style={{ padding: "5px 12px", borderRadius: 14, border: `1px solid ${categoryFilter === cat.id ? theme.accent : theme.bgCardBorder}`, cursor: "pointer", background: categoryFilter === cat.id ? theme.accentLight : "transparent", color: categoryFilter === cat.id ? theme.accent : theme.textMuted, fontWeight: categoryFilter === cat.id ? 700 : 500, fontSize: 12, transition: "all 0.15s" }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* ── Sort control ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ color: theme.textMuted, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Sort:</span>
        {SORT_OPTIONS.map(opt => (
          <button key={opt.id} onClick={() => setSortBy(opt.id)}
            style={{ padding: "4px 11px", borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: 12, border: `1px solid ${sortBy === opt.id ? theme.accent : theme.bgCardBorder}`, background: sortBy === opt.id ? theme.accentLight : "transparent", color: sortBy === opt.id ? theme.accent : theme.textMuted, transition: "all 0.12s" }}>
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>

      {/* ── Task list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p style={{ color: theme.textMuted, fontSize: "0.9rem" }}>Loading tasks…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div style={{ fontSize: "3.5rem" }}>{emptyMessages[activeTab].emoji}</div>
          <p style={{ color: theme.textMuted, fontSize: "0.95rem", textAlign: "center" }}>
            {emptyMessages[activeTab].msg}
          </p>
          {activeTab !== "completed" && activeTab !== "missed" && (
            <button
              onClick={() => openNewTask()}
              className="px-4 py-2 rounded-xl text-sm font-semibold mt-1"
              style={{ background: theme.accentLight, color: theme.accent, border: `1px solid ${theme.bgCardBorder}` }}
            >
              + Add a task
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tasks
            .filter(t => categoryFilter === "all" || t.category === categoryFilter)
            .sort((a, b) => {
              if (sortBy === "priority")
                return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
              if (sortBy === "due_date") {
                const da = a.scheduled_date ?? a.due_date ?? "9999-12-31";
                const db = b.scheduled_date ?? b.due_date ?? "9999-12-31";
                return da.localeCompare(db);
              }
              if (sortBy === "points") return b.points_value - a.points_value;
              return b.created_at.localeCompare(a.created_at);
            })
            .map((task) => {
            const pc         = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
            const overdue    = isOverdue(task);
            const completing = justCompleted === task.id;
            const isMissed   = task.status === "missed";
            const isCompleted = task.status === "completed";
            const isComeback = task.is_comeback === 1;
            const borderColor = isMissed ? "#ef4444" : isCompleted ? "#10b981" : pc.color;

            return (
              <div
                key={task.id}
                style={{
                  background: theme.bgCard,
                  borderRadius: 16,
                  border: `1px solid ${overdue ? "#ef444444" : theme.bgCardBorder}`,
                  borderLeft: `4px solid ${borderColor}`,
                  boxShadow: theme.bgCardShadow,
                  overflow: "hidden",
                  opacity: completing ? 0.5 : 1,
                  transition: "opacity 0.3s ease",
                }}
              >
                {/* Overdue banner */}
                {overdue && (
                  <div style={{ background: "#ef444412", borderBottom: "1px solid #ef444430", padding: "5px 18px", fontSize: 12, color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={12} /> Overdue
                  </div>
                )}

                {/* Comeback banner */}
                {isComeback && !isMissed && !isCompleted && (
                  <div style={{ background: "#f59e0b12", borderBottom: "1px solid #f59e0b30", padding: "5px 18px", fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>
                    🔄 Comeback task — complete for +50% bonus!
                  </div>
                )}

                {/* ── Body ── */}
                <div style={{ padding: "14px 18px 12px", display: "flex", alignItems: "flex-start", gap: 12 }}>

                  {/* Checkbox / status icon */}
                  {isMissed ? (
                    <div style={{ color: "#ef4444", flexShrink: 0, paddingTop: 2 }}><Ban size={20} /></div>
                  ) : (
                    <button
                      onClick={() => isCompleted ? uncompleteTask(task) : completeTask(task)}
                      title={isCompleted ? "Reopen task" : "Mark complete"}
                      style={{ color: isCompleted ? "#10b981" : theme.textMuted, background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 0, paddingTop: 2, transition: "color 0.15s" }}
                      onMouseEnter={e => !isCompleted && (e.currentTarget.style.color = pc.color)}
                      onMouseLeave={e => !isCompleted && (e.currentTarget.style.color = theme.textMuted)}
                    >
                      {isCompleted ? <CheckCircle2 size={21} /> : <Circle size={21} />}
                    </button>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Title + badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <h3 style={{
                        color: isMissed ? "#ef4444" : theme.textPrimary,
                        fontSize: 15, fontWeight: 700, margin: 0,
                        textDecoration: (isCompleted || isMissed) ? "line-through" : "none",
                        opacity: (isCompleted || isMissed) ? 0.7 : 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {task.title}
                      </h3>
                      {!isMissed && (
                        <span style={{
                          flexShrink: 0, display: "flex", alignItems: "center", gap: 3,
                          background: `${pc.color}20`, color: pc.color,
                          border: `1px solid ${pc.color}40`,
                          borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700,
                        }}>
                          {task.priority === "urgent" && <AlertCircle size={9} />}
                          {pc.label}
                        </span>
                      )}
                      {isMissed && (
                        <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: 8, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>😔 Missed</span>
                      )}
                    </div>

                    {/* Description */}
                    {task.description && (
                      <p style={{ color: theme.textSecondary, fontSize: 13, margin: "0 0 8px", lineHeight: 1.5 }}>
                        {task.description}
                      </p>
                    )}

                    {/* Meta row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ color: theme.textMuted, fontSize: 12 }}>
                        {CATEGORY_EMOJIS[task.category] ?? "📋"} {task.category}
                      </span>
                      {(task.scheduled_date || task.due_date) && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: overdue ? "#ef4444" : theme.textMuted, fontSize: 12, fontWeight: overdue ? 700 : 400 }}>
                          <CalendarDays size={11} />
                          {formatDate(task.scheduled_date ?? task.due_date)}
                          {task.scheduled_time && ` · ${task.scheduled_time}`}
                        </span>
                      )}
                      {task.goal_title && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, background: theme.accentLight, color: theme.accent, fontSize: 11, fontWeight: 600 }}>
                          🎯 {task.goal_title}
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 3, color: pc.color, fontSize: 12, fontWeight: 700 }}>
                        <Star size={10} fill={pc.color} color={pc.color} />
                        {isComeback && !isMissed
                          ? `${task.points_value} pts (+${Math.ceil(task.points_value * 0.5)} bonus)`
                          : `${task.points_value} pts`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Action bar ── */}
                <div style={{ borderTop: `1px solid ${theme.bgCardBorder}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 4, background: (theme.bgInput + "60") }}>
                  <div style={{ display: "flex", gap: 2, flex: 1 }}>
                    {isMissed ? (
                      <button onClick={() => deleteTask(task.id)} title="Delete"
                        style={{ background: "none", color: "#ef444466", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#ef444466")}>
                        <Trash2 size={14} />
                      </button>
                    ) : isCompleted ? (
                      <>
                        <button onClick={() => uncompleteTask(task)} title="Reopen task"
                          style={{ background: "none", color: theme.textMuted, border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget.style.color = theme.textPrimary)}
                          onMouseLeave={e => (e.currentTarget.style.color = theme.textMuted)}>
                          <RotateCcw size={14} />
                        </button>
                        <button onClick={() => deleteTask(task.id)} title="Delete"
                          style={{ background: "none", color: "#ef444455", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#ef444455")}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openEditTask(task)} title="Edit"
                          style={{ background: "none", color: theme.textMuted, border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget.style.color = theme.textPrimary)}
                          onMouseLeave={e => (e.currentTarget.style.color = theme.textMuted)}>
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => openMissModal(task)} title="Mark as missed"
                          style={{ background: "none", color: "#ef444466", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#ef444466")}>
                          <Ban size={14} />
                        </button>
                        <button onClick={() => deleteTask(task.id)} title="Delete"
                          style={{ background: "none", color: "#ef444455", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#ef444455")}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Primary action */}
                  {!isMissed && !isCompleted && (
                    <button onClick={() => completeTask(task)}
                      style={{ background: `${pc.color}18`, color: pc.color, border: `1px solid ${pc.color}28`, borderRadius: 9, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <CheckCircle2 size={13} /> Done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Miss Modal ── */}
      {showMissModal && missTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="rounded-3xl p-6 w-full mx-4"
            style={{
              maxWidth: 480,
              background: theme.bgCard,
              boxShadow: `0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(239,68,68,0.25)`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold flex items-center gap-2" style={{ color: "#ef4444", fontSize: "1.15rem" }}>
                  <Ban size={18} /> Mark as Missed
                </h2>
                <p style={{ color: theme.textMuted, fontSize: "0.82rem", marginTop: 2 }}>
                  "{missTarget.title}"
                </p>
              </div>
              <button
                onClick={closeMissModal}
                className="p-1.5 rounded-full"
                style={{ color: theme.textMuted, background: theme.iconBg }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Reflection section */}
            <div
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.bgCardBorder}`,
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 14,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={14} style={{ color: theme.accent }} />
                <span style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.88rem" }}>
                  What got in the way?
                </span>
                <span style={{
                  marginLeft: "auto",
                  background: reflPts > 0 ? "#10b98118" : theme.iconBg,
                  color: reflPts > 0 ? "#10b981" : theme.textMuted,
                  borderRadius: 8, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700,
                }}>
                  {reflPts > 0 ? `+${reflPts} pts` : "Optional — earns +2 pts"}
                </span>
              </div>

              {/* Preset reasons */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {MISS_REASONS.map((r) => {
                  const selected = missReflection === r.label;
                  return (
                    <button
                      key={r.label}
                      onClick={() => setMissReflection(selected ? "" : r.label)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 16,
                        fontSize: "0.78rem",
                        fontWeight: selected ? 700 : 500,
                        border: `1px solid ${selected ? "#ef4444" : theme.bgCardBorder}`,
                        background: selected ? "rgba(239,68,68,0.12)" : theme.bgCard,
                        color: selected ? "#ef4444" : theme.textMuted,
                        cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                    >
                      {r.emoji} {r.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom text */}
              <textarea
                rows={2}
                placeholder="Or write your own reason…"
                value={missReflection}
                onChange={(e) => setMissReflection(e.target.value)}
                style={{
                  width: "100%",
                  background: theme.bgCard,
                  border: `1px solid ${theme.bgCardBorder}`,
                  color: theme.textPrimary,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: "0.85rem",
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Reschedule section */}
            <div
              style={{
                background: theme.bgInput,
                border: `1px solid ${theme.bgCardBorder}`,
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 18,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} style={{ color: theme.accent }} />
                <span style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.88rem" }}>
                  Reschedule? (optional)
                </span>
              </div>
              <input
                type="date"
                value={missReschedule}
                min={getLocalDateString()}
                onChange={(e) => setMissReschedule(e.target.value)}
                style={{
                  width: "100%",
                  background: theme.bgCard,
                  border: `1px solid ${theme.bgCardBorder}`,
                  color: theme.textPrimary,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: "0.85rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {missReschedule && (
                <p style={{ color: "#f59e0b", fontSize: "0.75rem", marginTop: 6, fontWeight: 600 }}>
                  🔄 A comeback task will be created — earn +50% bonus when completed!
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeMissModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: theme.iconBg, color: theme.textMuted, border: `1px solid ${theme.bgCardBorder}` }}
              >
                Cancel
              </button>
              <button
                onClick={confirmMiss}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff" }}
              >
                {reflPts > 0 ? "Log Miss (+2 pts)" : "Mark as Missed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="rounded-3xl w-full mx-4 overflow-y-auto"
            style={{
              maxWidth: 520,
              maxHeight: "90vh",
              padding: "28px 28px 24px",
              background: theme.bgCard,
              boxShadow: `0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px ${theme.bgCardBorder}`,
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold" style={{ color: theme.textPrimary, fontSize: "1.2rem" }}>
                {editingTask ? "✏️ Edit Task" : "✅ New Task"}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-full" style={{ color: theme.textMuted, background: theme.iconBg }}>
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label style={labelStyle}>Task Title *</label>
                <input style={inputStyle} placeholder="What needs to be done?" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && saveTask()} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Description (optional)</label>
                <textarea style={{ ...inputStyle, resize: "none", minHeight: 56 }} placeholder="Add details or context…"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {Object.entries(CATEGORY_EMOJIS).map(([val, emoji]) => (
                      <option key={val} value={val}>{emoji} {val.charAt(0).toUpperCase() + val.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                    <option value="urgent">🚨 Urgent!</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Scheduled Date</label>
                  <input type="date" style={inputStyle} value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Scheduled Time</label>
                  <input type="time" style={inputStyle} value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Due Date (optional)</label>
                  <input type="date" style={inputStyle} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>⭐ Points Value</label>
                  <input type="number" style={inputStyle} min="1" max="100" value={form.points_value}
                    onChange={(e) => setForm({ ...form, points_value: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Link to Goal (optional)</label>
                <select style={inputStyle} value={form.goal_id} onChange={(e) => setForm({ ...form, goal_id: e.target.value })}>
                  <option value="">— No goal linked —</option>
                  {goals.map((g) => (<option key={g.id} value={g.id}>🎯 {g.title}</option>))}
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: theme.iconBg, color: theme.textMuted, border: `1px solid ${theme.bgCardBorder}` }}>
                  Cancel
                </button>
                <button onClick={saveTask} disabled={!form.title.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{
                    background: form.title.trim() ? theme.accentGradient : theme.progressBg,
                    color: form.title.trim() ? "#fff" : theme.textMuted,
                    cursor: form.title.trim() ? "pointer" : "not-allowed",
                  }}>
                  {editingTask ? "Save Changes" : "Add Task ✅"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
