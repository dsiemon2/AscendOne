import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAppStore } from '../store/appStore';
import { getDb } from '../db/database';
import { getLocalDateString, dateToLocalString } from '../utils/dateUtils';

const MAX_PER_PERIOD = 8;
const DEFAULT_SLOTS  = 3;

const PERIODS = [
  { id: 'morning',   label: 'Morning',   emoji: '🌅', color: '#f59e0b' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️', color: '#3b82f6' },
  { id: 'evening',   label: 'Evening',   emoji: '🌙', color: '#8b5cf6' },
];

interface Entry {
  id: number; text: string; period: string;
  entry_date: string; points_awarded: number;
}

function makeDrafts(existingCount: number): string[] {
  // Show enough blank slots to fill up to DEFAULT_SLOTS, min 0 if already at max
  const slots = Math.max(0, Math.min(DEFAULT_SLOTS - existingCount, MAX_PER_PERIOD - existingCount));
  return Array(slots).fill('');
}

export default function GratitudesPage() {
  const { theme } = useThemeStore();
  const { addTodayPoints } = useAppStore();

  const [entries, setEntries] = useState<Record<string, Entry[]>>({
    morning: [], afternoon: [], evening: [],
  });
  const [date, setDate]   = useState(getLocalDateString());
  const [drafts, setDrafts] = useState<Record<string, string[]>>({
    morning: Array(DEFAULT_SLOTS).fill(''),
    afternoon: Array(DEFAULT_SLOTS).fill(''),
    evening: Array(DEFAULT_SLOTS).fill(''),
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError]   = useState('');

  const loadEntries = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.select<Entry[]>(
        `SELECT * FROM gratitudes WHERE entry_date=? ORDER BY created_at`, [date]
      );
      const grouped: Record<string, Entry[]> = { morning: [], afternoon: [], evening: [] };
      rows.forEach(r => { if (grouped[r.period]) grouped[r.period].push(r); });
      setEntries(grouped);
      // Reset drafts based on how many slots are left
      setDrafts({
        morning:   makeDrafts(grouped.morning.length),
        afternoon: makeDrafts(grouped.afternoon.length),
        evening:   makeDrafts(grouped.evening.length),
      });
      setError('');
    } catch (e) {
      console.error('loadEntries error:', e);
      setError('Could not load entries. Please try again.');
    }
  }, [date]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T12:00:00'); // noon anchor avoids DST edge cases
    d.setDate(d.getDate() + delta);
    setDate(dateToLocalString(d));
  };

  const addSlot = (periodId: string) => {
    const total = entries[periodId].length + drafts[periodId].length;
    if (total >= MAX_PER_PERIOD) return;
    setDrafts(prev => ({ ...prev, [periodId]: [...prev[periodId], ''] }));
  };

  const savePeriod = async (periodId: string) => {
    const texts = drafts[periodId].filter(t => t.trim());
    if (texts.length === 0) return;
    setSaving(prev => ({ ...prev, [periodId]: true }));
    try {
      const db = await getDb();
      for (const text of texts) {
        await db.execute(
          `INSERT INTO gratitudes (text, period, entry_date, points_awarded) VALUES (?,?,?,?)`,
          [text.trim(), periodId, date, 0]
        );
      }
      // Points: 3 pts each for first 3 gratitudes of the day, 1 pt each after that
      // +10 bonus when hitting 9 total in a day
      const allRows = await db.select<Entry[]>(
        `SELECT * FROM gratitudes WHERE entry_date=?`, [date]
      );
      const prevTotal = allRows.length - texts.length;
      let pts = 0;
      for (let i = 0; i < texts.length; i++) {
        const position = prevTotal + i + 1; // 1-based position for this gratitude today
        pts += position <= 3 ? 3 : 1;
      }
      // Bonus if just crossed 9 total
      if (prevTotal < 9 && allRows.length >= 9) pts += 10;
      if (pts > 0) {
        await db.execute(
          `INSERT INTO points_log (points, reason, source_type, entry_date) VALUES (?,?,?,?)`,
          [pts, `Gratitudes - ${periodId}`, 'gratitude', date]
        );
        addTodayPoints(pts);
      }
      await loadEntries();
    } catch (e) {
      console.error('savePeriod error:', e);
      setError('Could not save gratitudes. Please try again.');
    } finally {
      setSaving(prev => ({ ...prev, [periodId]: false }));
    }
  };

  const fmt = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  const isToday    = date === getLocalDateString();
  const totalToday = Object.values(entries).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: theme.textPrimary, fontSize: 26, fontWeight: 700, margin: 0 }}>
            Gratitudes
          </h1>
          <p style={{ color: theme.textMuted, margin: '4px 0 0', fontSize: 14 }}>
            Appreciate the good in your life
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => changeDate(-1)}
            style={{ background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 8, padding: '8px', cursor: 'pointer', color: theme.textSecondary }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ color: theme.textPrimary, fontWeight: 600, fontSize: 14, minWidth: 180, textAlign: 'center' }}>
            {fmt(date)}
          </span>
          <button onClick={() => changeDate(1)} disabled={isToday}
            style={{ background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 8, padding: '8px', cursor: isToday ? 'not-allowed' : 'pointer', color: theme.textSecondary, opacity: isToday ? 0.4 : 1 }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <AlertCircle size={16} color="#ef4444" />
          <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
        </div>
      )}

      {/* Period cards */}
      {PERIODS.map(period => {
        const saved    = entries[period.id] ?? [];
        const draftArr = drafts[period.id] ?? [];
        const total    = saved.length + draftArr.length;
        const filled   = draftArr.filter(t => t.trim()).length;
        const canAdd   = total < MAX_PER_PERIOD;
        const isSaving = saving[period.id];

        return (
          <div key={period.id} style={{
            background: theme.bgCard,
            borderRadius: 16,
            border: `1px solid ${theme.bgCardBorder}`,
            marginBottom: 16,
            overflow: 'hidden',
            boxShadow: `0 4px 20px ${theme.bgCardShadow}`,
          }}>
            {/* Period header */}
            <div style={{
              background: period.color + '18',
              padding: '14px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: `1px solid ${period.color}22`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{period.emoji}</span>
                <div>
                  <div style={{ color: theme.textPrimary, fontWeight: 700, fontSize: 15 }}>
                    {period.label} Gratitudes
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 1 }}>
                    {saved.length}/{MAX_PER_PERIOD} entered
                  </div>
                </div>
              </div>
              {saved.length > 0 && (
                <span style={{
                  background: '#10b98120', color: '#10b981',
                  borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 600,
                }}>
                  ✓ {saved.length} saved
                </span>
              )}
            </div>

            <div style={{ padding: '18px 20px' }}>
              {/* Saved entries */}
              {saved.map((e, i) => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  marginBottom: 10,
                  padding: '8px 12px',
                  background: period.color + '0c',
                  borderRadius: 8,
                  border: `1px solid ${period.color}20`,
                }}>
                  <span style={{ color: period.color, fontWeight: 700, fontSize: 13, minWidth: 22, paddingTop: 1 }}>
                    {i + 1}.
                  </span>
                  <span style={{ color: theme.textPrimary, fontSize: 14, lineHeight: 1.55 }}>
                    {e.text}
                  </span>
                </div>
              ))}

              {/* Draft inputs */}
              {draftArr.length > 0 && (
                <div style={{ marginTop: saved.length > 0 ? 12 : 0 }}>
                  {draftArr.map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ color: period.color, fontWeight: 700, fontSize: 13, minWidth: 22, opacity: 0.6 }}>
                        {saved.length + idx + 1}.
                      </span>
                      <input
                        value={val}
                        onChange={e => {
                          const v = e.target.value;
                          setDrafts(prev => ({
                            ...prev,
                            [period.id]: prev[period.id].map((x, i2) => i2 === idx ? v : x),
                          }));
                        }}
                        placeholder="I am grateful for..."
                        style={{
                          flex: 1,
                          background: theme.bgInput,
                          border: `1px solid ${theme.bgCardBorder}`,
                          borderRadius: 8,
                          padding: '10px 14px',
                          color: theme.textPrimary,
                          fontSize: 14,
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))}

                  {/* Save button */}
                  <button
                    onClick={() => savePeriod(period.id)}
                    disabled={isSaving || filled === 0}
                    style={{
                      width: '100%',
                      background: filled === 0 ? 'transparent' : period.color,
                      color: filled === 0 ? theme.textMuted : '#fff',
                      border: filled === 0 ? `1px dashed ${theme.bgCardBorder}` : 'none',
                      borderRadius: 10,
                      padding: '11px',
                      cursor: filled === 0 ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 4,
                      transition: 'all 0.18s',
                    }}
                  >
                    <Check size={15} />
                    {isSaving
                      ? 'Saving…'
                      : `Save${filled > 0 ? ` (+${filled * 3} pts)` : ''}`}
                  </button>
                </div>
              )}

              {/* Add Gratitude button */}
              {canAdd && (
                <button
                  onClick={() => addSlot(period.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginTop: draftArr.length > 0 ? 10 : saved.length > 0 ? 4 : 0,
                    padding: '7px 14px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: `1px dashed ${period.color}60`,
                    color: period.color,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = period.color + '15';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <Plus size={14} />
                  Add Gratitude
                  <span style={{ color: theme.textMuted, fontWeight: 400 }}>
                    ({MAX_PER_PERIOD - total} remaining)
                  </span>
                </button>
              )}

              {/* Max reached */}
              {!canAdd && (
                <p style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
                  🎉 You've reached the maximum of {MAX_PER_PERIOD} gratitudes for {period.label}!
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Bonus tracker */}
      <div style={{
        background: theme.bgCard, borderRadius: 12,
        padding: '14px 18px', border: `1px solid ${theme.bgCardBorder}`, textAlign: 'center',
      }}>
        <span style={{ color: theme.textMuted, fontSize: 13 }}>
          🌟 Complete 9 gratitudes today for a <strong style={{ color: theme.accent }}>+10 bonus!</strong>
          &nbsp;({Math.min(totalToday, 9)}/9 done)
        </span>
      </div>
    </div>
  );
}
