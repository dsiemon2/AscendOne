import { useState, useEffect, useCallback } from 'react';
import { Map, CheckCircle2, Clock, AlertCircle, TrendingUp, Star } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { getDb } from '../db/database';
import { GOAL_CATEGORIES, getCat } from './GoalsPage';

interface Goal {
  id: number;
  title: string;
  description: string | null;
  category: string;
  status: string;
  is_long_term: number;
  target_date: string | null;
  points_value: number;
  taskTotal: number;
  taskDone: number;
}

const CAT_COLORS: Record<string, string> = {
  life:      '#10b981',
  financial: '#f59e0b',
  family:    '#ec4899',
  health:    '#3b82f6',
  spiritual: '#8b5cf6',
  work:      '#06b6d4',
  personal:  '#f97316',
};

function getCatColor(cat: string) { return CAT_COLORS[cat] ?? '#5090e0'; }

function getProgress(g: Goal): number {
  if (g.status === 'completed') return 100;
  if (g.taskTotal > 0) return Math.round((g.taskDone / g.taskTotal) * 100);
  return 0;
}

function isOverdue(g: Goal): boolean {
  if (!g.target_date || g.status === 'completed') return false;
  return new Date(g.target_date + 'T12:00:00') < new Date();
}

function fmtMonth(key: string) {
  if (key === 'No Date') return 'No Target Date';
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isPastMonth(key: string) {
  if (key === 'No Date') return false;
  const now = new Date();
  const [y, m] = key.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date < new Date(now.getFullYear(), now.getMonth(), 1);
}

function isCurrentMonth(key: string) {
  if (key === 'No Date') return false;
  const now = new Date();
  return key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, color, theme,
}: {
  icon: React.ReactNode; label: string; value: number; color: string;
  theme: ReturnType<typeof useThemeStore>['theme'];
}) {
  return (
    <div style={{
      background: theme.bgCard, borderRadius: 14,
      border: `1px solid ${theme.bgCardBorder}`,
      padding: '16px 18px',
      boxShadow: `0 4px 16px ${theme.bgCardShadow}`,
      display: 'flex', alignItems: 'center', gap: 14, flex: 1,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div style={{ color: theme.textPrimary, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</div>
        <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Goal card ─────────────────────────────────────────────────────────────────
function GoalCard({ g, theme }: { g: Goal; theme: ReturnType<typeof useThemeStore>['theme'] }) {
  const cat      = getCat(g.category);
  const color    = getCatColor(g.category);
  const done     = g.status === 'completed';
  const overdue  = isOverdue(g);
  const progress = getProgress(g);

  return (
    <div style={{
      background: done ? color + '0e' : theme.bgCard,
      borderRadius: 12,
      border: `1px solid ${done ? color + '40' : overdue ? '#ef444440' : theme.bgCardBorder}`,
      padding: '14px 16px',
      transition: 'all 0.18s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1.3 }}>{cat.emoji}</span>
          <div>
            <div style={{
              color: theme.textPrimary, fontWeight: 700, fontSize: 14,
              textDecoration: done ? 'line-through' : 'none',
              opacity: done ? 0.7 : 1,
            }}>
              {g.title}
            </div>
            <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 1 }}>
              {cat.label}
              {g.is_long_term ? ' · Long-term' : ''}
              {g.target_date ? ` · ${fmtDate(g.target_date)}` : ''}
            </div>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {done ? (
            <span style={{ background: '#10b98120', color: '#10b981', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
              ✓ Done
            </span>
          ) : overdue ? (
            <span style={{ background: '#ef444420', color: '#ef4444', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
              Overdue
            </span>
          ) : (
            <span style={{ background: color + '20', color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
              {progress}%
            </span>
          )}
        </div>
      </div>

      {!done && (
        <div style={{ marginTop: 12 }}>
          <div style={{ background: theme.progressBg, borderRadius: 4, height: 5 }}>
            <div style={{
              background: overdue ? '#ef4444' : color,
              width: `${progress}%`, height: 5, borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          {g.taskTotal > 0 && (
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
              {g.taskDone}/{g.taskTotal} tasks completed
            </div>
          )}
        </div>
      )}

      {g.points_value > 0 && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={11} color="#f59e0b" fill="#f59e0b" />
          <span style={{ color: theme.textMuted, fontSize: 11 }}>{g.points_value} pts on completion</span>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const { theme } = useThemeStore();
  const [goals, setGoals]         = useState<Goal[]>([]);
  const [selCat, setSelCat]       = useState('all');
  const [view, setView]           = useState<'timeline' | 'category'>('timeline');
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.select<Goal[]>(`
        SELECT
          g.*,
          COUNT(t.id)                                              AS taskTotal,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS taskDone
        FROM goals g
        LEFT JOIN tasks t ON t.goal_id = g.id
        WHERE g.status = 'active'
        GROUP BY g.id
        ORDER BY g.target_date ASC, g.created_at ASC
      `);
      setGoals(rows);
      setError('');
    } catch (e) {
      console.error('Roadmap load error', e);
      setError('Could not load goals.');
    }
  }, []);

  const [completedGoals, setCompletedGoals] = useState<Goal[]>([]);

  const loadCompleted = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.select<Goal[]>(`
        SELECT
          g.*,
          COUNT(t.id)                                              AS taskTotal,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS taskDone
        FROM goals g
        LEFT JOIN tasks t ON t.goal_id = g.id
        WHERE g.status = 'completed'
        GROUP BY g.id
        ORDER BY g.target_date ASC, g.created_at ASC
      `);
      setCompletedGoals(rows);
    } catch (e) { console.error('Roadmap completed load error', e); }
  }, []);

  useEffect(() => { load(); loadCompleted(); }, [load, loadCompleted]);

  const allVisible = showCompleted ? [...goals, ...completedGoals] : goals;
  const filtered = selCat === 'all' ? allVisible : allVisible.filter(g => g.category === selCat);

  const total     = filtered.length;
  const completed = filtered.filter(g => g.status === 'completed').length;
  const active    = filtered.filter(g => g.status === 'active').length;
  const overdueCount = filtered.filter(isOverdue).length;

  // Timeline grouping
  const grouped: Record<string, Goal[]> = {};
  for (const g of filtered) {
    const key = g.target_date ? g.target_date.slice(0, 7) : 'No Date';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(g);
  }
  const months = Object.keys(grouped).sort((a, b) => {
    if (a === 'No Date') return 1;
    if (b === 'No Date') return -1;
    return a.localeCompare(b);
  });

  // Category grouping
  const byCat: Record<string, Goal[]> = {};
  for (const g of filtered) {
    if (!byCat[g.category]) byCat[g.category] = [];
    byCat[g.category].push(g);
  }
  const cats = Object.keys(byCat);

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: theme.textPrimary, fontSize: 26, fontWeight: 700, margin: 0 }}>
            Roadmap
          </h1>
          <p style={{ color: theme.textMuted, margin: '4px 0 0', fontSize: 14 }}>
            Your manifestation journey — visualized
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Show completed toggle */}
          <button
            onClick={() => setShowCompleted(s => !s)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: `1px solid ${theme.bgCardBorder}`,
              cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              background: showCompleted ? '#10b98120' : theme.bgCard,
              color: showCompleted ? '#10b981' : theme.textMuted,
            }}
          >
            {showCompleted ? '✓ Showing Completed' : 'Show Completed'}
          </button>
          {/* View toggle */}
          <div style={{
            display: 'flex', background: theme.bgCard,
            border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10, overflow: 'hidden',
          }}>
            {(['timeline', 'category'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: view === v ? theme.accent : 'transparent',
                color: view === v ? '#fff' : theme.textMuted, transition: 'all 0.15s',
              }}>
                {v === 'timeline' ? '📅 Timeline' : '🏷️ Category'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard icon={<Map size={20} />}          label="Total Goals"  value={total}        color="#5090e0" theme={theme} />
        <StatCard icon={<CheckCircle2 size={20} />} label="Completed"    value={completed}    color="#10b981" theme={theme} />
        <StatCard icon={<TrendingUp size={20} />}   label="Active"       value={active}       color="#f59e0b" theme={theme} />
        <StatCard icon={<AlertCircle size={20} />}  label="Overdue"      value={overdueCount} color="#ef4444" theme={theme} />
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button onClick={() => setSelCat('all')} style={{
          background: selCat === 'all' ? theme.accent : theme.bgCard,
          color: selCat === 'all' ? '#fff' : theme.textSecondary,
          border: `1px solid ${selCat === 'all' ? theme.accent : theme.bgCardBorder}`,
          borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>All</button>
        {GOAL_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setSelCat(c.id)} style={{
            background: selCat === c.id ? getCatColor(c.id) : theme.bgCard,
            color: selCat === c.id ? '#fff' : theme.textSecondary,
            border: `1px solid ${selCat === c.id ? getCatColor(c.id) : theme.bgCardBorder}`,
            borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#ef4444', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div style={{
          background: theme.bgCard, borderRadius: 16,
          border: `1px solid ${theme.bgCardBorder}`, padding: '48px 32px', textAlign: 'center',
          boxShadow: `0 4px 20px ${theme.bgCardShadow}`,
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🗺️</div>
          <p style={{ color: theme.textPrimary, fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>
            Your roadmap is empty
          </p>
          <p style={{ color: theme.textMuted, margin: 0, fontSize: 14 }}>
            Add goals in the Goals section to see them appear here as milestones.
          </p>
        </div>
      ) : view === 'timeline' ? (

        /* Timeline view */
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 19, top: 20, bottom: 20, width: 2,
            background: `linear-gradient(to bottom, ${theme.accent}80, ${theme.accent}20)`,
          }} />
          {months.map((mo, mi) => {
            const goalsInMonth = grouped[mo];
            const allDone    = goalsInMonth.every(g => g.status === 'completed');
            const isCurrent  = isCurrentMonth(mo);
            const isPast     = isPastMonth(mo);
            const nodeColor  = allDone ? '#10b981' : isCurrent ? theme.accent : isPast ? '#ef4444' : theme.textMuted;

            return (
              <div key={mo} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                    background: allDone ? '#10b981' : isCurrent ? theme.accentGradient : theme.bgCard,
                    border: `2px solid ${nodeColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isCurrent ? `0 0 0 4px ${theme.accent}22` : 'none',
                  }}>
                    {allDone
                      ? <CheckCircle2 size={18} color="#fff" fill="#fff" />
                      : isCurrent
                        ? <Clock size={16} color="#fff" />
                        : <span style={{ color: nodeColor, fontWeight: 700, fontSize: 13 }}>{mi + 1}</span>
                    }
                  </div>
                  <div>
                    <div style={{ color: isCurrent ? theme.accent : theme.textPrimary, fontWeight: 700, fontSize: 15 }}>
                      {fmtMonth(mo)}
                      {isCurrent && (
                        <span style={{ marginLeft: 8, background: theme.accent + '22', color: theme.accent, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 12 }}>
                      {goalsInMonth.length} goal{goalsInMonth.length !== 1 ? 's' : ''} · {goalsInMonth.filter(g => g.status === 'completed').length} completed
                    </div>
                  </div>
                </div>
                <div style={{ marginLeft: 54, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {goalsInMonth.map(g => <GoalCard key={g.id} g={g} theme={theme} />)}
                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* Category view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {cats.map(catId => {
            const cat    = getCat(catId);
            const color  = getCatColor(catId);
            const cGoals = byCat[catId];
            const cDone  = cGoals.filter(g => g.status === 'completed').length;
            const pct    = cGoals.length > 0 ? Math.round((cDone / cGoals.length) * 100) : 0;

            return (
              <div key={catId} style={{
                background: theme.bgCard, borderRadius: 16,
                border: `1px solid ${theme.bgCardBorder}`, overflow: 'hidden',
                boxShadow: `0 4px 20px ${theme.bgCardShadow}`,
              }}>
                <div style={{
                  background: color + '18', padding: '14px 20px',
                  borderBottom: `1px solid ${color}30`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                    <div>
                      <div style={{ color: theme.textPrimary, fontWeight: 700, fontSize: 15 }}>{cat.label}</div>
                      <div style={{ color: theme.textMuted, fontSize: 12 }}>{cGoals.length} goals · {cDone} completed</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color, fontWeight: 800, fontSize: 20 }}>{pct}%</div>
                    <div style={{ color: theme.textMuted, fontSize: 11 }}>complete</div>
                  </div>
                </div>
                <div style={{ height: 4, background: theme.progressBg }}>
                  <div style={{ height: 4, background: color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cGoals.map(g => <GoalCard key={g.id} g={g} theme={theme} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
