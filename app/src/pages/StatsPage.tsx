import { useEffect, useState, useCallback } from "react";
import { BarChart2, RefreshCw, Trophy, Target, Flame, Calendar } from "lucide-react";
import { getDb } from "../db/database";
import { useThemeStore } from "../store/themeStore";
import { getLocalDateString } from "../utils/dateUtils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HeroStats {
  totalPoints: number;
  monthPoints: number;
  goalsCompleted: number;
  goalsActive: number;
  tasksCompleted: number;
  journalEntries: number;
  gratitudesCount: number;
  longestCurrentStreak: number;
  bestEverStreak: number;
  checkInsTotal: number;
  wordsWritten: number;
  eventsCompleted: number;
}

interface DailyPoints { entry_date: string; total: number; }
interface SourceBreakdown { source_type: string; total: number; }
interface GoalStatusRow { status: string; count: number; }
interface GoalTypeRow { goal_type: string; count: number; }
interface TopStreakRow { title: string; streak_current: number; streak_best: number; category: string; }

// ─── Constants ───────────────────────────────────────────────────────────────

const SRC_EMOJI: Record<string, string> = {
  goal: "🎯", journal: "📓", gratitude: "🙏", habit: "✅", task: "📋",
  reflection: "💭", event: "🗓️", check_in: "🔥", milestone: "🏁", streak_bonus: "⚡",
};
const SRC_LABEL: Record<string, string> = {
  goal: "Goals", journal: "Journal", gratitude: "Gratitude", habit: "Habits",
  task: "Tasks", reflection: "Reflections", event: "Events",
  check_in: "Check-ins", milestone: "Milestones", streak_bonus: "Streak Bonuses",
};
const SRC_COLOR: Record<string, string> = {
  goal: "#10b981", journal: "#6366f1", gratitude: "#f59e0b", habit: "#ec4899",
  task: "#3b82f6", reflection: "#a855f7", event: "#06b6d4",
  check_in: "#f59e0b", milestone: "#8b5cf6", streak_bonus: "#fbbf24",
};
const GOAL_TYPE_LABEL: Record<string, string> = {
  standard: "Standard", metric: "Metric", habit: "Habit", milestone: "Milestone",
};
const GOAL_TYPE_EMOJI: Record<string, string> = {
  standard: "🎯", metric: "📊", habit: "🔥", milestone: "🏁",
};
const GOAL_TYPE_COLOR: Record<string, string> = {
  standard: "#3b82f6", metric: "#10b981", habit: "#f59e0b", milestone: "#8b5cf6",
};
const STATUS_COLOR: Record<string, string> = {
  active: "#10b981", completed: "#3b82f6", archived: "#6b7280", missed: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active", completed: "Completed", archived: "Archived", missed: "Missed",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { theme } = useThemeStore();

  const [hero, setHero] = useState<HeroStats | null>(null);
  const [dailyPoints, setDailyPoints] = useState<DailyPoints[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceBreakdown[]>([]);
  const [goalStatus, setGoalStatus] = useState<GoalStatusRow[]>([]);
  const [goalTypes, setGoalTypes] = useState<GoalTypeRow[]>([]);
  const [topStreaks, setTopStreaks] = useState<TopStreakRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const today = getLocalDateString();

  const thirtyDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  })();

  const monthPrefix = today.slice(0, 7);

  const loadAll = useCallback(async () => {
    try {
      const db = await getDb();

      // ── Hero stats (parallel) ──────────────────────────────────────────────
      const [
        totalPtsRes, monthPtsRes,
        goalDoneRes, goalActiveRes,
        taskDoneRes, journalRes, gratRes,
        streakRes, checkInsRes, wordsRes, eventsDoneRes,
      ] = await Promise.all([
        db.select<[{ total: number }]>("SELECT COALESCE(SUM(points), 0) as total FROM points_log"),
        db.select<[{ total: number }]>(
          "SELECT COALESCE(SUM(points), 0) as total FROM points_log WHERE entry_date LIKE ?",
          [`${monthPrefix}-%`]
        ),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM goals WHERE status='completed'"),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM goals WHERE status='active'"),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM tasks WHERE status='completed'"),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM journal_entries"),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM gratitudes"),
        db.select<[{ best: number; current: number }]>(
          "SELECT COALESCE(MAX(streak_best), 0) as best, COALESCE(MAX(streak_current), 0) as current FROM goals WHERE goal_type='habit'"
        ),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM goal_check_ins WHERE is_success=1"),
        db.select<[{ total: number }]>(
          "SELECT COALESCE(SUM(COALESCE(word_count, 0)), 0) as total FROM journal_entries"
        ),
        db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM events WHERE event_status='completed'"),
      ]);

      setHero({
        totalPoints:          totalPtsRes[0]?.total          ?? 0,
        monthPoints:          monthPtsRes[0]?.total          ?? 0,
        goalsCompleted:       goalDoneRes[0]?.count          ?? 0,
        goalsActive:          goalActiveRes[0]?.count        ?? 0,
        tasksCompleted:       taskDoneRes[0]?.count          ?? 0,
        journalEntries:       journalRes[0]?.count           ?? 0,
        gratitudesCount:      gratRes[0]?.count              ?? 0,
        longestCurrentStreak: streakRes[0]?.current         ?? 0,
        bestEverStreak:       streakRes[0]?.best             ?? 0,
        checkInsTotal:        checkInsRes[0]?.count          ?? 0,
        wordsWritten:         wordsRes[0]?.total             ?? 0,
        eventsCompleted:      eventsDoneRes[0]?.count        ?? 0,
      });

      // ── Chart / breakdown data ─────────────────────────────────────────────
      const [dailyRes, srcRes, statusRes, typeRes, streakTopRes] = await Promise.all([
        db.select<DailyPoints[]>(
          "SELECT entry_date, SUM(points) as total FROM points_log WHERE entry_date >= ? AND entry_date <= ? GROUP BY entry_date ORDER BY entry_date",
          [thirtyDaysAgo, today]
        ),
        db.select<SourceBreakdown[]>(
          "SELECT source_type, COALESCE(SUM(points), 0) as total FROM points_log GROUP BY source_type ORDER BY total DESC"
        ),
        db.select<GoalStatusRow[]>(
          "SELECT status, COUNT(*) as count FROM goals GROUP BY status ORDER BY count DESC"
        ),
        db.select<GoalTypeRow[]>(
          "SELECT COALESCE(goal_type, 'standard') as goal_type, COUNT(*) as count FROM goals WHERE status='active' GROUP BY goal_type ORDER BY count DESC"
        ),
        db.select<TopStreakRow[]>(
          "SELECT title, streak_current, streak_best, category FROM goals WHERE goal_type='habit' AND status='active' ORDER BY streak_current DESC LIMIT 6"
        ),
      ]);

      setDailyPoints(dailyRes);
      setSourceBreakdown(srcRes);
      setGoalStatus(statusRes);
      setGoalTypes(typeRes);
      setTopStreaks(streakTopRes);
    } catch (e) {
      console.error("Stats load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today, thirtyDaysAgo, monthPrefix]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function handleRefresh() {
    setRefreshing(true);
    loadAll();
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const days30 = getLast30Days();
  const dailyMap: Record<string, number> = {};
  dailyPoints.forEach(d => { dailyMap[d.entry_date] = d.total; });
  const chartData = days30.map(d => ({ date: d, pts: dailyMap[d] ?? 0 }));
  const maxPts = Math.max(...chartData.map(d => d.pts), 1);
  const activeDays = chartData.filter(d => d.pts > 0).length;
  const maxSrc = sourceBreakdown.length > 0 ? sourceBreakdown[0].total : 1;
  const totalGoals = goalStatus.reduce((s, r) => s + r.count, 0) || 1;
  const maxTypeCount = goalTypes.length > 0 ? goalTypes[0].count : 1;
  const consistencyPct = Math.round((activeDays / 30) * 100);

  // ── Shared styles ────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: theme.bgCard,
    border: `1px solid ${theme.bgCardBorder}`,
    borderRadius: 16,
    padding: "20px 22px",
  };

  const sectionTitle: React.CSSProperties = {
    color: theme.textPrimary,
    fontSize: "0.88rem",
    fontWeight: 700,
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
    gap: 7,
  };

  const muteText: React.CSSProperties = { color: theme.textMuted, fontSize: "0.72rem" };
  const secText: React.CSSProperties = { color: theme.textSecondary, fontSize: "0.81rem" };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ color: theme.textMuted, fontSize: "0.9rem" }}>Loading stats…</div>
      </div>
    );
  }

  const h = hero!;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: theme.textPrimary, fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>
            📊 Stats &amp; Insights
          </h1>
          <p style={{ color: theme.textMuted, fontSize: "0.78rem", margin: "4px 0 0" }}>
            Your journey in numbers
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`,
            color: theme.textSecondary, borderRadius: 10, padding: "8px 14px",
            fontSize: "0.8rem", cursor: refreshing ? "not-allowed" : "pointer", fontWeight: 600,
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Hero Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 18 }}>
        {/* Total Points */}
        <div style={{ ...card, textAlign: "center", padding: "18px 14px" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>⭐</div>
          <div style={{ color: theme.textPrimary, fontSize: "1.55rem", fontWeight: 800, lineHeight: 1 }}>
            {fmtNum(h.totalPoints)}
          </div>
          <div style={{ color: theme.textMuted, fontSize: "0.67rem", fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Total Points
          </div>
          <div style={{ color: theme.accent, fontSize: "0.71rem", marginTop: 6, fontWeight: 600 }}>
            +{fmtNum(h.monthPoints)} this month
          </div>
        </div>

        {/* Goals */}
        <div style={{ ...card, textAlign: "center", padding: "18px 14px" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🎯</div>
          <div style={{ color: theme.textPrimary, fontSize: "1.55rem", fontWeight: 800, lineHeight: 1 }}>
            {h.goalsCompleted}
          </div>
          <div style={{ color: theme.textMuted, fontSize: "0.67rem", fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Goals Done
          </div>
          <div style={{ color: "#10b981", fontSize: "0.71rem", marginTop: 6, fontWeight: 600 }}>
            {h.goalsActive} active now
          </div>
        </div>

        {/* Best Streak */}
        <div style={{ ...card, textAlign: "center", padding: "18px 14px" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🔥</div>
          <div style={{ color: theme.textPrimary, fontSize: "1.55rem", fontWeight: 800, lineHeight: 1 }}>
            {h.longestCurrentStreak}<span style={{ fontSize: "0.9rem" }}>d</span>
          </div>
          <div style={{ color: theme.textMuted, fontSize: "0.67rem", fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Best Streak
          </div>
          <div style={{ color: "#f59e0b", fontSize: "0.71rem", marginTop: 6, fontWeight: 600 }}>
            all-time best: {h.bestEverStreak}d
          </div>
        </div>

        {/* Journal */}
        <div style={{ ...card, textAlign: "center", padding: "18px 14px" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>📓</div>
          <div style={{ color: theme.textPrimary, fontSize: "1.55rem", fontWeight: 800, lineHeight: 1 }}>
            {h.journalEntries}
          </div>
          <div style={{ color: theme.textMuted, fontSize: "0.67rem", fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Journal Entries
          </div>
          <div style={{ color: "#6366f1", fontSize: "0.71rem", marginTop: 6, fontWeight: 600 }}>
            {fmtNum(h.wordsWritten)} words written
          </div>
        </div>

        {/* Tasks */}
        <div style={{ ...card, textAlign: "center", padding: "18px 14px" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>✅</div>
          <div style={{ color: theme.textPrimary, fontSize: "1.55rem", fontWeight: 800, lineHeight: 1 }}>
            {fmtNum(h.tasksCompleted)}
          </div>
          <div style={{ color: theme.textMuted, fontSize: "0.67rem", fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Tasks Done
          </div>
          <div style={{ color: "#3b82f6", fontSize: "0.71rem", marginTop: 6, fontWeight: 600 }}>
            {h.checkInsTotal} check-ins
          </div>
        </div>
      </div>

      {/* ── Row 2: Activity Chart + Points by Source ────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14, marginBottom: 14 }}>

        {/* 30-Day Activity Chart */}
        <div style={card}>
          <div style={sectionTitle}>
            <BarChart2 size={16} color={theme.accent} />
            Points — Last 30 Days
            <span style={{ marginLeft: "auto", ...muteText, fontWeight: 500 }}>
              {activeDays}/30 active days
            </span>
          </div>

          {/* SVG Bar Chart */}
          <div style={{ position: "relative" }}>
            <svg
              viewBox="0 0 30 112"
              preserveAspectRatio="none"
              width="100%"
              height="120"
              style={{ display: "block" }}
            >
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                <line
                  key={i}
                  x1={0} y1={110 * (1 - ratio)}
                  x2={30} y2={110 * (1 - ratio)}
                  stroke={theme.bgCardBorder}
                  strokeWidth={0.25}
                  strokeDasharray="0.6 0.6"
                />
              ))}
              {/* Bars */}
              {chartData.map((d, i) => {
                const barH = (d.pts / maxPts) * 100;
                const isToday = d.date === today;
                const isHov = hoveredBar === i;
                return (
                  <rect
                    key={i}
                    x={i + 0.1}
                    y={barH > 0 ? 110 - barH : 108}
                    width={0.82}
                    height={barH > 0 ? barH : 2}
                    rx={0.35}
                    fill={
                      isToday
                        ? theme.accent
                        : isHov
                        ? `${theme.accent}cc`
                        : `${theme.accent}60`
                    }
                    style={{ cursor: "default" }}
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredBar !== null && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: `clamp(5%, ${((hoveredBar + 0.5) / 30) * 100}%, 82%)`,
                  transform: "translateX(-50%)",
                  background: theme.bgCard,
                  border: `1px solid ${theme.accent}`,
                  borderRadius: 8, padding: "4px 10px",
                  color: theme.textPrimary, fontSize: "0.74rem", fontWeight: 700,
                  whiteSpace: "nowrap", pointerEvents: "none", zIndex: 10,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                }}
              >
                {fmtDate(chartData[hoveredBar].date)}: {chartData[hoveredBar].pts} pts
              </div>
            )}
          </div>

          {/* X-axis labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            <span style={muteText}>{fmtDate(days30[0])}</span>
            <span style={muteText}>{fmtDate(days30[14])}</span>
            <span style={{ ...muteText, color: theme.accent, fontWeight: 700 }}>Today</span>
          </div>
        </div>

        {/* Points by Activity */}
        <div style={card}>
          <div style={sectionTitle}>
            <Trophy size={16} color={theme.accent} />
            Points by Activity
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {sourceBreakdown.length === 0 ? (
              <div style={{ ...muteText, textAlign: "center", paddingTop: 20 }}>
                No points recorded yet
              </div>
            ) : (
              sourceBreakdown.map(src => (
                <div key={src.source_type}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ ...secText, display: "flex", alignItems: "center", gap: 5 }}>
                      {SRC_EMOJI[src.source_type] ?? "•"}
                      {SRC_LABEL[src.source_type] ?? src.source_type}
                    </span>
                    <span style={{ color: theme.textPrimary, fontSize: "0.8rem", fontWeight: 700 }}>
                      {src.total}
                    </span>
                  </div>
                  <div style={{ height: 6, background: theme.bgInput, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${(src.total / maxSrc) * 100}%`,
                      background: SRC_COLOR[src.source_type] ?? theme.accent,
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Goals Overview + Top Habit Streaks ───────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Goals Overview */}
        <div style={card}>
          <div style={sectionTitle}>
            <Target size={16} color={theme.accent} />
            Goals Overview
          </div>

          {/* By Status */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: theme.textMuted, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 10 }}>
              By Status
            </div>
            {goalStatus.length === 0 ? (
              <div style={{ ...muteText }}>No goals yet</div>
            ) : (
              goalStatus.map(row => (
                <div key={row.status} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ ...secText, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: STATUS_COLOR[row.status] ?? "#6b7280",
                        display: "inline-block", flexShrink: 0,
                      }} />
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                    <span style={{ color: theme.textPrimary, fontSize: "0.8rem", fontWeight: 700 }}>{row.count}</span>
                  </div>
                  <div style={{ height: 6, background: theme.bgInput, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${(row.count / totalGoals) * 100}%`,
                      background: STATUS_COLOR[row.status] ?? "#6b7280",
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* By Type (active only) */}
          <div>
            <div style={{ color: theme.textMuted, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 10 }}>
              Active by Type
            </div>
            {goalTypes.length === 0 ? (
              <div style={{ ...muteText }}>No active goals</div>
            ) : (
              goalTypes.map(row => (
                <div key={row.goal_type} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <span style={{ width: 22, textAlign: "center", fontSize: "0.9rem" }}>
                    {GOAL_TYPE_EMOJI[row.goal_type] ?? "•"}
                  </span>
                  <span style={{ ...secText, flex: 1 }}>
                    {GOAL_TYPE_LABEL[row.goal_type] ?? row.goal_type}
                  </span>
                  <div style={{ flex: 2, height: 6, background: theme.bgInput, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${(row.count / maxTypeCount) * 100}%`,
                      background: GOAL_TYPE_COLOR[row.goal_type] ?? theme.accent,
                      borderRadius: 4,
                    }} />
                  </div>
                  <span style={{ color: theme.textPrimary, fontSize: "0.8rem", fontWeight: 700, width: 18, textAlign: "right" }}>
                    {row.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Habit Streaks */}
        <div style={card}>
          <div style={sectionTitle}>
            <Flame size={16} color="#f59e0b" />
            Top Habit Streaks
          </div>
          {topStreaks.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 28 }}>
              <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>🔥</div>
              <div style={{ color: theme.textMuted, fontSize: "0.84rem" }}>No active habit goals yet.</div>
              <div style={{ color: theme.textMuted, fontSize: "0.75rem", marginTop: 4 }}>
                Create a Habit goal to start building streaks!
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topStreaks.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: theme.bgInput, borderRadius: 12, padding: "10px 14px",
                  }}
                >
                  {/* Rank */}
                  <div style={{
                    width: 24, textAlign: "center",
                    color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : theme.textMuted,
                    fontSize: i < 3 ? "1rem" : "0.8rem", fontWeight: 700, flexShrink: 0,
                  }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: theme.textPrimary, fontSize: "0.84rem", fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.title}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: "0.69rem", marginTop: 2 }}>
                      Best ever: {s.streak_best}d
                    </div>
                  </div>

                  {/* Streak count */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      color: s.streak_current > 0 ? "#f59e0b" : theme.textMuted,
                      fontSize: "1.15rem", fontWeight: 800, lineHeight: 1,
                    }}>
                      {s.streak_current}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: "0.63rem" }}>days</div>
                  </div>

                  {/* Flame */}
                  <div style={{ fontSize: "1.1rem", flexShrink: 0, opacity: s.streak_current > 0 ? 1 : 0.3 }}>
                    🔥
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: 30-Day Consistency ──────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={sectionTitle}>
          <Calendar size={16} color={theme.accent} />
          30-Day Consistency
          <span style={{ marginLeft: "auto", ...muteText, fontWeight: 500 }}>
            {activeDays} / 30 active days ({consistencyPct}%)
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, background: theme.bgInput, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
          <div style={{
            height: "100%",
            width: `${consistencyPct}%`,
            background: consistencyPct >= 67
              ? "#10b981"
              : consistencyPct >= 33
              ? "#f59e0b"
              : "#ef4444",
            borderRadius: 6,
          }} />
        </div>

        {/* Dot grid — 30 squares */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {chartData.map((d, i) => {
            const isToday = d.date === today;
            const intensity =
              d.pts === 0 ? 0
              : d.pts < 10 ? 1
              : d.pts < 25 ? 2
              : 3;
            const bgColor =
              intensity === 0 ? theme.bgInput
              : intensity === 1 ? `${theme.accent}50`
              : intensity === 2 ? `${theme.accent}90`
              : theme.accent;
            return (
              <div
                key={i}
                title={`${fmtDate(d.date)}: ${d.pts} pts`}
                style={{
                  width: 21, height: 21, borderRadius: 5,
                  background: bgColor,
                  border: isToday ? `2px solid ${theme.accent}` : "2px solid transparent",
                  flexShrink: 0,
                  boxShadow: isToday ? `0 0 6px ${theme.accent}80` : "none",
                  cursor: "default",
                }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <span style={muteText}>Less</span>
          {([0, 1, 2, 3] as const).map(level => (
            <div key={level} style={{
              width: 14, height: 14, borderRadius: 3,
              background: level === 0 ? theme.bgInput
                : level === 1 ? `${theme.accent}50`
                : level === 2 ? `${theme.accent}90`
                : theme.accent,
            }} />
          ))}
          <span style={muteText}>More</span>
          <div style={{ width: 1, height: 14, background: theme.bgCardBorder, margin: "0 4px" }} />
          <div style={{
            width: 14, height: 14, borderRadius: 3,
            background: theme.bgInput,
            border: `2px solid ${theme.accent}`,
          }} />
          <span style={muteText}>Today</span>
        </div>
      </div>

      {/* ── Row 5: Quick Facts ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { emoji: "📝", label: "Words Written",  value: fmtNum(h.wordsWritten),    sub: "in your journal",    color: "#6366f1" },
          { emoji: "🙏", label: "Gratitudes",      value: String(h.gratitudesCount), sub: "entries logged",     color: "#f59e0b" },
          { emoji: "🗓️", label: "Events Completed",value: String(h.eventsCompleted), sub: "calendar items done", color: "#10b981" },
          { emoji: "⚡", label: "Total Check-ins", value: String(h.checkInsTotal),   sub: "habit & metric",     color: "#8b5cf6" },
        ].map((fact, i) => (
          <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${fact.color}20`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.35rem", flexShrink: 0,
            }}>
              {fact.emoji}
            </div>
            <div>
              <div style={{ color: theme.textPrimary, fontSize: "1.3rem", fontWeight: 800, lineHeight: 1 }}>
                {fact.value}
              </div>
              <div style={{ color: fact.color, fontSize: "0.72rem", fontWeight: 600, marginTop: 3 }}>
                {fact.label}
              </div>
              <div style={{ color: theme.textMuted, fontSize: "0.68rem", marginTop: 2 }}>
                {fact.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
