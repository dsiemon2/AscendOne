import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Archive, Trash2, Edit2, Target, ChevronDown, ChevronUp, X, Ban, MessageSquare, TrendingUp, Flame, Flag, CheckSquare, Square, Calendar, HelpCircle, CalendarClock } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAppStore } from '../store/appStore';
import { getDb } from '../db/database';
import { getLocalDateString } from '../utils/dateUtils';

// ─── Constants ───────────────────────────────────────────────────────────────

const GOAL_MISS_REASONS = [
  { emoji: "🤒", label: "Sick / Not well" },
  { emoji: "🌀", label: "Circumstances changed" },
  { emoji: "📅", label: "Needs more time" },
  { emoji: "💪", label: "Pivoting direction" },
  { emoji: "⚡", label: "Life happened" },
  { emoji: "😔", label: "Lost momentum" },
];

export const GOAL_CATEGORIES = [
  { id: 'life',      label: 'Life',      emoji: '🌱' },
  { id: 'financial', label: 'Financial', emoji: '💰' },
  { id: 'family',    label: 'Family',    emoji: '👪' },
  { id: 'health',    label: 'Health',    emoji: '💪' },
  { id: 'spiritual', label: 'Spiritual', emoji: '🙏' },
  { id: 'work',      label: 'Work',      emoji: '💼' },
  { id: 'personal',  label: 'Personal',  emoji: '🌟' },
];

const GOAL_TYPES = [
  { id: 'standard',  label: 'Standard',   emoji: '🎯', desc: 'Tasks & sub-goals' },
  { id: 'metric',    label: 'Metric',     emoji: '📊', desc: 'Track a number' },
  { id: 'habit',     label: 'Habit',      emoji: '🔥', desc: 'Build a streak' },
  { id: 'milestone', label: 'Milestone',  emoji: '🏁', desc: 'Checklist of steps' },
] as const;

// Type-specific accent colors
const GOAL_TYPE_COLORS: Record<string, string> = {
  standard:  '#6366f1',
  metric:    '#10b981',
  habit:     '#f59e0b',
  milestone: '#8b5cf6',
};

const CHECK_IN_FREQS = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'manual',  label: 'Manual' },
];

const EVENT_TYPES_FOR_LINKING = [
  { id: 'exercise',    label: 'Exercise',    emoji: '🏃' },
  { id: 'personal',    label: 'Personal',    emoji: '🌟' },
  { id: 'work',        label: 'Work',        emoji: '💼' },
  { id: 'appointment', label: 'Appointment', emoji: '📋' },
  { id: 'meeting',     label: 'Meeting',     emoji: '👥' },
  { id: 'social',      label: 'Social',      emoji: '🎉' },
  { id: 'errand',      label: 'Errand',      emoji: '🛒' },
];

export const STREAK_BONUSES = [
  { days: 7,   pts: 15,  label: '7-day streak' },
  { days: 30,  pts: 40,  label: '30-day streak' },
  { days: 100, pts: 100, label: '100-day streak' },
];

export function getCat(categoryId: string) {
  return GOAL_CATEGORIES.find((c) => c.id === categoryId) || { id: categoryId, label: categoryId, emoji: '🎯' };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalType = 'standard' | 'metric' | 'habit' | 'milestone';
type CheckInFreq = 'daily' | 'weekly' | 'monthly' | 'manual';
type Tab = 'active' | 'completed' | 'archived' | 'missed' | 'all';

interface Goal {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  is_long_term: number;
  parent_goal_id: number | null;
  target_date: string | null;
  points_value: number;
  goal_type: GoalType;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  check_in_frequency: CheckInFreq;
  start_date: string | null;
  streak_mode: 'strict' | 'forgiving';
  cheat_days_per_week: number;
  streak_current: number;
  streak_best: number;
  last_check_in_date: string | null;
  taskTotal?: number;
  taskDone?: number;
  subGoalCount?: number;
  milestoneTotal?: number;
  milestoneDone?: number;
}

interface GoalMilestone {
  id: number;
  goal_id: number;
  title: string;
  target_date: string | null;
  completed_date: string | null;
  points_value: number;
  sort_order: number;
}

interface MilestoneFormItem {
  id?: number;       // present for existing DB milestones; absent for newly added ones
  title: string;
  points_value: string;
  target_date: string;
}

interface RecentCheckIn {
  check_in_date: string;
  is_success: number;
  is_cheat_day: number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'active',    label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived',  label: 'Archived' },
  { id: 'missed',    label: '😔 Missed' },
  { id: 'all',       label: 'All' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function needsCheckIn(goal: Goal): boolean {
  if (goal.status !== 'active') return false;
  if (goal.goal_type === 'standard' || goal.goal_type === 'milestone') return false;
  if (goal.check_in_frequency === 'manual') return false;
  const today = getLocalDateString();
  // Use last check-in date, or fall back to start_date, or today for brand-new goals.
  // This prevents a freshly created goal from immediately showing as overdue.
  const ref = goal.last_check_in_date ?? goal.start_date ?? today;
  if (goal.check_in_frequency === 'daily') return ref < today;
  if (goal.check_in_frequency === 'weekly') return ref < getWeekStart(today);
  if (goal.check_in_frequency === 'monthly') return ref < today.slice(0, 7) + '-01';
  return false;
}

function checkedInPeriod(goal: Goal): boolean {
  // Only counts as "done this period" if there's an actual check-in — not just a start date
  if (!goal.last_check_in_date) return false;
  const today = getLocalDateString();
  if (goal.check_in_frequency === 'daily') return goal.last_check_in_date === today;
  if (goal.check_in_frequency === 'weekly') return goal.last_check_in_date >= getWeekStart(today);
  if (goal.check_in_frequency === 'monthly') return goal.last_check_in_date >= today.slice(0, 7) + '-01';
  return false;
}

function getProgressPct(goal: Goal): number {
  if (goal.goal_type === 'metric' && goal.target_value) {
    return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  }
  if (goal.goal_type === 'milestone' && (goal.milestoneTotal ?? 0) > 0) {
    return Math.round(((goal.milestoneDone ?? 0) / (goal.milestoneTotal ?? 1)) * 100);
  }
  if (goal.goal_type === 'standard' && (goal.taskTotal ?? 0) > 0) {
    return Math.round(((goal.taskDone ?? 0) / (goal.taskTotal ?? 1)) * 100);
  }
  return 0;
}

function getStreakBonus(streak: number): number {
  const hit = STREAK_BONUSES.find(b => b.days === streak);
  return hit ? hit.pts : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { theme } = useThemeStore();
  const { addTodayPoints } = useAppStore();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);

  // Miss modal
  const [missGoal, setMissGoal] = useState<Goal | null>(null);
  const [showMissModal, setShowMissModal] = useState(false);
  const [missReflection, setMissReflection] = useState('');

  // Check-in modal
  const [checkInGoal, setCheckInGoal] = useState<Goal | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInValue, setCheckInValue] = useState('');
  const [checkInNotes, setCheckInNotes] = useState('');
  const [cheatDaysLeft, setCheatDaysLeft] = useState(0);

  // Goal detail view modal
  const [viewGoal, setViewGoal] = useState<Goal | null>(null);

  // Extend deadline modal
  const [extendGoal, setExtendGoal] = useState<Goal | null>(null);
  const [extendDate, setExtendDate] = useState('');
  const [extendSaving, setExtendSaving] = useState(false);

  // Milestones & history
  const [goalMilestones, setGoalMilestones] = useState<Record<number, GoalMilestone[]>>({});
  const [recentCheckIns, setRecentCheckIns] = useState<Record<number, RecentCheckIn[]>>({});
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  // Form
  const [form, setForm] = useState({ title: '', description: '', category: 'personal', target_date: '', points_value: '10', is_long_term: false, parent_goal_id: '' });
  const [formGoalType, setFormGoalType] = useState<GoalType>('standard');
  const [formTargetValue, setFormTargetValue] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formCheckInFreq, setFormCheckInFreq] = useState<CheckInFreq>('daily');
  const [formStreakMode, setFormStreakMode] = useState<'strict' | 'forgiving'>('strict');
  const [formCheatDays, setFormCheatDays] = useState('1');
  const [formStartDate, setFormStartDate] = useState('');
  const [formMilestones, setFormMilestones] = useState<MilestoneFormItem[]>([]);
  const [newMilestone, setNewMilestone] = useState<MilestoneFormItem>({ title: '', points_value: '5', target_date: '' });
  const [formLinkedTypes, setFormLinkedTypes] = useState<string[]>([]);
  const [showGoalTypeHelp, setShowGoalTypeHelp] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Data ───────────────────────────────────────────────────────────────────

  const loadGoals = useCallback(async () => {
    const db = await getDb();
    const rows = await db.select<Goal[]>(
      `SELECT g.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.goal_id=g.id) as taskTotal,
        (SELECT COUNT(*) FROM tasks t WHERE t.goal_id=g.id AND t.status='completed') as taskDone,
        (SELECT COUNT(*) FROM goals sg WHERE sg.parent_goal_id=g.id) as subGoalCount,
        (SELECT COUNT(*) FROM goal_milestones m WHERE m.goal_id=g.id) as milestoneTotal,
        (SELECT COUNT(*) FROM goal_milestones m WHERE m.goal_id=g.id AND m.completed_date IS NOT NULL) as milestoneDone
       FROM goals g ORDER BY g.created_at DESC`
    );
    setGoals(rows);
  }, []);

  const loadMilestones = useCallback(async (goalId: number) => {
    const db = await getDb();
    const rows = await db.select<GoalMilestone[]>(
      `SELECT * FROM goal_milestones WHERE goal_id=? ORDER BY sort_order, id`, [goalId]
    );
    setGoalMilestones(prev => ({ ...prev, [goalId]: rows }));
  }, []);

  const loadRecentCheckIns = useCallback(async (goalId: number) => {
    const db = await getDb();
    const rows = await db.select<RecentCheckIn[]>(
      `SELECT check_in_date, is_success, is_cheat_day FROM goal_check_ins WHERE goal_id=? ORDER BY check_in_date DESC LIMIT 7`,
      [goalId]
    );
    setRecentCheckIns(prev => ({ ...prev, [goalId]: rows }));
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  useEffect(() => {
    if (expandedGoal != null) {
      const goal = goals.find(g => g.id === expandedGoal);
      if (goal?.goal_type === 'milestone') loadMilestones(expandedGoal);
      if (goal?.goal_type === 'habit') loadRecentCheckIns(expandedGoal);
    }
  }, [expandedGoal, goals, loadMilestones, loadRecentCheckIns]);

  const filtered = goals.filter(g => {
    const tabMatch = tab === 'all' ? true : g.status === tab;
    const catMatch = categoryFilter === 'all' ? true : g.category === categoryFilter;
    return tabMatch && catMatch;
  });

  // Stats for summary bar
  const activeCount = goals.filter(g => g.status === 'active').length;
  const needsCheckInCount = goals.filter(g => g.status === 'active' && needsCheckIn(g)).length;
  const completedCount = goals.filter(g => g.status === 'completed').length;
  const bestStreak = goals.reduce((best, g) => Math.max(best, g.streak_best || 0), 0);

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  const resetFormExtras = () => {
    setFormGoalType('standard'); setFormTargetValue(''); setFormUnit('');
    setFormCheckInFreq('daily'); setFormStreakMode('strict'); setFormCheatDays('1');
    setFormStartDate(''); setFormMilestones([]); setFormLinkedTypes([]);
    setNewMilestone({ title: '', points_value: '5', target_date: '' });
    setShowGoalTypeHelp(false);
    setSaving(false);
    setSaveError('');
  };

  const openAdd = () => {
    setEditGoal(null);
    setForm({ title: '', description: '', category: 'personal', target_date: '', points_value: '25', is_long_term: false, parent_goal_id: '' });
    resetFormExtras();
    setShowModal(true);
  };

  const openEdit = async (g: Goal) => {
    setEditGoal(g);
    setShowGoalTypeHelp(false);
    setForm({ title: g.title, description: g.description || '', category: g.category, target_date: g.target_date || '', points_value: String(g.points_value), is_long_term: g.is_long_term === 1, parent_goal_id: g.parent_goal_id ? String(g.parent_goal_id) : '' });
    setFormGoalType(g.goal_type || 'standard');
    setFormTargetValue(g.target_value != null ? String(g.target_value) : '');
    setFormUnit(g.unit || '');
    setFormCheckInFreq((g.check_in_frequency as CheckInFreq) || 'daily');
    setFormStreakMode(g.streak_mode || 'strict');
    setFormCheatDays(String(g.cheat_days_per_week || 1));
    setFormStartDate(g.start_date || '');
    setNewMilestone({ title: '', points_value: '5', target_date: '' });
    const db = await getDb();
    // Load existing milestones so user can edit/delete them
    if (g.goal_type === 'milestone') {
      const existingMs = await db.select<GoalMilestone[]>(
        `SELECT * FROM goal_milestones WHERE goal_id=? ORDER BY sort_order, id`, [g.id]
      );
      setFormMilestones(existingMs.map(m => ({
        id: m.id,
        title: m.title,
        points_value: String(m.points_value),
        target_date: m.target_date || '',
      })));
    } else {
      setFormMilestones([]);
    }
    const links = await db.select<{ event_type: string }[]>(`SELECT event_type FROM goal_event_links WHERE goal_id=?`, [g.id]);
    setFormLinkedTypes(links.map(l => l.event_type));
    setShowModal(true);
  };

  // ─── View modal ─────────────────────────────────────────────────────────────

  function openView(g: Goal) {
    setViewGoal(g);
    // Pre-load milestones and check-ins so they appear instantly in the modal
    if (g.goal_type === 'milestone') loadMilestones(g.id);
    if (g.goal_type === 'habit') loadRecentCheckIns(g.id);
  }

  // ─── Save ───────────────────────────────────────────────────────────────────

  const saveGoal = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setSaveError('');
    try {
    const db = await getDb();
    const pts = parseInt(form.points_value) || 25;
    const pgid = form.parent_goal_id ? parseInt(form.parent_goal_id) : null;

    // Validate parent goal still exists (guards against stale React state)
    if (pgid !== null) {
      const parentCheck = await db.select<{ id: number }[]>(
        `SELECT id FROM goals WHERE id=?`, [pgid]
      );
      if (parentCheck.length === 0) {
        setSaveError('The selected parent goal no longer exists. Please set Parent Goal to "None" and try again.');
        setSaving(false);
        return;
      }
    }
    const lt = form.is_long_term ? 1 : 0;
    const targetVal = formTargetValue ? parseFloat(formTargetValue) : null;
    const cheatDays = formStreakMode === 'forgiving' ? parseInt(formCheatDays) || 1 : 0;

    let goalId: number;
    if (editGoal) {
      await db.execute(
        `UPDATE goals SET title=?, description=?, category=?, target_date=?, points_value=?, is_long_term=?, parent_goal_id=?,
          goal_type=?, target_value=?, unit=?, check_in_frequency=?, start_date=?, streak_mode=?, cheat_days_per_week=?,
          updated_at=datetime('now') WHERE id=?`,
        [form.title, form.description, form.category, form.target_date || null, pts, lt, pgid,
         formGoalType, targetVal, formUnit || null, formCheckInFreq, formStartDate || null, formStreakMode, cheatDays, editGoal.id]
      );
      goalId = editGoal.id;
      await db.execute(`DELETE FROM goal_event_links WHERE goal_id=?`, [goalId]);
    } else {
      await db.execute(
        `INSERT INTO goals (title, description, category, status, target_date, points_value, is_long_term, parent_goal_id,
          goal_type, target_value, current_value, unit, check_in_frequency, start_date, streak_mode, cheat_days_per_week)
         VALUES (?,?,?,'active',?,?,?,?,?,?,0,?,?,?,?,?)`,
        [form.title, form.description, form.category, form.target_date || null, pts, lt, pgid,
         formGoalType, targetVal, formUnit || null, formCheckInFreq, formStartDate || null, formStreakMode, cheatDays]
      );
      const result = await db.select<[{ id: number }]>(`SELECT last_insert_rowid() as id`);
      goalId = result[0].id;
    }
    for (const et of formLinkedTypes) {
      await db.execute(`INSERT INTO goal_event_links (goal_id, event_type) VALUES (?,?)`, [goalId, et]);
    }
    if (formGoalType === 'milestone') {
      if (editGoal) {
        // --- Editing an existing goal ---
        // Which existing milestone IDs are still present in the form?
        const keptIds = new Set(formMilestones.filter(m => m.id).map(m => m.id!));
        // Delete milestones that were removed (exist in DB but not in form)
        const dbMs = await db.select<GoalMilestone[]>(
          `SELECT id FROM goal_milestones WHERE goal_id=?`, [goalId]
        );
        for (const row of dbMs) {
          if (!keptIds.has(row.id)) {
            await db.execute(`DELETE FROM goal_milestones WHERE id=?`, [row.id]);
          }
        }
        // Update existing milestones / insert new ones
        for (let i = 0; i < formMilestones.length; i++) {
          const m = formMilestones[i];
          if (!m.title.trim()) continue;
          if (m.id) {
            // Existing: update title, points, sort_order (preserve completed_date)
            await db.execute(
              `UPDATE goal_milestones SET title=?, points_value=?, target_date=?, sort_order=? WHERE id=?`,
              [m.title.trim(), parseInt(m.points_value) || 15, m.target_date || null, i, m.id]
            );
          } else {
            // New: insert
            await db.execute(
              `INSERT INTO goal_milestones (goal_id, title, points_value, target_date, sort_order) VALUES (?,?,?,?,?)`,
              [goalId, m.title.trim(), parseInt(m.points_value) || 15, m.target_date || null, i]
            );
          }
        }
      } else if (formMilestones.length > 0) {
        // --- New goal: just insert all ---
        for (let i = 0; i < formMilestones.length; i++) {
          const m = formMilestones[i];
          if (!m.title.trim()) continue;
          await db.execute(
            `INSERT INTO goal_milestones (goal_id, title, points_value, target_date, sort_order) VALUES (?,?,?,?,?)`,
            [goalId, m.title.trim(), parseInt(m.points_value) || 15, m.target_date || null, i]
          );
        }
      }
    }
    setShowModal(false);
    loadGoals();
    if (formGoalType === 'milestone') loadMilestones(goalId);
    } catch (e) {
      console.error('Save goal error:', e);
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ─── Extend deadline ─────────────────────────────────────────────────────────

  function openExtend(g: Goal) {
    setExtendGoal(g);
    // Pre-fill with current target date if set, otherwise today + 7 days
    if (g.target_date) {
      setExtendDate(g.target_date);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setExtendDate(d.toISOString().slice(0, 10));
    }
    setExtendSaving(false);
  }

  async function saveExtendedDate() {
    if (!extendGoal || !extendDate || extendSaving) return;
    setExtendSaving(true);
    try {
      const db = await getDb();
      await db.execute(`UPDATE goals SET target_date=?, updated_at=datetime('now') WHERE id=?`, [extendDate, extendGoal.id]);
      setExtendGoal(null);
      loadGoals();
    } catch (e) {
      console.error('Extend deadline error:', e);
    } finally {
      setExtendSaving(false);
    }
  }

  // ─── Goal actions ───────────────────────────────────────────────────────────

  const completeGoal = async (g: Goal) => {
    const db = await getDb();
    await db.execute(`UPDATE goals SET status='completed', completed_at=datetime('now') WHERE id=?`, [g.id]);
    const today = getLocalDateString();
    await db.execute(`INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (?,?,?,?,?)`,
      [g.points_value, `Completed goal: ${g.title}`, 'goal', String(g.id), today]);
    addTodayPoints(g.points_value);
    loadGoals();
  };

  const archiveGoal = async (g: Goal) => {
    const db = await getDb();
    await db.execute(`UPDATE goals SET status='archived' WHERE id=?`, [g.id]);
    loadGoals();
  };

  const restoreGoal = async (g: Goal) => {
    const db = await getDb();
    await db.execute(`UPDATE goals SET status='active' WHERE id=?`, [g.id]);
    loadGoals();
  };

  const deleteGoal = async () => {
    if (!confirmDeleteGoal) return;
    const db = await getDb();
    await db.execute(`DELETE FROM goals WHERE id=?`, [confirmDeleteGoal.id]);
    setConfirmDeleteGoal(null);
    loadGoals();
  };

  // ─── Miss modal ─────────────────────────────────────────────────────────────

  function openGoalMiss(g: Goal) { setMissGoal(g); setMissReflection(''); setShowMissModal(true); }

  async function confirmGoalMiss() {
    if (!missGoal) return;
    const db = await getDb();
    const today = getLocalDateString();
    await db.execute(`UPDATE goals SET status='missed' WHERE id=?`, [missGoal.id]);
    const reflPts = missReflection.trim() ? 1 : 0;
    await db.execute(`INSERT INTO missed_log (source_type, source_id, title, reflection_text, reflection_points, missed_date) VALUES ('goal',?,?,?,?,?)`,
      [missGoal.id, missGoal.title, missReflection.trim() || null, reflPts, today]);
    if (reflPts > 0) {
      await db.execute(`INSERT INTO points_log (points, reason, source_type, entry_date) VALUES (?,?,'reflection',?)`,
        [reflPts, `💭 Reflection: ${missGoal.title}`, today]);
      addTodayPoints(reflPts);
    }
    setShowMissModal(false); setMissGoal(null); setMissReflection('');
    loadGoals();
  }

  // ─── Check-in ───────────────────────────────────────────────────────────────

  async function openCheckIn(goal: Goal) {
    setCheckInGoal(goal); setCheckInValue(''); setCheckInNotes('');
    if (goal.streak_mode === 'forgiving' && goal.cheat_days_per_week > 0) {
      const db = await getDb();
      const weekStart = getWeekStart(getLocalDateString());
      const used = await db.select<[{ count: number }]>(
        `SELECT COUNT(*) as count FROM goal_check_ins WHERE goal_id=? AND is_cheat_day=1 AND check_in_date >= ?`,
        [goal.id, weekStart]
      );
      setCheatDaysLeft(goal.cheat_days_per_week - used[0].count);
    } else { setCheatDaysLeft(0); }
    setShowCheckInModal(true);
  }

  async function submitHabitCheckIn(isSuccess: boolean, isCheat: boolean) {
    if (!checkInGoal) return;
    const db = await getDb();
    const today = getLocalDateString();
    const newStreak = (isSuccess || isCheat) ? checkInGoal.streak_current + 1 : 0;
    const newBest = Math.max(newStreak, checkInGoal.streak_best);
    await db.execute(
      `INSERT INTO goal_check_ins (goal_id, check_in_date, is_success, is_cheat_day, notes, points_awarded) VALUES (?,?,?,?,?,?)`,
      [checkInGoal.id, today, isSuccess ? 1 : 0, isCheat ? 1 : 0, checkInNotes || null, isSuccess ? 7 : 0]
    );
    await db.execute(`UPDATE goals SET streak_current=?, streak_best=?, last_check_in_date=? WHERE id=?`,
      [newStreak, newBest, today, checkInGoal.id]);
    if (isSuccess) {
      await db.execute(`INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (7,?,'check_in',?,?)`,
        [`🔥 Habit check-in: ${checkInGoal.title}`, checkInGoal.id, today]);
      addTodayPoints(7);
      const bonus = getStreakBonus(newStreak);
      if (bonus > 0) {
        const bonusLabel = STREAK_BONUSES.find(b => b.days === newStreak)?.label ?? `${newStreak}-day streak`;
        await db.execute(`INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (?,?,'streak_bonus',?,?)`,
          [bonus, `⚡ ${bonusLabel}: ${checkInGoal.title}`, checkInGoal.id, today]);
        addTodayPoints(bonus);
      }
    }
    setShowCheckInModal(false); setCheckInGoal(null);
    loadGoals();
  }

  async function submitMetricCheckIn() {
    if (!checkInGoal) return;
    const val = parseFloat(checkInValue);
    if (isNaN(val) || val < 0) return;
    const db = await getDb();
    const today = getLocalDateString();
    await db.execute(`INSERT INTO goal_check_ins (goal_id, check_in_date, value, notes, is_success, points_awarded) VALUES (?,?,?,?,1,7)`,
      [checkInGoal.id, today, val, checkInNotes || null]);
    await db.execute(`UPDATE goals SET current_value=?, last_check_in_date=? WHERE id=?`, [val, today, checkInGoal.id]);
    await db.execute(`INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (7,?,'check_in',?,?)`,
      [`📊 Progress check-in: ${checkInGoal.title}`, checkInGoal.id, today]);
    addTodayPoints(7);
    setShowCheckInModal(false); setCheckInGoal(null);
    loadGoals();
  }

  // ─── Milestones ─────────────────────────────────────────────────────────────

  async function completeMilestone(milestone: GoalMilestone, goal: Goal) {
    if (milestone.completed_date) return;
    const db = await getDb();
    const today = getLocalDateString();
    await db.execute(`UPDATE goal_milestones SET completed_date=? WHERE id=?`, [today, milestone.id]);
    await db.execute(`INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (?,?,'milestone',?,?)`,
      [milestone.points_value, `🏁 Milestone: ${milestone.title}`, milestone.id, today]);
    addTodayPoints(milestone.points_value);
    loadGoals(); loadMilestones(goal.id);
  }

  async function addInlineMilestone(goal: Goal) {
    if (!newMilestoneTitle.trim()) return;
    const db = await getDb();
    const existing = goalMilestones[goal.id] || [];
    await db.execute(`INSERT INTO goal_milestones (goal_id, title, points_value, sort_order) VALUES (?,?,15,?)`,
      [goal.id, newMilestoneTitle.trim(), existing.length]);
    setNewMilestoneTitle('');
    loadMilestones(goal.id); loadGoals();
  }

  async function deleteMilestone(milestoneId: number, goalId: number) {
    const db = await getDb();
    await db.execute(`DELETE FROM goal_milestones WHERE id=?`, [milestoneId]);
    loadMilestones(goalId); loadGoals();
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const inputStyle = { width: '100%', background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10, padding: '10px 14px', color: theme.textPrimary, fontSize: 14, boxSizing: 'border-box' as const };
  const pillBtn = (active: boolean, onClick: () => void, label: string) => (
    <button onClick={onClick} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: active ? theme.accent : theme.bgInput, color: active ? '#fff' : theme.textSecondary }}>
      {label}
    </button>
  );

  // ─── Card renderer ──────────────────────────────────────────────────────────

  function renderGoalCard(g: Goal) {
    const cat = getCat(g.category);
    const isExpanded = expandedGoal === g.id;
    const pct = getProgressPct(g);
    const overdue = needsCheckIn(g);
    const doneThisPeriod = checkedInPeriod(g);
    const gt = g.goal_type || 'standard';
    const typeInfo = GOAL_TYPES.find(t => t.id === gt);
    const milestones = goalMilestones[g.id] || [];
    const recentCI = recentCheckIns[g.id] || [];
    const typeColor = GOAL_TYPE_COLORS[gt] ?? theme.accent;

    return (
      <div
        key={g.id}
        style={{
          background: theme.bgCard,
          borderRadius: 16,
          border: `1px solid ${overdue ? '#f59e0b44' : theme.bgCardBorder}`,
          borderLeft: `4px solid ${typeColor}`,
          boxShadow: theme.bgCardShadow,
          overflow: 'hidden',
        }}
      >
        {/* Long-term banner */}
        {g.is_long_term === 1 && (
          <div style={{ background: theme.accentGradient, padding: '5px 18px', fontSize: 11, color: '#fff', fontWeight: 700, letterSpacing: '0.1em' }}>
            ✨ LONG-TERM VISION
          </div>
        )}

        {/* Overdue check-in banner */}
        {overdue && (
          <div style={{ background: '#f59e0b12', borderBottom: `1px solid #f59e0b30`, padding: '6px 18px', fontSize: 12, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={12} /> Check-in overdue
          </div>
        )}

        {/* ── Card body ── */}
        <div style={{ padding: '16px 18px 14px' }}>

          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: g.description ? 8 : 10 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, cursor: 'pointer', minWidth: 0 }}
              onClick={() => openView(g)}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.emoji}</span>
              <h3 style={{ color: theme.textPrimary, margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {g.title}
              </h3>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {gt !== 'standard' && typeInfo && (
                <span style={{ background: typeColor + '22', color: typeColor, borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {typeInfo.emoji} {typeInfo.label}
                </span>
              )}
              {g.status === 'completed' && <span style={{ background: '#10b98118', color: '#10b981', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>✓ Done</span>}
              {g.status === 'archived' && <span style={{ background: '#6b728018', color: '#6b7280', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>Archived</span>}
              {g.status === 'missed' && <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>😔 Missed</span>}
            </div>
          </div>

          {/* Description */}
          {g.description && (
            <p style={{ color: theme.textSecondary, margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, cursor: 'pointer' }} onClick={() => openView(g)}>
              {g.description}
            </p>
          )}

          {/* ── Metric progress ── */}
          {gt === 'metric' && g.target_value != null && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ color: theme.textSecondary, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <TrendingUp size={13} color={typeColor} />
                  <strong style={{ color: theme.textPrimary }}>{g.current_value}</strong>
                  <span>/ {g.target_value} {g.unit || ''}</span>
                </span>
                <span style={{ color: pct >= 100 ? '#10b981' : typeColor, fontSize: 14, fontWeight: 800 }}>{pct}%</span>
              </div>
              <div style={{ background: theme.progressBg, borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ background: pct >= 100 ? '#10b981' : `linear-gradient(90deg, ${typeColor}bb, ${typeColor})`, width: `${pct}%`, height: 8, borderRadius: 6, transition: 'width 0.4s ease' }} />
              </div>
              {doneThisPeriod && <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600, marginTop: 5, display: 'block' }}>✅ Checked in!</span>}
              {g.last_check_in_date && !doneThisPeriod && (
                <span style={{ color: theme.textMuted, fontSize: 11, marginTop: 4, display: 'block' }}>Last: {formatDate(g.last_check_in_date)}</span>
              )}
            </div>
          )}

          {/* ── Habit streak ── */}
          {gt === 'habit' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <Flame size={18} color={g.streak_current > 0 ? typeColor : theme.textMuted} style={{ flexShrink: 0 }} />
                  <span style={{ color: g.streak_current > 0 ? typeColor : theme.textMuted, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
                    {g.streak_current}
                  </span>
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>
                    {g.check_in_frequency === 'weekly' ? 'wk streak' : 'day streak'}
                  </span>
                </div>
                {g.streak_best > 0 && (
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>Best: <strong style={{ color: theme.textSecondary }}>{g.streak_best}</strong></span>
                )}
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 700, background: g.streak_mode === 'forgiving' ? '#3b82f618' : '#ef444418', color: g.streak_mode === 'forgiving' ? '#3b82f6' : '#ef4444' }}>
                  {g.streak_mode === 'forgiving' ? `Forgiving (${g.cheat_days_per_week}/wk)` : 'Strict'}
                </span>
                {doneThisPeriod && (
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                    ✅ {g.check_in_frequency === 'weekly' ? 'This week!' : 'Today!'}
                  </span>
                )}
              </div>
              {isExpanded && recentCI.length > 0 && (
                <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                  {recentCI.slice().reverse().map((ci, i) => (
                    <div key={i} title={ci.check_in_date} style={{ width: 24, height: 24, borderRadius: 7, background: ci.is_success ? '#10b981' : ci.is_cheat_day ? '#f59e0b' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800 }}>
                      {ci.is_success ? '✓' : ci.is_cheat_day ? '~' : '✗'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Milestone progress ── */}
          {gt === 'milestone' && (g.milestoneTotal ?? 0) > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ color: theme.textSecondary, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Flag size={13} color={typeColor} />
                  <strong style={{ color: theme.textPrimary }}>{g.milestoneDone}</strong>
                  <span>/ {g.milestoneTotal} milestones</span>
                </span>
                <span style={{ color: pct >= 100 ? '#10b981' : typeColor, fontSize: 14, fontWeight: 800 }}>{pct}%</span>
              </div>
              <div style={{ background: theme.progressBg, borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ background: pct >= 100 ? '#10b981' : `linear-gradient(90deg, ${typeColor}bb, ${typeColor})`, width: `${pct}%`, height: 8, borderRadius: 6 }} />
              </div>
            </div>
          )}

          {/* ── Standard task progress ── */}
          {gt === 'standard' && (g.taskTotal ?? 0) > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ color: theme.textSecondary, fontSize: 13 }}>✓ {g.taskDone}/{g.taskTotal} tasks</span>
                <span style={{ color: pct >= 100 ? '#10b981' : typeColor, fontSize: 13, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ background: theme.progressBg, borderRadius: 6, height: 6, overflow: 'hidden' }}>
                <div style={{ background: pct >= 100 ? '#10b981' : `linear-gradient(90deg, ${typeColor}bb, ${typeColor})`, width: `${pct}%`, height: 6, borderRadius: 6 }} />
              </div>
            </div>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: theme.textMuted, fontSize: 12 }}>{cat.label}</span>
            <span style={{ color: typeColor, fontSize: 12, fontWeight: 700 }}>⭐ {g.points_value} pts</span>
            {g.target_date && <span style={{ color: theme.textMuted, fontSize: 12 }}>📅 {formatDate(g.target_date)}</span>}
            {(g.subGoalCount ?? 0) > 0 && <span style={{ color: theme.textMuted, fontSize: 12 }}>🎯 {g.subGoalCount} sub-goals</span>}
            {g.parent_goal_id && (() => {
              const parent = goals.find(p => p.id === g.parent_goal_id);
              return parent ? (
                <span style={{ color: theme.accent, fontSize: 11, fontWeight: 600, background: theme.accentLight, padding: '2px 8px', borderRadius: 20 }}>↳ {parent.title}</span>
              ) : null;
            })()}
          </div>
        </div>

        {/* ── Expanded: Milestones ── */}
        {isExpanded && gt === 'milestone' && (
          <div style={{ padding: '14px 18px 16px', borderTop: `1px solid ${theme.bgCardBorder}` }}>
            <p style={{ color: theme.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Milestones</p>
            {milestones.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 8 }}>No milestones yet. Add one below.</p>}
            {milestones.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: m.completed_date ? '#10b98110' : theme.bgInput, borderRadius: 10, padding: '9px 12px', marginBottom: 6, border: `1px solid ${m.completed_date ? '#10b98130' : theme.bgCardBorder}` }}>
                <button onClick={() => !m.completed_date && completeMilestone(m, g)} style={{ background: 'none', border: 'none', cursor: m.completed_date ? 'default' : 'pointer', padding: 0, flexShrink: 0 }}>
                  {m.completed_date ? <CheckSquare size={17} color='#10b981' /> : <Square size={17} color={theme.textMuted} />}
                </button>
                <span style={{ color: m.completed_date ? theme.textMuted : theme.textPrimary, fontSize: 13, flex: 1, textDecoration: m.completed_date ? 'line-through' : 'none' }}>{m.title}</span>
                <span style={{ color: typeColor, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>+{m.points_value}pts</span>
                {m.target_date && <span style={{ color: theme.textMuted, fontSize: 11 }}>📅 {formatDate(m.target_date)}</span>}
                {!m.completed_date && g.status === 'active' && (
                  <button onClick={() => deleteMilestone(m.id, g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: theme.textMuted, opacity: 0.4 }}><X size={13} /></button>
                )}
              </div>
            ))}
            {g.status === 'active' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.currentTarget.value)}
                  onKeyDown={e => e.key === 'Enter' && addInlineMilestone(g)}
                  placeholder='Add milestone...' style={{ ...inputStyle, flex: 1, padding: '7px 11px', fontSize: 13 }} />
                <button onClick={() => addInlineMilestone(g)} style={{ background: typeColor, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Add</button>
              </div>
            )}
          </div>
        )}

        {/* ── Expanded: Sub-goals ── */}
        {isExpanded && gt === 'standard' && (g.subGoalCount ?? 0) > 0 && (
          <div style={{ padding: '14px 18px 16px', borderTop: `1px solid ${theme.bgCardBorder}` }}>
            <p style={{ color: theme.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Sub-goals</p>
            {goals.filter(sg => sg.parent_goal_id === g.id).map(sg => (
              <div key={sg.id} style={{ background: theme.bgInput, borderRadius: 8, padding: '9px 13px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: theme.textPrimary, fontSize: 13 }}>{getCat(sg.category).emoji} {sg.title}</span>
                <span style={{ color: sg.status === 'completed' ? '#10b981' : theme.textMuted, fontSize: 12, fontWeight: 600 }}>{sg.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Expanded: Habit history ── */}
        {isExpanded && gt === 'habit' && recentCI.length === 0 && (
          <div style={{ padding: '14px 18px 16px', borderTop: `1px solid ${theme.bgCardBorder}` }}>
            <p style={{ color: theme.textMuted, fontSize: 13 }}>No check-ins yet. Start your streak!</p>
          </div>
        )}

        {/* ── Action bar ── */}
        <div style={{ borderTop: `1px solid ${theme.bgCardBorder}`, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 4, background: (theme.bgInput + '60') }}>
          {/* Secondary icon buttons */}
          <div style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }}>
            {g.status === 'active' && (
              <>
                <button onClick={() => openEdit(g)} title='Edit' style={{ background: 'none', color: theme.textMuted, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = theme.textMuted)}>
                  <Edit2 size={14} />
                </button>
                {g.target_date && (
                  <button onClick={() => openExtend(g)} title='Extend Deadline' style={{ background: 'none', color: theme.textMuted, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.color = theme.textPrimary)}
                    onMouseLeave={e => (e.currentTarget.style.color = theme.textMuted)}>
                    <CalendarClock size={14} />
                  </button>
                )}
                <button onClick={() => archiveGoal(g)} title='Archive' style={{ background: 'none', color: theme.textMuted, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = theme.textMuted)}>
                  <Archive size={14} />
                </button>
                <button onClick={() => openGoalMiss(g)} title='Mark as missed' style={{ background: 'none', color: '#ef444466', border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#ef444466')}>
                  <Ban size={14} />
                </button>
              </>
            )}
            {(g.status === 'completed' || g.status === 'archived') && (
              <button onClick={() => restoreGoal(g)} title='Restore to Active'
                style={{ background: theme.accentLight, color: theme.accent, border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                ↩ Restore
              </button>
            )}
            <button onClick={() => setConfirmDeleteGoal(g)} title='Delete' style={{ background: 'none', color: '#ef444455', border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#ef444455')}>
              <Trash2 size={14} />
            </button>
            {(gt === 'milestone' || gt === 'habit' || (g.subGoalCount ?? 0) > 0) && (
              <button onClick={() => setExpandedGoal(isExpanded ? null : g.id)} title={isExpanded ? 'Collapse' : 'Expand'}
                style={{ background: 'none', color: isExpanded ? typeColor : theme.textMuted, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>

          {/* Primary action */}
          {g.status === 'active' && (() => {
            if ((gt === 'metric' || gt === 'habit') && !doneThisPeriod) {
              return (
                <button onClick={() => openCheckIn(g)}
                  style={{ background: typeColor, color: '#fff', border: 'none', borderRadius: 9, padding: '7px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {gt === 'habit' ? <Flame size={13} /> : <TrendingUp size={13} />} Check In
                </button>
              );
            }
            if ((gt === 'metric' || gt === 'habit') && doneThisPeriod) {
              return <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✅ Checked in!</span>;
            }
            return (
              <button onClick={() => completeGoal(g)}
                style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98128', borderRadius: 9, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <Check size={13} /> Complete
              </button>
            );
          })()}
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: theme.textPrimary, fontSize: 28, fontWeight: 800, margin: 0 }}>Goals</h1>
          <p style={{ color: theme.textMuted, margin: '4px 0 0', fontSize: 14 }}>Track your aspirations and milestones</p>
        </div>
        <button onClick={openAdd} style={{ background: theme.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          <Plus size={17} /> Add Goal
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active',        value: activeCount,        color: GOAL_TYPE_COLORS.standard, icon: '🎯' },
          { label: 'Check-ins Due', value: needsCheckInCount,  color: '#f59e0b',                  icon: '⏰' },
          { label: 'Completed',     value: completedCount,     color: '#10b981',                  icon: '✅' },
          { label: 'Best Streak',   value: `${bestStreak}d`,  color: GOAL_TYPE_COLORS.milestone,  icon: '🔥' },
        ].map(s => (
          <div key={s.label} style={{ background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`, borderTop: `3px solid ${s.color}`, borderRadius: 14, padding: '14px 16px', textAlign: 'center', boxShadow: theme.bgCardShadow }}>
            <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: theme.textMuted, fontSize: 11, fontWeight: 600, marginTop: 4, letterSpacing: '0.03em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const count = t.id === 'all' ? goals.length : goals.filter(g => g.status === t.id).length;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: active ? theme.accent : theme.bgCard, color: active ? '#fff' : theme.textSecondary, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
              {t.label}
              {count > 0 && (
                <span style={{ background: active ? 'rgba(255,255,255,0.25)' : theme.bgInput, color: active ? '#fff' : theme.textMuted, borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Category filter ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        <button onClick={() => setCategoryFilter('all')}
          style={{ padding: '5px 12px', borderRadius: 14, border: `1px solid ${categoryFilter === 'all' ? theme.accent : theme.bgCardBorder}`, cursor: 'pointer', background: categoryFilter === 'all' ? theme.accentLight : 'transparent', color: categoryFilter === 'all' ? theme.accent : theme.textMuted, fontWeight: categoryFilter === 'all' ? 700 : 500, fontSize: 12, transition: 'all 0.15s' }}>
          All
        </button>
        {GOAL_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
            style={{ padding: '5px 12px', borderRadius: 14, border: `1px solid ${categoryFilter === cat.id ? theme.accent : theme.bgCardBorder}`, cursor: 'pointer', background: categoryFilter === cat.id ? theme.accentLight : 'transparent', color: categoryFilter === cat.id ? theme.accent : theme.textMuted, fontWeight: categoryFilter === cat.id ? 700 : 500, fontSize: 12, transition: 'all 0.15s' }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* ── Goal list ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: theme.textMuted }}>
          <Target size={48} style={{ opacity: 0.25, marginBottom: 16 }} />
          <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>No goals found</p>
          <p style={{ fontSize: 14, margin: 0 }}>Click <strong>Add Goal</strong> to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(g => <div key={g.id}>{renderGoalCard(g)}</div>)}
        </div>
      )}

      {/* ═══ CHECK-IN MODAL ═══ */}
      {showCheckInModal && checkInGoal && (() => {
        const isHabit = checkInGoal.goal_type === 'habit';
        const previewPct = checkInGoal.target_value && checkInValue
          ? Math.min(100, Math.round((parseFloat(checkInValue) / checkInGoal.target_value) * 100))
          : 0;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
            <div style={{ background: theme.bgCard, borderRadius: 24, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ color: theme.textPrimary, margin: 0, fontSize: 18, fontWeight: 700 }}>{isHabit ? '🔥 Habit Check-in' : '📊 Log Progress'}</h2>
                  <p style={{ color: theme.textMuted, margin: '4px 0 0', fontSize: 13 }}>{checkInGoal.title}</p>
                </div>
                <button onClick={() => { setShowCheckInModal(false); setCheckInGoal(null); }} style={{ background: theme.iconBg, border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: theme.textMuted }}><X size={16} /></button>
              </div>

              {isHabit ? (
                <div>
                  <p style={{ color: theme.textSecondary, fontSize: 15, marginBottom: 16, textAlign: 'center' }}>
                    Did you stick to your habit {checkInGoal.check_in_frequency === 'weekly' ? 'this week' : 'today'}?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    <button onClick={() => submitHabitCheckIn(true, false)} style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                      ✅ Yes! Keep the streak! +5pts
                    </button>
                    {checkInGoal.streak_mode === 'forgiving' && cheatDaysLeft > 0 && (
                      <button onClick={() => submitHabitCheckIn(false, true)} style={{ background: '#f59e0b20', color: '#f59e0b', border: `1px solid #f59e0b40`, borderRadius: 12, padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                        😅 Use a Cheat Day ({cheatDaysLeft} remaining this week)
                      </button>
                    )}
                    <button onClick={() => submitHabitCheckIn(false, false)} style={{ background: '#ef444420', color: '#ef4444', border: `1px solid #ef444440`, borderRadius: 12, padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                      ❌ No {checkInGoal.streak_mode === 'strict' ? '— streak resets to 0' : ''}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>🔥 Current: {checkInGoal.streak_current}</span>
                    <span style={{ color: theme.textMuted, fontSize: 13 }}>Best: {checkInGoal.streak_best}</span>
                  </div>
                  <textarea rows={2} placeholder='Notes (optional)...' value={checkInNotes} onChange={e => setCheckInNotes(e.currentTarget.value)} style={{ ...inputStyle, resize: 'none' }} />
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>How much have you achieved so far? ({checkInGoal.unit || 'units'})</label>
                    <input type='number' min='0' step='any' value={checkInValue} onChange={e => setCheckInValue(e.currentTarget.value)} placeholder={`Total progress in ${checkInGoal.unit || 'units'}`} style={inputStyle} />
                    {checkInGoal.target_value && checkInValue && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: theme.textMuted, fontSize: 12 }}>{checkInValue} / {checkInGoal.target_value} {checkInGoal.unit}</span>
                          <span style={{ color: theme.accent, fontSize: 12, fontWeight: 700 }}>{previewPct}%</span>
                        </div>
                        <div style={{ background: theme.progressBg, borderRadius: 6, height: 6 }}>
                          <div style={{ background: theme.progressFill, width: `${previewPct}%`, height: 6, borderRadius: 6 }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                    <textarea rows={2} placeholder='How did it go?' value={checkInNotes} onChange={e => setCheckInNotes(e.currentTarget.value)} style={{ ...inputStyle, resize: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setShowCheckInModal(false); setCheckInGoal(null); }} style={{ flex: 1, background: theme.bgInput, color: theme.textMuted, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10, padding: '11px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                    <button onClick={submitMetricCheckIn} disabled={!checkInValue} style={{ flex: 2, background: theme.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', cursor: 'pointer', fontWeight: 700, opacity: checkInValue ? 1 : 0.5 }}>Log Check-in +5pts</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ DELETE CONFIRM MODAL ═══ */}
      {confirmDeleteGoal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: theme.bgCard, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h2 style={{ color: theme.textPrimary, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Delete Goal?</h2>
              <p style={{ color: theme.textMuted, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                "<strong style={{ color: theme.textPrimary }}>{confirmDeleteGoal.title}</strong>" will be permanently deleted along with all its check-ins, milestones, and history. This cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDeleteGoal(null)}
                style={{ flex: 1, background: theme.bgInput, color: theme.textSecondary, border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={deleteGoal}
                style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ GOAL DETAIL VIEW MODAL ═══ */}
      {viewGoal && (() => {
        const vg = viewGoal;
        const vgt = vg.goal_type || 'standard';
        const vcat = getCat(vg.category);
        const vtypeInfo = GOAL_TYPES.find(t => t.id === vgt);
        const vpct = getProgressPct(vg);
        const vmilestones = goalMilestones[vg.id] || [];
        const vrecentCI = recentCheckIns[vg.id] || [];
        const vparent = vg.parent_goal_id ? goals.find(p => p.id === vg.parent_goal_id) : null;
        const vsubGoals = goals.filter(sg => sg.parent_goal_id === vg.id);
        const vdoneThisPeriod = checkedInPeriod(vg);

        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setViewGoal(null); }}
          >
            <div style={{ background: theme.bgCard, borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}>

              {/* Long-term banner */}
              {vg.is_long_term === 1 && (
                <div style={{ background: theme.accentGradient, padding: '7px 20px', fontSize: 12, color: '#fff', fontWeight: 700, letterSpacing: '0.06em' }}>✨ LONG-TERM VISION</div>
              )}

              {/* Header */}
              <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontSize: 24 }}>{vcat.emoji}</span>
                      {vtypeInfo && vgt !== 'standard' && (
                        <span style={{ background: theme.bgInput, borderRadius: 8, padding: '3px 10px', fontSize: 12, color: theme.textMuted, fontWeight: 600 }}>{vtypeInfo.emoji} {vtypeInfo.label}</span>
                      )}
                      <span style={{ background: theme.bgInput, borderRadius: 8, padding: '3px 10px', fontSize: 12, color: theme.textMuted, fontWeight: 600 }}>{vcat.label}</span>
                      {vg.status === 'completed' && <span style={{ background: '#10b98120', color: '#10b981', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>✓ Completed</span>}
                      {vg.status === 'archived' && <span style={{ background: '#6b728020', color: '#6b7280', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>Archived</span>}
                      {vg.status === 'active' && <span style={{ background: '#10b98115', color: '#10b981', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>● Active</span>}
                    </div>
                    <h2 style={{ color: theme.textPrimary, margin: '0 0 6px', fontSize: 20, fontWeight: 800, lineHeight: 1.3 }}>{vg.title}</h2>
                    {vg.description && <p style={{ color: theme.textSecondary, margin: 0, fontSize: 14, lineHeight: 1.5 }}>{vg.description}</p>}
                  </div>
                  <button onClick={() => setViewGoal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, flexShrink: 0, padding: 4 }}><X size={22} /></button>
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>

                {/* ── Metric progress ── */}
                {vgt === 'metric' && vg.target_value != null && (
                  <div style={{ background: theme.bgInput, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: theme.textSecondary, fontSize: 14, fontWeight: 600 }}>
                        <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        {vg.current_value} / {vg.target_value} {vg.unit || ''}
                      </span>
                      <span style={{ color: vpct >= 100 ? '#10b981' : theme.accent, fontSize: 15, fontWeight: 800 }}>{vpct}%</span>
                    </div>
                    <div style={{ background: theme.progressBg, borderRadius: 6, height: 10 }}>
                      <div style={{ background: vpct >= 100 ? '#10b981' : theme.progressFill, width: `${vpct}%`, height: 10, borderRadius: 6, transition: 'width 0.4s' }} />
                    </div>
                    {vg.last_check_in_date && <p style={{ color: theme.textMuted, fontSize: 12, margin: '8px 0 0' }}>Last check-in: {formatDate(vg.last_check_in_date)}</p>}
                  </div>
                )}

                {/* ── Habit streak ── */}
                {vgt === 'habit' && (
                  <div style={{ background: theme.bgInput, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: vrecentCI.length > 0 ? 12 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <Flame size={22} color={vg.streak_current > 0 ? '#f59e0b' : theme.textMuted} />
                        <span style={{ color: vg.streak_current > 0 ? '#f59e0b' : theme.textMuted, fontSize: 28, fontWeight: 800 }}>{vg.streak_current}</span>
                        <span style={{ color: theme.textMuted, fontSize: 14 }}>{vg.check_in_frequency === 'weekly' ? 'week streak' : 'day streak'}</span>
                      </div>
                      <div style={{ color: theme.textMuted, fontSize: 13 }}>Best: <strong style={{ color: theme.textPrimary }}>{vg.streak_best}</strong></div>
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 8, fontWeight: 600, background: vg.streak_mode === 'forgiving' ? '#3b82f620' : '#ef444420', color: vg.streak_mode === 'forgiving' ? '#3b82f6' : '#ef4444' }}>
                        {vg.streak_mode === 'forgiving' ? `Forgiving (${vg.cheat_days_per_week}/wk)` : 'Strict mode'}
                      </span>
                      {vdoneThisPeriod && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>✅ Done {vg.check_in_frequency === 'weekly' ? 'this week' : 'today'}!</span>}
                    </div>
                    {vrecentCI.length > 0 && (
                      <div>
                        <p style={{ color: theme.textMuted, fontSize: 11, fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last {vrecentCI.length} check-ins</p>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {vrecentCI.slice().reverse().map((ci, i) => (
                            <div key={i} title={ci.check_in_date} style={{ width: 28, height: 28, borderRadius: 8, background: ci.is_success ? '#10b981' : ci.is_cheat_day ? '#f59e0b' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700 }}>
                              {ci.is_success ? '✓' : ci.is_cheat_day ? '~' : '✗'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Milestone progress bar ── */}
                {vgt === 'milestone' && (vg.milestoneTotal ?? 0) > 0 && (
                  <div style={{ background: theme.bgInput, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: theme.textSecondary, fontSize: 14, fontWeight: 600 }}>
                        <Flag size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        {vg.milestoneDone} / {vg.milestoneTotal} milestones complete
                      </span>
                      <span style={{ color: vpct >= 100 ? '#10b981' : theme.accent, fontSize: 15, fontWeight: 800 }}>{vpct}%</span>
                    </div>
                    <div style={{ background: theme.progressBg, borderRadius: 6, height: 10 }}>
                      <div style={{ background: vpct >= 100 ? '#10b981' : theme.progressFill, width: `${vpct}%`, height: 10, borderRadius: 6, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )}

                {/* ── Details row ── */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  <span style={{ background: theme.bgInput, borderRadius: 10, padding: '6px 12px', fontSize: 13, color: theme.accent, fontWeight: 700 }}>⭐ {vg.points_value} pts</span>
                  {vg.target_date && <span style={{ background: theme.bgInput, borderRadius: 10, padding: '6px 12px', fontSize: 13, color: theme.textSecondary }}>📅 {formatDate(vg.target_date)}</span>}
                  {vg.check_in_frequency && vgt !== 'standard' && vgt !== 'milestone' && (
                    <span style={{ background: theme.bgInput, borderRadius: 10, padding: '6px 12px', fontSize: 13, color: theme.textSecondary }}>🔄 {vg.check_in_frequency}</span>
                  )}
                  {vg.start_date && <span style={{ background: theme.bgInput, borderRadius: 10, padding: '6px 12px', fontSize: 13, color: theme.textSecondary }}>🚀 Started {formatDate(vg.start_date)}</span>}
                  {vparent && (
                    <span style={{ background: theme.accentLight, borderRadius: 10, padding: '6px 12px', fontSize: 13, color: theme.accent, fontWeight: 600 }}>↳ {vparent.title}</span>
                  )}
                </div>

                {/* ── Milestones list ── */}
                {vgt === 'milestone' && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ color: theme.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 10px' }}>Milestones</p>
                    {vmilestones.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>No milestones yet.</p>}
                    {vmilestones.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: m.completed_date ? '#10b98110' : theme.bgInput, borderRadius: 10, padding: '11px 14px', marginBottom: 8, border: `1px solid ${m.completed_date ? '#10b98130' : theme.bgCardBorder}` }}>
                        <button
                          onClick={() => { if (!m.completed_date && vg.status === 'active') { completeMilestone(m, vg); setViewGoal(prev => prev ? { ...prev, milestoneDone: (prev.milestoneDone ?? 0) + 1 } : null); } }}
                          style={{ background: 'none', border: 'none', cursor: m.completed_date || vg.status !== 'active' ? 'default' : 'pointer', padding: 0, flexShrink: 0 }}
                        >
                          {m.completed_date ? <CheckSquare size={20} color='#10b981' /> : <Square size={20} color={theme.textMuted} />}
                        </button>
                        <span style={{ color: m.completed_date ? theme.textMuted : theme.textPrimary, fontSize: 14, flex: 1, textDecoration: m.completed_date ? 'line-through' : 'none' }}>{m.title}</span>
                        <span style={{ color: theme.accent, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>+{m.points_value}pts</span>
                        {m.target_date && <span style={{ color: theme.textMuted, fontSize: 12 }}>📅 {formatDate(m.target_date)}</span>}
                        {m.completed_date && <span style={{ color: '#10b981', fontSize: 11 }}>✓ {formatDate(m.completed_date)}</span>}
                      </div>
                    ))}
                    {vg.status === 'active' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <input value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.currentTarget.value)}
                          onKeyDown={e => e.key === 'Enter' && addInlineMilestone(vg).then(() => loadMilestones(vg.id))}
                          placeholder='Add a milestone…' style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: 13 }} />
                        <button onClick={() => addInlineMilestone(vg).then(() => loadMilestones(vg.id))} style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Add</button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Sub-goals ── */}
                {vsubGoals.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ color: theme.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 10px' }}>Sub-goals ({vsubGoals.length})</p>
                    {vsubGoals.map(sg => (
                      <div key={sg.id} onClick={() => openView(sg)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.bgInput, borderRadius: 10, padding: '10px 14px', marginBottom: 6, cursor: 'pointer' }}>
                        <span style={{ color: theme.textPrimary, fontSize: 14 }}>{getCat(sg.category).emoji} {sg.title}</span>
                        <span style={{ color: sg.status === 'completed' ? '#10b981' : theme.textMuted, fontSize: 12, fontWeight: 600 }}>{sg.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Standard task progress ── */}
                {vgt === 'standard' && (vg.taskTotal ?? 0) > 0 && (
                  <div style={{ background: theme.bgInput, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: theme.textSecondary, fontSize: 14 }}>✓ {vg.taskDone} / {vg.taskTotal} tasks done</span>
                      <span style={{ color: vpct >= 100 ? '#10b981' : theme.accent, fontSize: 15, fontWeight: 800 }}>{vpct}%</span>
                    </div>
                    <div style={{ background: theme.progressBg, borderRadius: 6, height: 8 }}>
                      <div style={{ background: vpct >= 100 ? '#10b981' : theme.progressFill, width: `${vpct}%`, height: 8, borderRadius: 6 }} />
                    </div>
                  </div>
                )}

              </div>

              {/* Footer action buttons */}
              {vg.status === 'active' && (
                <div style={{ padding: '12px 24px 20px', borderTop: `1px solid ${theme.bgCardBorder}`, display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                  {(vgt === 'metric' || vgt === 'habit') && !vdoneThisPeriod && (
                    <button onClick={() => { openCheckIn(vg); setViewGoal(null); }} style={{ background: '#f59e0b20', color: '#f59e0b', border: 'none', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      {vgt === 'habit' ? '🔥' : '📊'} Check In
                    </button>
                  )}
                  <button onClick={() => { openEdit(vg); setViewGoal(null); }} style={{ background: theme.bgInput, color: theme.textSecondary, border: 'none', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    ✏ Edit
                  </button>
                  {vg.target_date && (
                    <button onClick={() => { openExtend(vg); setViewGoal(null); }} style={{ background: theme.bgInput, color: theme.textSecondary, border: 'none', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      📅 Extend
                    </button>
                  )}
                  <button onClick={() => { completeGoal(vg); setViewGoal(null); }} style={{ marginLeft: 'auto', background: '#10b98120', color: '#10b981', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                    ✅ Mark Complete
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ EXTEND DEADLINE MODAL ═══ */}
      {extendGoal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: theme.bgCard, borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>📅</div>
              <h2 style={{ color: theme.textPrimary, fontSize: 19, fontWeight: 700, margin: '0 0 6px' }}>Extend Deadline</h2>
              <p style={{ color: theme.textMuted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Life happens — set a new target date for<br />
                <strong style={{ color: theme.textPrimary }}>{extendGoal.title}</strong>
              </p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                New End Date / Deadline
              </label>
              <input
                type='date'
                value={extendDate}
                min={getLocalDateString()}
                onChange={e => setExtendDate(e.currentTarget.value)}
                style={{ width: '100%', background: theme.bgInput, color: theme.textPrimary, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }}
              />
              {extendGoal.target_date && (
                <p style={{ color: theme.textMuted, fontSize: 12, margin: '6px 0 0' }}>
                  Current deadline: {formatDate(extendGoal.target_date)}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setExtendGoal(null)}
                style={{ flex: 1, background: theme.bgInput, color: theme.textSecondary, border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={saveExtendedDate}
                disabled={!extendDate || extendSaving}
                style={{ flex: 2, background: theme.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', cursor: (!extendDate || extendSaving) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: (!extendDate || extendSaving) ? 0.6 : 1 }}
              >
                {extendSaving ? 'Saving…' : '📅 Extend Deadline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MISS MODAL ═══ */}
      {showMissModal && missGoal && (() => {
        const reflPts = missReflection.trim() ? 1 : 0;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
            <div style={{ background: theme.bgCard, borderRadius: 24, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(239,68,68,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ color: '#ef4444', margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Ban size={17} /> Mark Goal as Missed</h2>
                  <p style={{ color: theme.textMuted, margin: '4px 0 0', fontSize: 13 }}>"{missGoal.title}"</p>
                </div>
                <button onClick={() => { setShowMissModal(false); setMissGoal(null); }} style={{ background: theme.iconBg, border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: theme.textMuted }}><X size={16} /></button>
              </div>
              <div style={{ background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <MessageSquare size={14} color={theme.accent} />
                  <span style={{ color: theme.textPrimary, fontWeight: 600, fontSize: 14 }}>What got in the way?</span>
                  <span style={{ marginLeft: 'auto', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700, background: reflPts > 0 ? '#10b98118' : theme.iconBg, color: reflPts > 0 ? '#10b981' : theme.textMuted }}>
                    {reflPts > 0 ? `+${reflPts} pts` : 'Optional — earns +2 pts'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {GOAL_MISS_REASONS.map(r => {
                    const sel = missReflection === r.label;
                    return (
                      <button key={r.label} onClick={() => setMissReflection(sel ? '' : r.label)} style={{ padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: sel ? 700 : 500, border: `1px solid ${sel ? '#ef4444' : theme.bgCardBorder}`, background: sel ? 'rgba(239,68,68,0.12)' : theme.bgCard, color: sel ? '#ef4444' : theme.textMuted, cursor: 'pointer' }}>
                        {r.emoji} {r.label}
                      </button>
                    );
                  })}
                </div>
                <textarea rows={2} placeholder='Or write your own reflection…' value={missReflection} onChange={e => setMissReflection(e.target.value)} style={{ width: '100%', background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`, color: theme.textPrimary, borderRadius: 10, padding: '8px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowMissModal(false); setMissGoal(null); }} style={{ flex: 1, background: theme.bgInput, color: theme.textMuted, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10, padding: '11px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Cancel</button>
                <button onClick={confirmGoalMiss} style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  {reflPts > 0 ? 'Log Miss (+2 pts)' : 'Mark as Missed'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ CREATE / EDIT MODAL ═══ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: theme.bgCard, borderRadius: 20, padding: 32, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ color: theme.textPrimary, margin: 0, fontSize: 22, fontWeight: 700 }}>{editGoal ? 'Edit Goal' : 'New Goal'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}><X size={22} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Goal Type */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600 }}>Goal Type</label>
                  <button
                    onClick={() => setShowGoalTypeHelp(h => !h)}
                    title="What's each goal type?"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: showGoalTypeHelp ? theme.accent : theme.textMuted, transition: 'color 0.15s' }}
                  >
                    <HelpCircle size={15} />
                  </button>
                </div>

                {/* Help panel */}
                {showGoalTypeHelp && (
                  <div style={{ background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { emoji: '🎯', label: 'Standard', color: theme.accent, desc: 'A goal with sub-tasks and milestones you complete one by one. Great for projects with a clear finish line — e.g. "Launch my website", "Write a book".' },
                        { emoji: '📊', label: 'Metric', color: '#10b981', desc: 'Track a number toward a target. Check in regularly with your current total — e.g. "Lose 50 lbs", "Save $10,000", "Run 500 miles".' },
                        { emoji: '🔥', label: 'Habit', color: '#f59e0b', desc: 'Build a streak with daily or weekly check-ins. Choose Strict mode (miss once = reset) or Forgiving mode (cheat days allowed). Link calendar events to auto-check in — e.g. "No sugar for 30 days", "Meditate every day".' },
                        { emoji: '🏁', label: 'Milestone', color: '#8b5cf6', desc: 'A big goal broken into ordered checkpoints. Complete each milestone in sequence, each worth its own points — e.g. "Start a business" → Register LLC → Build site → First sale.' },
                      ].map(t => (
                        <div key={t.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{t.emoji}</span>
                          <div>
                            <span style={{ color: t.color, fontWeight: 700, fontSize: 12 }}>{t.label}</span>
                            <span style={{ color: theme.textMuted, fontSize: 11, marginLeft: 6 }}>{t.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {GOAL_TYPES.map(t => (
                    <button key={t.id} onClick={() => setFormGoalType(t.id as GoalType)} style={{ padding: '10px 6px', borderRadius: 10, border: `2px solid ${formGoalType === t.id ? theme.accent : theme.bgCardBorder}`, background: formGoalType === t.id ? theme.accentLight : theme.bgInput, cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 18 }}>{t.emoji}</div>
                      <div style={{ color: formGoalType === t.id ? theme.accent : theme.textPrimary, fontSize: 12, fontWeight: 700, marginTop: 2 }}>{t.label}</div>
                      <div style={{ color: theme.textMuted, fontSize: 10, marginTop: 1 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.currentTarget.value })} placeholder='Goal title' style={inputStyle} />
              </div>

              {/* Description */}
              <div>
                <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.currentTarget.value })} placeholder='Describe your goal...' rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Category */}
              <div>
                <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.currentTarget.value })} style={inputStyle}>
                  {GOAL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>

              {/* Metric fields */}
              {formGoalType === 'metric' && (
                <div style={{ background: theme.bgInput, borderRadius: 12, padding: 16, border: `1px solid ${theme.bgCardBorder}` }}>
                  <p style={{ color: theme.accent, fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>📊 Metric Settings</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Target Amount</label>
                      <input type='number' min='0' step='any' value={formTargetValue} onChange={e => setFormTargetValue(e.currentTarget.value)} placeholder='e.g. 50' style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Unit</label>
                      <input value={formUnit} onChange={e => setFormUnit(e.currentTarget.value)} placeholder='lbs, miles, $...' style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Check-in Frequency</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {CHECK_IN_FREQS.map(f => pillBtn(formCheckInFreq === f.id, () => setFormCheckInFreq(f.id as CheckInFreq), f.label))}
                    </div>
                  </div>
                </div>
              )}

              {/* Habit fields */}
              {formGoalType === 'habit' && (
                <div style={{ background: theme.bgInput, borderRadius: 12, padding: 16, border: `1px solid ${theme.bgCardBorder}` }}>
                  <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>🔥 Habit Settings</p>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Check-in Frequency</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {pillBtn(formCheckInFreq === 'daily', () => setFormCheckInFreq('daily'), 'Daily')}
                      {pillBtn(formCheckInFreq === 'weekly', () => setFormCheckInFreq('weekly'), 'Weekly')}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Missed Check-in Behaviour</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setFormStreakMode('strict')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${formStreakMode === 'strict' ? '#ef4444' : theme.bgCardBorder}`, background: formStreakMode === 'strict' ? '#ef444420' : theme.bgCard, cursor: 'pointer' }}>
                        <div style={{ color: formStreakMode === 'strict' ? '#ef4444' : theme.textPrimary, fontWeight: 700, fontSize: 13 }}>🔴 Strict</div>
                        <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>Miss = back to day 1</div>
                      </button>
                      <button onClick={() => setFormStreakMode('forgiving')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${formStreakMode === 'forgiving' ? '#3b82f6' : theme.bgCardBorder}`, background: formStreakMode === 'forgiving' ? '#3b82f620' : theme.bgCard, cursor: 'pointer' }}>
                        <div style={{ color: formStreakMode === 'forgiving' ? '#3b82f6' : theme.textPrimary, fontWeight: 700, fontSize: 13 }}>🔵 Forgiving</div>
                        <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>Allow cheat days</div>
                      </button>
                    </div>
                  </div>
                  {formStreakMode === 'forgiving' && (
                    <div>
                      <label style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Cheat days per week</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['1','2','3'].map(n => pillBtn(formCheatDays === n, () => setFormCheatDays(n), `${n} day${n !== '1' ? 's' : ''}`))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Milestone fields */}
              {formGoalType === 'milestone' && (
                <div style={{ background: theme.bgInput, borderRadius: 12, padding: 16, border: `1px solid ${theme.bgCardBorder}` }}>
                  <p style={{ color: '#8b5cf6', fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>🏁 Milestones</p>
                  {formMilestones.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <span style={{ color: theme.textMuted, fontSize: 13, fontWeight: 600, minWidth: 20 }}>{i+1}.</span>
                      <input value={m.title} onChange={e => { const u = [...formMilestones]; u[i] = { ...m, title: e.currentTarget.value }; setFormMilestones(u); }} placeholder='Milestone title' style={{ ...inputStyle, flex: 2, padding: '8px 12px', fontSize: 13 }} />
                      <input type='number' min='1' value={m.points_value} onChange={e => { const u = [...formMilestones]; u[i] = { ...m, points_value: e.currentTarget.value }; setFormMilestones(u); }} placeholder='pts' style={{ ...inputStyle, width: 64, padding: '8px 10px', fontSize: 13 }} />
                      <button onClick={() => setFormMilestones(formMilestones.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><X size={16} /></button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input value={newMilestone.title} onChange={e => setNewMilestone({ ...newMilestone, title: e.currentTarget.value })} placeholder='Add milestone...' style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: 13 }} />
                    <button onClick={() => { if (!newMilestone.title.trim()) return; setFormMilestones([...formMilestones, { ...newMilestone }]); setNewMilestone({ title: '', points_value: '5', target_date: '' }); }} style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      + Add
                    </button>
                  </div>
                </div>
              )}

              {/* Linked event types */}
              {(formGoalType === 'metric' || formGoalType === 'habit') && (
                <div>
                  <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Linked Event Types
                    <span style={{ color: theme.textMuted, fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                      {formGoalType === 'habit' ? '— completing these auto-checks in' : '— supporting activities'}
                    </span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {EVENT_TYPES_FOR_LINKING.map(et => {
                      const active = formLinkedTypes.includes(et.id);
                      return (
                        <button key={et.id} onClick={() => setFormLinkedTypes(active ? formLinkedTypes.filter(x => x !== et.id) : [...formLinkedTypes, et.id])}
                          style={{ padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: active ? 700 : 500, border: `1px solid ${active ? theme.accent : theme.bgCardBorder}`, background: active ? theme.accentLight : theme.bgCard, color: active ? theme.accent : theme.textMuted, cursor: 'pointer' }}>
                          {et.emoji} {et.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Target date + Points */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600 }}>
                      End Date / Deadline
                    </label>
                    <span style={{ color: theme.textMuted, fontSize: 11 }}>optional</span>
                  </div>
                  <input type='date' value={form.target_date} onChange={e => setForm({ ...form, target_date: e.currentTarget.value })} style={inputStyle} />
                  <p style={{ color: theme.textMuted, fontSize: 11, margin: '4px 0 0' }}>
                    {form.is_long_term ? 'Leave blank for ongoing / lifelong goals' : 'When do you want to achieve this by?'}
                  </p>
                </div>
                <div>
                  <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Completion Points</label>
                  <input type='number' value={form.points_value} onChange={e => setForm({ ...form, points_value: e.currentTarget.value })} min='1' max='1000' style={inputStyle} />
                </div>
              </div>

              {/* Long-term + parent */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type='checkbox' checked={form.is_long_term} onChange={e => setForm({ ...form, is_long_term: e.currentTarget.checked })} style={{ width: 18, height: 18 }} />
                <span style={{ color: theme.textSecondary, fontSize: 14 }}>✨ This is a long-term vision goal</span>
              </label>
              {goals.filter(g => g.status === 'active' && g.id !== (editGoal?.id ?? -1)).length > 0 && (
                <div>
                  <label style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Parent Goal (optional)</label>
                  <select value={form.parent_goal_id} onChange={e => setForm({ ...form, parent_goal_id: e.currentTarget.value })} style={inputStyle}>
                    <option value=''>None</option>
                    {goals
                      .filter(g => g.status === 'active' && g.id !== (editGoal?.id ?? -1))
                      .map(g => (
                        <option key={g.id} value={String(g.id)}>
                          {g.is_long_term ? '✨ ' : ''}{getCat(g.category).emoji} {g.title}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              {/* Error message */}
              {saveError && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
                  ⚠️ Save failed: {saveError}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, background: theme.bgInput, color: theme.textSecondary, border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>Cancel</button>
                <button onClick={saveGoal} disabled={!form.title.trim() || saving} style={{ flex: 2, background: theme.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, opacity: (form.title.trim() && !saving) ? 1 : 0.5 }}>
                  {saving ? 'Saving…' : editGoal ? 'Update Goal' : 'Add Goal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
