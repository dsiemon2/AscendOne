import { useState, useEffect } from 'react';
import { Mail, MapPin, Calendar, Star, Heart, BookOpen, Target, Edit2, Award } from 'lucide-react';
import { useThemeStore, ThemeColors } from '../store/themeStore';
import { useAppStore } from '../store/appStore';
import { getDb } from '../db/database';
import { getLocalDateString } from '../utils/dateUtils';

interface ProfileStats {
  totalPoints:      number;
  totalGratitudes:  number;
  journalEntries:   number;
  activeGoals:      number;
  completedGoals:   number;
  tasksCompleted:   number;
  daysOnJourney:    number;
  joinedDate:       string;
  currentStreak:    number;
}

const LEVELS = [
  { min: 0,    title: 'Seeker',            emoji: '🌱', color: '#10b981' },
  { min: 100,  title: 'Believer',          emoji: '🌟', color: '#06b6d4' },
  { min: 250,  title: 'Manifestor',        emoji: '⚡', color: '#8b5cf6' },
  { min: 500,  title: 'Achiever',          emoji: '🔥', color: '#f59e0b' },
  { min: 1000, title: 'Ascender',          emoji: '🚀', color: '#5090e0' },
  { min: 2500, title: 'Visionary',         emoji: '💎', color: '#ec4899' },
  { min: 5000, title: 'Master Manifestor', emoji: '👑', color: '#f59e0b' },
];

function getLevel(pts: number) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) { if (pts >= l.min) lvl = l; }
  return lvl;
}

function fmtJoined(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ── Stat cell ─────────────────────────────────────────────────────────────────
function StatCell({
  icon, label, value, color, theme,
}: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
  theme: ThemeColors;
}) {
  return (
    <div style={{
      background: theme.bgCard, borderRadius: 14,
      border: `1px solid ${theme.bgCardBorder}`,
      padding: '18px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      boxShadow: `0 4px 16px ${theme.bgCardShadow}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: color + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ color: theme.textPrimary, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>{label}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { theme }             = useThemeStore();
  const { profile, setCurrentPage } = useAppStore();
  const [stats, setStats]     = useState<ProfileStats | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const db    = await getDb();
      const today = getLocalDateString();

      const [
        [pts], [grats], [journals],
        [activeG], [doneG], [tasks],
        [profileRow],
      ] = await Promise.all([
        db.select<[{ s: number }]>(`SELECT COALESCE(SUM(points),0) as s FROM points_log`),
        db.select<[{ s: number }]>(`SELECT COUNT(*) as s FROM gratitudes`),
        db.select<[{ s: number }]>(`SELECT COUNT(*) as s FROM journal_entries`),
        db.select<[{ s: number }]>(`SELECT COUNT(*) as s FROM goals WHERE status='active'`),
        db.select<[{ s: number }]>(`SELECT COUNT(*) as s FROM goals WHERE status='completed'`),
        db.select<[{ s: number }]>(`SELECT COUNT(*) as s FROM tasks WHERE status='completed'`),
        db.select<[{ created_at: string }]>(`SELECT created_at FROM profile WHERE id=1`),
      ]);

      const joinedRaw = profileRow?.created_at ?? new Date().toISOString();
      const joined    = new Date(joinedRaw);
      const now       = new Date();
      const days      = Math.max(0, Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24)));

      // Streak from points log
      const dRows = await db.select<{ d: string }[]>(`SELECT DISTINCT entry_date as d FROM points_log ORDER BY entry_date DESC`);
      let streak = 0;
      let cur = new Date(today);
      for (const r of dRows) {
        const rd   = new Date(r.d + 'T12:00:00');
        const diff = Math.round((cur.getTime() - rd.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 1) { streak++; cur = rd; } else break;
      }

      setStats({
        totalPoints:     pts.s,
        totalGratitudes: grats.s,
        journalEntries:  journals.s,
        activeGoals:     activeG.s,
        completedGoals:  doneG.s,
        tasksCompleted:  tasks.s,
        daysOnJourney:   days,
        joinedDate:      joinedRaw,
        currentStreak:   streak,
      });
    } catch (e) {
      console.error('ProfilePage load error', e);
    }
  }

  if (!profile) return null;

  const initials = [profile.first_name?.[0], profile.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'A';

  const level    = stats ? getLevel(stats.totalPoints) : LEVELS[0];
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div style={{
        background: theme.bgCard, borderRadius: 20,
        border: `1px solid ${theme.bgCardBorder}`,
        padding: '32px 28px', marginBottom: 20,
        boxShadow: `0 4px 30px ${theme.bgCardShadow}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative gradient background */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 80,
          background: theme.accentGradient, opacity: 0.15,
          borderRadius: '20px 20px 0 0',
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: theme.accentGradient, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', fontWeight: 800, color: '#fff',
            border: `3px solid ${theme.bgCard}`,
            boxShadow: `0 4px 20px ${theme.accent}50`, flexShrink: 0,
          }}>
            {profile.avatar_path
              ? <img src={profile.avatar_path} alt="avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>

          {/* Name + level */}
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <h1 style={{ color: theme.textPrimary, fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
              {fullName}
            </h1>
            {profile.username && (
              <p style={{ color: theme.textMuted, fontSize: 13, margin: '2px 0 6px' }}>
                @{profile.username}
              </p>
            )}
            {/* Level badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: level.color + '20', border: `1px solid ${level.color}50`,
              borderRadius: 20, padding: '4px 12px',
            }}>
              <span>{level.emoji}</span>
              <span style={{ color: level.color, fontSize: 12, fontWeight: 700 }}>{level.title}</span>
            </div>
          </div>

          {/* Edit profile button */}
          <button
            onClick={() => setCurrentPage('settings')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              background: theme.accentLight,
              border: `1px solid ${theme.bgCardBorder}`,
              color: theme.accent, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = theme.accent; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = theme.bgCardBorder; }}
          >
            <Edit2 size={13} /> Edit Profile
          </button>
        </div>

        {/* Profile info pills */}
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10, position: 'relative' }}>
          {profile.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.textMuted, fontSize: 13 }}>
              <Mail size={13} style={{ flexShrink: 0 }} />
              {profile.email}
            </div>
          )}
          {profile.country && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.textMuted, fontSize: 13 }}>
              <MapPin size={13} style={{ flexShrink: 0 }} />
              {profile.country}
            </div>
          )}
          {stats && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.textMuted, fontSize: 13 }}>
              <Calendar size={13} style={{ flexShrink: 0 }} />
              Journey started {fmtJoined(stats.joinedDate)}
            </div>
          )}
        </div>
      </div>

      {/* ── Journey stats ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ color: theme.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Journey Stats
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          <StatCell icon={<Calendar size={18} />}    label="Days on Journey"     value={stats?.daysOnJourney ?? 0}  color="#5090e0" theme={theme} />
          <StatCell icon={<Star    size={18} />}    label="Total Points"        value={stats?.totalPoints ?? 0}    color="#f59e0b" theme={theme} />
          <StatCell icon={<Award  size={18} />}    label="Day Streak"          value={`${stats?.currentStreak ?? 0}d`} color="#ef4444" theme={theme} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCell icon={<Heart      size={18} />} label="Gratitudes Logged"   value={stats?.totalGratitudes ?? 0} color="#ec4899" theme={theme} />
          <StatCell icon={<BookOpen   size={18} />} label="Journal Entries"     value={stats?.journalEntries ?? 0}  color="#6366f1" theme={theme} />
          <StatCell icon={<Target     size={18} />} label="Goals Completed"     value={stats?.completedGoals ?? 0}  color="#10b981" theme={theme} />
        </div>
      </div>

      {/* ── Motivational footer ─────────────────────────────────────────────── */}
      <div style={{
        background: theme.bgCard, borderRadius: 14,
        border: `1px solid ${theme.bgCardBorder}`,
        padding: '18px 22px', marginTop: 20, textAlign: 'center',
      }}>
        <p style={{ color: theme.textMuted, fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          "You are the creator of your own reality. Every thought, every feeling,
          every belief you hold is shaping your world."
        </p>
        <p style={{ color: theme.accent, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginTop: 8 }}>
          TIME · MANIFEST · ACHIEVE
        </p>
      </div>
    </div>
  );
}
