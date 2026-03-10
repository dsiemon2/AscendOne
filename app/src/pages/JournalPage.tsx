import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Plus, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAppStore } from '../store/appStore';
import { getDb } from '../db/database';
import { getLocalDateString } from '../utils/dateUtils';

const MOODS = [
  { v: 1, emoji: '😢', label: 'Tough' },
  { v: 2, emoji: '😕', label: 'Meh' },
  { v: 3, emoji: '😐', label: 'Okay' },
  { v: 4, emoji: '😊', label: 'Good' },
  { v: 5, emoji: '😄', label: 'Amazing' },
];

interface JEntry {
  id: number;
  content: string;
  mood: number;
  entry_date: string;
  word_count: number;
  points_awarded: number;
  created_at: string;
}

interface MonthGroup {
  key: string;   // "2026-02"
  label: string; // "February 2026"
  entries: JEntry[];
}

function groupByMonth(entries: JEntry[]): MonthGroup[] {
  const map: Record<string, JEntry[]> = {};
  for (const e of entries) {
    const key = e.entry_date.slice(0, 7);
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: new Date(key + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      entries: items,
    }));
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(ts: string) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export default function JournalPage() {
  const { theme } = useThemeStore();
  const { addTodayPoints } = useAppStore();

  // ── Writing area state ──────────────────────────────────────────────────────
  const [entry, setEntry]     = useState<JEntry | null>(null);
  const [date, setDate]       = useState(getLocalDateString());
  const [content, setContent] = useState('');
  const [mood, setMood]       = useState(3);
  const [saved, setSaved]     = useState(false);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);
  const forceNewRef           = useRef(false);

  // ── History panel state ─────────────────────────────────────────────────────
  const [allEntries, setAllEntries]         = useState<JEntry[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([getLocalDateString().slice(0, 7)])  // current local month
  );

  // ── Load all entries for history panel ──────────────────────────────────────
  const loadAllEntries = useCallback(async () => {
    const db = await getDb();
    const rows = await db.select<JEntry[]>(
      `SELECT * FROM journal_entries ORDER BY entry_date DESC, id DESC`
    );
    setAllEntries(rows);
  }, []);

  // ── Load a specific entry by ID (from history click) ────────────────────────
  function openEntry(e: JEntry) {
    setEntry(e);
    setContent(e.content);
    setMood(e.mood);
    setSaved(true);
    setDate(e.entry_date);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  // ── Load entry for current date (date navigator) ────────────────────────────
  const loadEntry = useCallback(async () => {
    const db = await getDb();
    const rows = await db.select<JEntry[]>(
      `SELECT * FROM journal_entries WHERE entry_date=? ORDER BY id DESC LIMIT 1`, [date]
    );
    if (rows[0] && !forceNewRef.current) {
      setEntry(rows[0]); setContent(rows[0].content); setMood(rows[0].mood); setSaved(true);
    } else {
      setEntry(null); setContent(''); setMood(3); setSaved(false);
    }
    forceNewRef.current = false;
  }, [date]);

  useEffect(() => { loadEntry(); }, [loadEntry]);
  useEffect(() => { loadAllEntries(); }, [loadAllEntries]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveEntry = async () => {
    if (!content.trim()) return;
    const db = await getDb();
    const wc = content.trim().split(/\s+/).length;
    if (entry) {
      await db.execute(
        `UPDATE journal_entries SET content=?, mood=?, word_count=? WHERE id=?`,
        [content, mood, wc, entry.id]
      );
    } else {
      await db.execute(
        `INSERT INTO journal_entries (content, mood, entry_date, word_count, points_awarded) VALUES (?,?,?,?,?)`,
        [content, mood, date, wc, 5]
      );
      const newRows = await db.select<JEntry[]>(
        `SELECT * FROM journal_entries WHERE entry_date=? ORDER BY id DESC LIMIT 1`, [date]
      );
      if (newRows[0]) setEntry(newRows[0]);
      await db.execute(
        `INSERT INTO points_log (points, reason, source_type, entry_date) VALUES (?,?,?,?)`,
        [5, 'Journal entry', 'journal', date]
      );
      addTodayPoints(5);
    }
    setSaved(true);
    loadAllEntries(); // refresh history panel
  };

  // ── New entry ───────────────────────────────────────────────────────────────
  function newEntry() {
    const today = getLocalDateString();
    forceNewRef.current = true;
    if (date === today) {
      setEntry(null); setContent(''); setMood(3); setSaved(false);
      forceNewRef.current = false;
    } else {
      setDate(today);
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isToday    = date === getLocalDateString();
  const wordCount  = content.trim() ? content.trim().split(/\s+/).length : 0;
  const monthGroups = groupByMonth(allEntries);

  function toggleMonth(key: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Mood stats ───────────────────────────────────────────────────────────────
  const totalEntries  = allEntries.length;
  const goodEntries   = allEntries.filter(e => e.mood >= 4).length;
  const positivityPct = totalEntries > 0 ? Math.round((goodEntries / totalEntries) * 100) : 0;
  const moodCounts    = [...MOODS].reverse().map(m => ({
    ...m, count: allEntries.filter(e => e.mood === m.v).length,
  }));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', height: '100%' }}>

      {/* ── LEFT: Writing area ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: theme.textPrimary, fontSize: 28, fontWeight: 700, margin: 0 }}>Journal</h1>
            <p style={{ color: theme.textMuted, margin: '4px 0 0', fontSize: 14 }}>
              {entry
                ? `Editing · ${fmtDate(date)}${entry.created_at ? ' · ' + fmtTime(entry.created_at) : ''}`
                : `New entry · ${fmtDate(date)}`
              }
            </p>
          </div>
          <button onClick={newEntry} style={{ background: theme.accentGradient, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <Plus size={16} /> New Entry
          </button>
        </div>

        {/* Writing card */}
        <div style={{ background: theme.bgCard, borderRadius: 16, border: `1px solid ${theme.bgCardBorder}`, padding: 24 }}>

          {/* Mood selector */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>How are you feeling?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {MOODS.map(m => (
                <button key={m.v} onClick={() => { setMood(m.v); setSaved(false); }}
                  style={{ flex: 1, padding: '10px 4px', border: mood === m.v ? `2px solid ${theme.accent}` : `2px solid transparent`, borderRadius: 10, background: mood === m.v ? theme.accentLight : theme.bgInput, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 24 }}>{m.emoji}</div>
                  <div style={{ color: theme.textSecondary, fontSize: 11, marginTop: 4 }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.currentTarget.value); setSaved(false); }}
            placeholder="Write your thoughts, reflections, gratitudes, intentions..."
            rows={14}
            style={{ width: '100%', background: theme.bgInput, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10, padding: '14px', color: theme.textPrimary, fontSize: 15, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7, marginBottom: 12 }}
          />

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: theme.textMuted, fontSize: 13 }}>{wordCount} words</span>
            <button onClick={saveEntry} disabled={!content.trim()}
              style={{ background: saved ? '#10b981' : theme.accentGradient, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: content.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, opacity: content.trim() ? 1 : 0.5, transition: 'background 0.3s' }}>
              <Save size={16} /> {saved ? '✓ Saved' : 'Save Entry (+5 pts)'}
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: History panel ─────────────────────────────────────────────── */}
      <div style={{ width: 270, flexShrink: 0 }}>

        {/* ── Mood Tracker ───────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 15 }}>✨</span>
            <span style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Mood Tracker
            </span>
          </div>

          {/* Good-days progress bar */}
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600 }}>Good Days</span>
              <span style={{ color: theme.accent, fontSize: 15, fontWeight: 700 }}>{positivityPct}%</span>
            </div>
            <div style={{ height: 6, background: theme.bgInput, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${positivityPct}%`, background: theme.accentGradient, borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 5 }}>
              {totalEntries === 0 ? 'No entries yet — start journaling!' : `${goodEntries} of ${totalEntries} entries positive`}
            </div>
          </div>

          {/* Per-mood rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {moodCounts.map(m => (
              <div key={m.v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}` }}>
                <span style={{ fontSize: 17 }}>{m.emoji}</span>
                <span style={{ color: theme.textSecondary, fontSize: 12, flex: 1 }}>{m.label}</span>
                <div style={{ width: 52, height: 4, background: theme.bgInput, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: totalEntries > 0 ? `${(m.count / totalEntries) * 100}%` : '0%',
                    background: m.v >= 4 ? '#10b981' : m.v === 3 ? '#f59e0b' : '#ef4444',
                    borderRadius: 2,
                  }} />
                </div>
                <span style={{ color: theme.textMuted, fontSize: 12, fontWeight: 700, minWidth: 18, textAlign: 'right' }}>{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <BookOpen size={16} style={{ color: theme.accent }} />
          <span style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Entry History
          </span>
          <span style={{ marginLeft: 'auto', background: theme.accentLight, color: theme.accent, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
            {allEntries.length}
          </span>
        </div>

        {allEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: theme.textMuted, fontSize: 13 }}>
            No entries yet.<br />Write your first one!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {monthGroups.map(group => {
              const isOpen = expandedMonths.has(group.key);
              return (
                <div key={group.key}>
                  {/* Month header */}
                  <button
                    onClick={() => toggleMonth(group.key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: isOpen ? theme.accentLight : 'transparent', border: 'none', cursor: 'pointer', marginBottom: 2 }}>
                    <span style={{ color: isOpen ? theme.accent : theme.textSecondary, fontWeight: 700, fontSize: 13 }}>
                      {group.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: theme.textMuted, fontSize: 11 }}>{group.entries.length}</span>
                      {isOpen
                        ? <ChevronDown size={13} style={{ color: theme.accent }} />
                        : <ChevronRight size={13} style={{ color: theme.textMuted }} />
                      }
                    </div>
                  </button>

                  {/* Entries in this month */}
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
                      {group.entries.map(e => {
                        const isActive = entry?.id === e.id;
                        return (
                          <button
                            key={e.id}
                            onClick={() => openEntry(e)}
                            style={{ width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: isActive ? `1px solid ${theme.accent}` : `1px solid transparent`, background: isActive ? theme.accentLight : 'transparent', cursor: 'pointer', transition: 'all 0.12s' }}
                            onMouseEnter={el => { if (!isActive) (el.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={el => { if (!isActive) (el.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: isActive ? theme.accent : theme.textPrimary, fontSize: 13, fontWeight: 600 }}>
                                  {fmtDate(e.entry_date)}
                                </div>
                                <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }}>
                                  {fmtTime(e.created_at)}  ·  {e.word_count} words
                                </div>
                              </div>
                              <span style={{ fontSize: 16, marginLeft: 6, flexShrink: 0 }}>
                                {MOODS.find(m => m.v === e.mood)?.emoji}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
