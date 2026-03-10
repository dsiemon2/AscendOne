import { useState, useEffect, useCallback } from 'react';
import { Trophy, Zap, Star, Flame, Calendar, Target, ShieldCheck } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { getDb } from '../db/database';
import { getLocalDateString, dateToLocalString } from '../utils/dateUtils';

const STREAK_GRACE_KEY = "ascendone_streak_grace";

interface PLog {
  id: number; points: number; reason: string;
  source_type: string; entry_date: string; created_at: string;
}

// ── Levels ─────────────────────────────────────────────────────────────────────
const LEVELS = [
  {
    min: 0, max: 499, level: 1, title: 'Seeker', emoji: '🌱', color: '#10b981',
    story: "You've heard about LOA, you're curious, you're trying. The journey begins.",
  },
  {
    min: 500, max: 1999, level: 2, title: 'Believer', emoji: '🌟', color: '#06b6d4',
    story: "The doubt is lifting. You're journaling, you're noticing signs. Something is shifting.",
  },
  {
    min: 2000, max: 4999, level: 3, title: 'Practitioner', emoji: '⚡', color: '#8b5cf6',
    story: "This is your practice now. Gratitudes are a habit. You feel different from who you were.",
  },
  {
    min: 5000, max: 8999, level: 4, title: 'Aligner', emoji: '🔥', color: '#f59e0b',
    story: "Your energy has shifted. Things are starting to align. People notice something different about you.",
  },
  {
    min: 9000, max: 14999, level: 5, title: 'Ascender', emoji: '🚀', color: '#5090e0',
    story: "You're near the summit. Manifestations are happening. You're not the same person who started.",
  },
  {
    min: 15000, max: 29999, level: 6, title: 'Manifestor', emoji: '🏆', color: '#ec4899',
    story: "You reached the top. You live in alignment. The law works for you now.",
  },
  {
    min: 30000, max: Infinity, level: 7, title: 'Master Manifestor', emoji: '👑', color: '#f59e0b',
    story: "You ARE the mountain. You are the example others look to.",
  },
];

function getLevel(pts: number) {
  return LEVELS.find(l => pts >= l.min && pts <= l.max) ?? LEVELS[LEVELS.length - 1];
}

// ── Badges ─────────────────────────────────────────────────────────────────────
interface BadgeData {
  totalPts: number; streak: number;
  gratitudeCount: number; journalCount: number;
  goalsCompleted: number; tasksCompleted: number;
  challengesCompleted: number; lettersWritten: number;
  hadStreak7: boolean; hadStreak30: boolean; hadStreak100: boolean;
}

const BADGES: {
  id: string; emoji: string; title: string; desc: string;
  color: string; category: 'Journey' | 'Streaks' | 'Challenges' | 'Practice';
  check: (d: BadgeData) => boolean;
}[] = [
  // Journey
  { id: 'seeker',         emoji: '⭐', title: 'Seeker',              desc: 'Earn your first 100 pts',        color: '#10b981', category: 'Journey',    check: d => d.totalPts >= 100   },
  { id: 'believer',       emoji: '🌟', title: 'Believer',           desc: 'Reach 500 pts',                  color: '#06b6d4', category: 'Journey',    check: d => d.totalPts >= 500   },
  { id: 'on-fire',        emoji: '🔥', title: 'On Fire',            desc: 'Reach 1,000 pts',                color: '#f97316', category: 'Journey',    check: d => d.totalPts >= 1000  },
  { id: 'practitioner',   emoji: '⚡', title: 'Practitioner',       desc: 'Reach 2,000 pts',                color: '#8b5cf6', category: 'Journey',    check: d => d.totalPts >= 2000  },
  { id: 'aligner',        emoji: '💎', title: 'Aligner',            desc: 'Reach 5,000 pts',                color: '#3b82f6', category: 'Journey',    check: d => d.totalPts >= 5000  },
  { id: 'ascender',       emoji: '🚀', title: 'Ascender',           desc: 'Reach 9,000 pts',                color: '#6366f1', category: 'Journey',    check: d => d.totalPts >= 9000  },
  { id: 'manifestor',     emoji: '🏆', title: 'Manifestor',         desc: 'Reach 15,000 pts',               color: '#ec4899', category: 'Journey',    check: d => d.totalPts >= 15000 },
  { id: 'master',         emoji: '👑', title: 'Master Manifestor',  desc: 'Reach 30,000 pts',               color: '#f59e0b', category: 'Journey',    check: d => d.totalPts >= 30000 },
  // Streaks
  { id: 'week-warrior',   emoji: '🔥', title: 'Week Warrior',       desc: '7-day streak',                   color: '#f97316', category: 'Streaks',    check: d => d.hadStreak7        },
  { id: 'monthly-legend', emoji: '🌙', title: 'Monthly Legend',     desc: '30-day streak',                  color: '#8b5cf6', category: 'Streaks',    check: d => d.hadStreak30       },
  { id: '100-day',        emoji: '🦁', title: '100-Day Legend',     desc: '100-day streak',                 color: '#f59e0b', category: 'Streaks',    check: d => d.hadStreak100      },
  // Challenges
  { id: 'ascend-champ',   emoji: '🏅', title: 'Ascend Champion',    desc: 'Complete a 30-Day Challenge',    color: '#8b5cf6', category: 'Challenges', check: d => d.challengesCompleted >= 1 },
  { id: 'future-vision',  emoji: '✉️', title: 'Future Visionary',   desc: 'Write your first Future Letter', color: '#06b6d4', category: 'Challenges', check: d => d.lettersWritten >= 1      },
  // Practice
  { id: 'gratitude-100',  emoji: '🙏', title: 'Voice of Gratitude', desc: '100 gratitudes written',         color: '#10b981', category: 'Practice',   check: d => d.gratitudeCount >= 100    },
  { id: 'journal-30',     emoji: '📓', title: 'Journal Keeper',     desc: '30 journal entries',             color: '#6366f1', category: 'Practice',   check: d => d.journalCount >= 30       },
  { id: 'goal-getter',    emoji: '🎯', title: 'Goal Getter',        desc: 'Complete 5 goals',               color: '#f59e0b', category: 'Practice',   check: d => d.goalsCompleted >= 5      },
  { id: 'task-master',    emoji: '✅', title: 'Task Master',        desc: 'Complete 50 tasks',              color: '#3b82f6', category: 'Practice',   check: d => d.tasksCompleted >= 50     },
];

function BadgeMedal({ badge, unlocked, size = 68 }: {
  badge: { id: string; title: string; color: string };
  unlocked: boolean;
  size?: number;
}) {
  const cx     = size / 2, cy = size / 2;
  const outerR = size / 2 - 1.5;
  const ringW  = Math.max(6, Math.round(size * 0.155));
  const innerR = outerR - ringW;
  const gid    = `bm${badge.id.replace(/[^a-z0-9]/g, '')}`;
  const r      = innerR;

  // Symbol colours
  const sym  = unlocked ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)';
  const sym2 = unlocked ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.06)';

  // Per-badge unique inner symbol
  function symbol() {
    switch (badge.id) {
      case 'seeker': return (
        <>
          <ellipse cx={cx-r*0.22} cy={cy+r*0.15} rx={r*0.17} ry={r*0.27}
            fill={sym} opacity={0.6} transform={`rotate(-18,${cx-r*0.22},${cy+r*0.15})`} />
          <ellipse cx={cx+r*0.20} cy={cy-r*0.20} rx={r*0.17} ry={r*0.27}
            fill={sym} opacity={0.9} transform={`rotate(18,${cx+r*0.20},${cy-r*0.20})`} />
        </>
      );
      case 'believer': return (
        <>
          {[0, 45, 90, 135].map(deg => {
            const a = (deg * Math.PI) / 180;
            return (
              <line key={deg}
                x1={(cx - r*0.58*Math.cos(a)).toFixed(2)} y1={(cy - r*0.58*Math.sin(a)).toFixed(2)}
                x2={(cx + r*0.58*Math.cos(a)).toFixed(2)} y2={(cy + r*0.58*Math.sin(a)).toFixed(2)}
                stroke={sym} strokeWidth={r*0.13} strokeLinecap="round" />
            );
          })}
          <circle cx={cx} cy={cy} r={r*0.18} fill={sym} />
        </>
      );
      case 'on-fire': return (
        <>
          <path d={`M ${cx} ${cy+r*0.65} C ${cx-r*0.52} ${cy+r*0.25} ${cx-r*0.48} ${cy-r*0.30} ${cx} ${cy-r*0.68} C ${cx+r*0.48} ${cy-r*0.30} ${cx+r*0.52} ${cy+r*0.25} ${cx} ${cy+r*0.65} Z`} fill={sym} />
          <path d={`M ${cx} ${cy+r*0.40} C ${cx-r*0.28} ${cy+r*0.10} ${cx-r*0.25} ${cy-r*0.25} ${cx} ${cy-r*0.45} C ${cx+r*0.25} ${cy-r*0.25} ${cx+r*0.28} ${cy+r*0.10} ${cx} ${cy+r*0.40} Z`} fill={sym2} />
        </>
      );
      case 'practitioner': return (
        <>
          {[0, 60, -60].map(deg => {
            const a = ((deg - 90) * Math.PI) / 180;
            const px = cx + r*0.32*Math.cos(a), py = cy + r*0.32*Math.sin(a);
            return (
              <ellipse key={deg} cx={px} cy={py} rx={r*0.18} ry={r*0.34}
                fill={sym} opacity={deg === 0 ? 0.88 : 0.60}
                transform={`rotate(${deg},${px},${py})`} />
            );
          })}
          <circle cx={cx} cy={cy} r={r*0.18} fill={sym} />
        </>
      );
      case 'aligner': return (
        <path d={`M ${cx} ${cy} C ${cx} ${cy-r*0.38} ${cx-r*0.58} ${cy-r*0.38} ${cx-r*0.58} ${cy} C ${cx-r*0.58} ${cy+r*0.38} ${cx} ${cy+r*0.38} ${cx} ${cy} C ${cx} ${cy-r*0.38} ${cx+r*0.58} ${cy-r*0.38} ${cx+r*0.58} ${cy} C ${cx+r*0.58} ${cy+r*0.38} ${cx} ${cy+r*0.38} ${cx} ${cy} Z`}
          fill="none" stroke={sym} strokeWidth={r*0.16} strokeLinejoin="round" />
      );
      case 'ascender': return (
        <>
          <polygon points={`${cx},${cy-r*0.72} ${cx-r*0.30},${cy+r*0.38} ${cx+r*0.30},${cy+r*0.38}`} fill={sym} />
          <polygon points={`${cx-r*0.30},${cy+r*0.05} ${cx-r*0.62},${cy+r*0.55} ${cx-r*0.30},${cy+r*0.38}`} fill={sym} opacity={0.6} />
          <polygon points={`${cx+r*0.30},${cy+r*0.05} ${cx+r*0.62},${cy+r*0.55} ${cx+r*0.30},${cy+r*0.38}`} fill={sym} opacity={0.6} />
          <circle cx={cx} cy={cy-r*0.08} r={r*0.14} fill={sym2} />
        </>
      );
      case 'manifestor': return (
        <>
          <path d={`M ${cx-r*0.48} ${cy-r*0.55} L ${cx-r*0.42} ${cy+r*0.15} Q ${cx-r*0.35} ${cy+r*0.42} ${cx} ${cy+r*0.42} Q ${cx+r*0.35} ${cy+r*0.42} ${cx+r*0.42} ${cy+r*0.15} L ${cx+r*0.48} ${cy-r*0.55} Z`} fill={sym} />
          <path d={`M ${cx-r*0.48} ${cy-r*0.25} Q ${cx-r*0.75} ${cy-r*0.15} ${cx-r*0.75} ${cy+r*0.05} Q ${cx-r*0.75} ${cy+r*0.30} ${cx-r*0.42} ${cy+r*0.15}`}
            fill="none" stroke={sym} strokeWidth={r*0.12} />
          <path d={`M ${cx+r*0.48} ${cy-r*0.25} Q ${cx+r*0.75} ${cy-r*0.15} ${cx+r*0.75} ${cy+r*0.05} Q ${cx+r*0.75} ${cy+r*0.30} ${cx+r*0.42} ${cy+r*0.15}`}
            fill="none" stroke={sym} strokeWidth={r*0.12} />
          <rect x={cx-r*0.10} y={cy+r*0.42} width={r*0.20} height={r*0.18} rx={r*0.04} fill={sym} />
          <rect x={cx-r*0.42} y={cy+r*0.58} width={r*0.84} height={r*0.12} rx={r*0.04} fill={sym} />
        </>
      );
      case 'master': return (
        <path d={`M ${cx-r*0.70} ${cy+r*0.50} L ${cx-r*0.70} ${cy-r*0.05} L ${cx-r*0.35} ${cy+r*0.22} L ${cx} ${cy-r*0.70} L ${cx+r*0.35} ${cy+r*0.22} L ${cx+r*0.70} ${cy-r*0.05} L ${cx+r*0.70} ${cy+r*0.50} Z`}
          fill={sym} />
      );
      case 'week-warrior': return (
        <>
          <path d={`M ${cx} ${cy-r*0.70} L ${cx+r*0.55} ${cy-r*0.38} L ${cx+r*0.55} ${cy+r*0.15} Q ${cx+r*0.55} ${cy+r*0.55} ${cx} ${cy+r*0.75} Q ${cx-r*0.55} ${cy+r*0.55} ${cx-r*0.55} ${cy+r*0.15} L ${cx-r*0.55} ${cy-r*0.38} Z`}
            fill={sym} opacity={0.75} />
          <path d={`M ${cx+r*0.10} ${cy-r*0.45} L ${cx-r*0.20} ${cy+r*0.05} L ${cx+r*0.02} ${cy+r*0.05} L ${cx-r*0.15} ${cy+r*0.55} L ${cx+r*0.22} ${cy-r*0.05} L ${cx} ${cy-r*0.05} Z`}
            fill={sym2} />
        </>
      );
      case 'monthly-legend': return (
        <>
          <path d={`M ${cx} ${cy-r*0.62} C ${cx-r*0.35} ${cy-r*0.62} ${cx-r*0.62} ${cy-r*0.35} ${cx-r*0.62} ${cy} C ${cx-r*0.62} ${cy+r*0.35} ${cx-r*0.35} ${cy+r*0.62} ${cx} ${cy+r*0.62} C ${cx+r*0.22} ${cy+r*0.30} ${cx+r*0.22} ${cy-r*0.30} ${cx} ${cy-r*0.62} Z`}
            fill={sym} />
          <circle cx={cx+r*0.45} cy={cy-r*0.40} r={r*0.09} fill={sym} opacity={0.8} />
          <circle cx={cx+r*0.58} cy={cy+r*0.10} r={r*0.06} fill={sym} opacity={0.6} />
        </>
      );
      case '100-day': return (
        <text x={cx} y={cy + r*0.25} textAnchor="middle" fill={sym}
          fontSize={Math.round(r * 0.60)} fontWeight={900}
          fontFamily="system-ui,-apple-system,sans-serif">100</text>
      );
      case 'ascend-champ': return (
        <polygon
          points={[...Array(5)].map((_, i) => {
            const oa = ((i * 72) - 90) * Math.PI / 180;
            const ia = ((i * 72 + 36) - 90) * Math.PI / 180;
            return `${(cx + r*0.65*Math.cos(oa)).toFixed(1)},${(cy + r*0.65*Math.sin(oa)).toFixed(1)} ${(cx + r*0.27*Math.cos(ia)).toFixed(1)},${(cy + r*0.27*Math.sin(ia)).toFixed(1)}`;
          }).join(' ')}
          fill={sym} />
      );
      case 'future-vision': return (
        <>
          <path d={`M ${cx-r*0.65} ${cy} Q ${cx} ${cy-r*0.55} ${cx+r*0.65} ${cy} Q ${cx} ${cy+r*0.55} ${cx-r*0.65} ${cy} Z`}
            fill={sym} opacity={0.75} />
          <circle cx={cx} cy={cy} r={r*0.27} fill={sym} />
          <circle cx={cx} cy={cy} r={r*0.13} fill={sym2} />
        </>
      );
      case 'gratitude-100': return (
        <path d={`M ${cx} ${cy+r*0.60} C ${cx-r*0.20} ${cy+r*0.30} ${cx-r*0.72} ${cy+r*0.10} ${cx-r*0.72} ${cy-r*0.18} C ${cx-r*0.72} ${cy-r*0.55} ${cx} ${cy-r*0.55} ${cx} ${cy-r*0.20} C ${cx} ${cy-r*0.55} ${cx+r*0.72} ${cy-r*0.55} ${cx+r*0.72} ${cy-r*0.18} C ${cx+r*0.72} ${cy+r*0.10} ${cx+r*0.20} ${cy+r*0.30} ${cx} ${cy+r*0.60} Z`}
          fill={sym} />
      );
      case 'journal-30': return (
        <>
          <rect x={cx-r*0.65} y={cy-r*0.52} width={r*0.60} height={r*0.72} rx={r*0.06} fill={sym} opacity={0.85} />
          <rect x={cx+r*0.05} y={cy-r*0.52} width={r*0.60} height={r*0.72} rx={r*0.06} fill={sym} opacity={0.85} />
          <line x1={cx} y1={cy-r*0.52} x2={cx} y2={cy+r*0.20} stroke={sym2} strokeWidth={r*0.10} />
          <line x1={cx-r*0.55} y1={cy-r*0.25} x2={cx-r*0.12} y2={cy-r*0.25} stroke={sym2} strokeWidth={r*0.07} strokeLinecap="round" />
          <line x1={cx-r*0.55} y1={cy-r*0.05} x2={cx-r*0.12} y2={cy-r*0.05} stroke={sym2} strokeWidth={r*0.07} strokeLinecap="round" />
          <line x1={cx-r*0.55} y1={cy+r*0.15} x2={cx-r*0.12} y2={cy+r*0.15} stroke={sym2} strokeWidth={r*0.07} strokeLinecap="round" />
          <line x1={cx+r*0.12} y1={cy-r*0.25} x2={cx+r*0.55} y2={cy-r*0.25} stroke={sym2} strokeWidth={r*0.07} strokeLinecap="round" />
          <line x1={cx+r*0.12} y1={cy-r*0.05} x2={cx+r*0.55} y2={cy-r*0.05} stroke={sym2} strokeWidth={r*0.07} strokeLinecap="round" />
          <line x1={cx+r*0.12} y1={cy+r*0.15} x2={cx+r*0.55} y2={cy+r*0.15} stroke={sym2} strokeWidth={r*0.07} strokeLinecap="round" />
        </>
      );
      case 'goal-getter': return (
        <>
          <circle cx={cx} cy={cy} r={r*0.70} fill="none" stroke={sym} strokeWidth={r*0.12} />
          <circle cx={cx} cy={cy} r={r*0.42} fill="none" stroke={sym} strokeWidth={r*0.10} opacity={0.8} />
          <circle cx={cx} cy={cy} r={r*0.18} fill={sym} />
        </>
      );
      case 'task-master': return (
        <path d={`M ${cx-r*0.55} ${cy} L ${cx-r*0.15} ${cy+r*0.48} L ${cx+r*0.62} ${cy-r*0.45}`}
          fill="none" stroke={sym} strokeWidth={r*0.22}
          strokeLinecap="round" strokeLinejoin="round" />
      );
      default: return <circle cx={cx} cy={cy} r={r*0.40} fill={sym} />;
    }
  }

  // Stars on ring (upper-left and upper-right positions)
  const starR  = outerR - ringW / 2;
  const starSz = Math.max(2.2, ringW * 0.26);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', filter: unlocked ? `drop-shadow(0 4px 14px ${badge.color}65)` : 'none', opacity: unlocked ? 1 : 0.38 }}>
      <defs>
        <linearGradient id={`lg${gid}`} x1="15%" y1="0%" x2="85%" y2="100%">
          {unlocked ? (
            <>
              <stop offset="0%"   stopColor="#fffde7" />
              <stop offset="28%"  stopColor="#fbbf24" />
              <stop offset="62%"  stopColor="#b45309" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
            </>
          ) : (
            <>
              <stop offset="0%"   stopColor="#6b6b6b" />
              <stop offset="50%"  stopColor="#2e2e2e" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`ig${gid}`} cx="38%" cy="35%" r="68%">
          <stop offset="0%"   stopColor={unlocked ? badge.color + 'dd' : '#252535'} />
          <stop offset="100%" stopColor={unlocked ? badge.color       : '#10101a'} />
        </radialGradient>
        <clipPath id={`cl${gid}`}>
          <circle cx={cx} cy={cy} r={innerR - 0.5} />
        </clipPath>
      </defs>

      {/* ── Outer gold ring ── */}
      <circle cx={cx} cy={cy} r={outerR} fill={`url(#lg${gid})`} />

      {/* ── Bevel lines ── */}
      <circle cx={cx} cy={cy} r={innerR + 1.2} fill="none"
        stroke={unlocked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.06)'} strokeWidth="1" />
      <circle cx={cx} cy={cy} r={innerR - 0.2} fill="none"
        stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />

      {/* ── Inner circle ── */}
      <circle cx={cx} cy={cy} r={innerR} fill={`url(#ig${gid})`} />

      {/* ── Badge symbol ── */}
      <g clipPath={`url(#cl${gid})`}>{symbol()}</g>

      {/* ── Stars on ring ── */}
      {([-42, -138] as number[]).map(angleDeg => {
        const a  = (angleDeg * Math.PI) / 180;
        const sx = cx + starR * Math.cos(a);
        const sy = cy + starR * Math.sin(a);
        const pts = [...Array(5)].map((_, i) => {
          const oa = ((i * 72) - 90) * Math.PI / 180;
          const ia = ((i * 72 + 36) - 90) * Math.PI / 180;
          return `${(sx + starSz*Math.cos(oa)).toFixed(1)},${(sy + starSz*Math.sin(oa)).toFixed(1)} ${(sx + starSz*0.38*Math.cos(ia)).toFixed(1)},${(sy + starSz*0.38*Math.sin(ia)).toFixed(1)}`;
        }).join(' ');
        return <polygon key={angleDeg} points={pts} fill={unlocked ? '#fff9c4' : '#555'} opacity={unlocked ? 0.92 : 0.40} />;
      })}

      {/* ── Ring shine highlight ── */}
      {unlocked && (
        <ellipse cx={cx - outerR*0.16} cy={cy - outerR*0.30}
          rx={outerR*0.22} ry={outerR*0.07}
          fill="rgba(255,255,255,0.55)"
          transform={`rotate(-32,${cx},${cy})`} />
      )}

      {/* ── Ribbon at top ── */}
      <path
        d={`M ${(cx-size*0.13).toFixed(1)} 1.5 L ${(cx+size*0.13).toFixed(1)} 1.5 L ${(cx+size*0.11).toFixed(1)} ${(size*0.085).toFixed(1)} L ${cx} ${(size*0.052).toFixed(1)} L ${(cx-size*0.11).toFixed(1)} ${(size*0.085).toFixed(1)} Z`}
        fill={unlocked ? '#3b82f6' : '#334155'}
        opacity={unlocked ? 0.90 : 0.30}
      />
    </svg>
  );
}

// ── How to Earn reference data ─────────────────────────────────────────────────
const HOW_TO_EARN = [
  {
    category: 'Daily Practice',
    color: '#6366f1',
    items: [
      { label: '📓  Journal entry',                      pts: '5 pts'          },
      { label: '🙏  Gratitude (1st – 3rd per day)',      pts: '3 pts each'     },
      { label: '🙏  Gratitude (4th – 9th per day)',      pts: '1 pt each'      },
      { label: '🙏  Daily gratitude bonus (write 9)',    pts: '+10 pts'        },
      { label: '💭  Missed habit reflection',            pts: '1 pt'           },
    ],
  },
  {
    category: 'Goals & Milestones',
    color: '#10b981',
    items: [
      { label: '🔥  Goal habit / metric check-in',      pts: '7 pts'          },
      { label: '🎯  Goal completed',                     pts: '25 pts (default)'},
      { label: '🏁  Milestone completed',                pts: '15 pts (default)'},
      { label: '⚡  7-day goal streak bonus',            pts: '+15 pts'        },
      { label: '⚡  30-day goal streak bonus',           pts: '+40 pts'        },
      { label: '⚡  100-day goal streak bonus',          pts: '+100 pts'       },
    ],
  },
  {
    category: 'Challenges & Letters',
    color: '#8b5cf6',
    items: [
      { label: '🏅  Complete a 30-Day Challenge',        pts: '500 pts'        },
      { label: '✉️   Write a Future Letter',              pts: '75 pts'         },
    ],
  },
];

function srcColor(t: string): string {
  if (t === 'goal')         return '#10b981';
  if (t === 'journal')      return '#6366f1';
  if (t === 'gratitude')    return '#f59e0b';
  if (t === 'habit')        return '#ec4899';
  if (t === 'task')         return '#3b82f6';
  if (t === 'reflection')   return '#a855f7';
  if (t === 'event')        return '#10b981';
  if (t === 'check_in')     return '#f59e0b';
  if (t === 'milestone')    return '#8b5cf6';
  if (t === 'streak_bonus') return '#f59e0b';
  return '#8b5cf6';
}

function srcEmoji(t: string): string {
  if (t === 'goal')         return '🎯';
  if (t === 'journal')      return '📓';
  if (t === 'gratitude')    return '🙏';
  if (t === 'habit')        return '✅';
  if (t === 'task')         return '📋';
  if (t === 'reflection')   return '💭';
  if (t === 'event')        return '🗓️';
  if (t === 'check_in')     return '🔥';
  if (t === 'milestone')    return '🏁';
  if (t === 'streak_bonus') return '⚡';
  return '⭐';
}

function fmtDate(d: string) {
  const date = new Date(d + 'T12:00:00');
  const today = getLocalDateString();
  if (d === today) return 'Today';
  const yday = new Date(); yday.setDate(yday.getDate() - 1);
  if (d === dateToLocalString(yday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PointsPage() {
  const { theme } = useThemeStore();
  const [totalPts, setTotalPts]     = useState(0);
  const [logs, setLogs]             = useState<PLog[]>([]);
  const [todayPts, setTodayPts]     = useState(0);
  const [streak, setStreak]         = useState(0);
  const [weekData, setWeekData]     = useState<{ date: string; pts: number; label: string }[]>([]);
  const [missedCount, setMissedCount] = useState(0);
  const [graceApplied, setGraceApplied] = useState(false);
  const [gratitudeCount,      setGratitudeCount]      = useState(0);
  const [journalCount,        setJournalCount]         = useState(0);
  const [goalsCompleted,      setGoalsCompleted]       = useState(0);
  const [tasksCompleted,      setTasksCompleted]       = useState(0);
  const [challengesCompleted, setChallengesCompleted]  = useState(0);
  const [lettersWritten,      setLettersWritten]       = useState(0);
  const [hadStreak7,          setHadStreak7]           = useState(false);
  const [hadStreak30,         setHadStreak30]          = useState(false);
  const [hadStreak100,        setHadStreak100]         = useState(false);
  const [showGuide,           setShowGuide]            = useState(false);
  const [guideTab,            setGuideTab]             = useState<'levels' | 'earn' | 'badges'>('levels');

  const load = useCallback(async () => {
    try {
      const db    = await getDb();
      const today = getLocalDateString();

      const yesterday = dateToLocalString(new Date(Date.now() - 86400000));
      const [allLogs, tRows, totRows] = await Promise.all([
        db.select<PLog[]>(`SELECT * FROM points_log WHERE entry_date >= ? ORDER BY created_at DESC`, [yesterday]),
        db.select<{ s: number }[]>(`SELECT COALESCE(SUM(points),0) as s FROM points_log WHERE entry_date=?`, [today]),
        db.select<{ s: number }[]>(`SELECT COALESCE(SUM(points),0) as s FROM points_log`),
      ]);

      setLogs(allLogs);
      setTodayPts(tRows[0]?.s ?? 0);
      setTotalPts(totRows[0]?.s ?? 0);

      // Streak from points_log days — with 1-time grace day if streak >= 7
      const dRows = await db.select<{ d: string }[]>(`SELECT DISTINCT entry_date as d FROM points_log ORDER BY entry_date DESC`);
      let st = 0;
      let cur = new Date(today + 'T12:00:00');
      let graceUsed = false;
      let graceWasApplied = false;
      for (const r of dRows) {
        const rd   = new Date(r.d + 'T12:00:00');
        const diff = Math.round((cur.getTime() - rd.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 1) {
          st++;
          cur = rd;
        } else if (diff === 2 && !graceUsed && st >= 7) {
          // 1-day gap, streak ≥ 7 — apply grace day
          graceUsed = true;
          graceWasApplied = true;
          const gapDay = dateToLocalString(new Date(cur.getTime() - 86400000));
          try { localStorage.setItem(STREAK_GRACE_KEY, gapDay); } catch { /* ignore */ }
          st += 2; // +1 grace day, +1 this activity day
          cur = rd;
        } else {
          break;
        }
      }
      setStreak(st);
      setGraceApplied(graceWasApplied);

      // ── Badge condition queries ──────────────────────────────────────────────
      try {
        const [gcR, jcR, goalR, taskR, chalR, letR, sbR] = await Promise.all([
          db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM gratitudes'),
          db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM journal_entries'),
          db.select<{ c: number }[]>(`SELECT COUNT(*) as c FROM goals WHERE status='completed'`),
          db.select<{ c: number }[]>(`SELECT COUNT(*) as c FROM tasks WHERE status='completed'`),
          db.select<{ c: number }[]>(`SELECT COUNT(*) as c FROM points_log WHERE source_type='challenge'`),
          db.select<{ c: number }[]>(`SELECT COUNT(*) as c FROM points_log WHERE source_type='letter'`),
          db.select<{ points: number }[]>(`SELECT DISTINCT points FROM points_log WHERE source_type='streak_bonus'`),
        ]);
        setGratitudeCount(gcR[0]?.c ?? 0);
        setJournalCount(jcR[0]?.c ?? 0);
        setGoalsCompleted(goalR[0]?.c ?? 0);
        setTasksCompleted(taskR[0]?.c ?? 0);
        setChallengesCompleted(chalR[0]?.c ?? 0);
        setLettersWritten(letR[0]?.c ?? 0);
        const bp = new Set(sbR.map(r => r.points));
        setHadStreak7(bp.has(15)  || st >= 7);
        setHadStreak30(bp.has(40) || st >= 30);
        setHadStreak100(bp.has(100) || st >= 100);
      } catch (e) { console.warn('Badge queries failed', e); }

      // Missed items count (last 30 days) — use local date for the cutoff
      try {
        const cutoff = dateToLocalString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        const mRows = await db.select<{ c: number }[]>(
          `SELECT COUNT(*) as c FROM missed_log WHERE missed_date >= ?`, [cutoff]
        );
        setMissedCount(mRows[0]?.c ?? 0);
      } catch { setMissedCount(0); }

      // Last 7 days chart — use local date strings so bars align with user's calendar
      const last7: { date: string; pts: number; label: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = dateToLocalString(d);
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        const rows = await db.select<{ s: number }[]>(
          `SELECT COALESCE(SUM(points),0) as s FROM points_log WHERE entry_date=?`, [dateStr]
        );
        last7.push({ date: dateStr, pts: rows[0]?.s ?? 0, label: dayLabel });
      }
      setWeekData(last7);
    } catch (e) { console.error('PointsPage load error', e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const level    = getLevel(totalPts);
  const nextLvl  = LEVELS.find(l => l.level === level.level + 1);
  const lvlPct   = nextLvl
    ? Math.min(100, Math.round(((totalPts - level.min) / (nextLvl.min - level.min)) * 100))
    : 100;

  const maxWeek  = Math.max(...weekData.map(d => d.pts), 1);

  const badgeData: BadgeData = {
    totalPts, streak,
    gratitudeCount, journalCount,
    goalsCompleted, tasksCompleted,
    challengesCompleted, lettersWritten,
    hadStreak7, hadStreak30, hadStreak100,
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: theme.textPrimary, fontSize: 26, fontWeight: 700, margin: 0 }}>
            Points & Rewards
          </h1>
          <p style={{ color: theme.textMuted, margin: '4px 0 0', fontSize: 14 }}>
            Gamify your manifestation journey
          </p>
        </div>
        <button
          onClick={() => { setShowGuide(true); setGuideTab('levels'); }}
          style={{
            background: 'none',
            border: `1px solid ${theme.accent}55`,
            borderRadius: 12,
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: theme.accent,
            fontWeight: 700,
            fontSize: 13,
            boxShadow: `0 0 14px ${theme.accent}18`,
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
          }}
        >
          📖 Journey Guide
        </button>
      </div>

      {/* ── Level card ─────────────────────────────────────────────────────── */}
      <div style={{
        background: theme.bgCard, borderRadius: 18,
        border: `1px solid ${level.color}40`,
        padding: '22px 24px', marginBottom: 20,
        boxShadow: `0 4px 30px ${level.color}18`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: level.color + '22',
            border: `2px solid ${level.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, flexShrink: 0,
          }}>
            {level.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: theme.textMuted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Level {level.level}
              </span>
              <span style={{ color: level.color, fontSize: 20, fontWeight: 800 }}>
                {level.title}
              </span>
            </div>
            <div style={{ color: theme.textPrimary, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
              {totalPts.toLocaleString()} pts
            </div>
            {nextLvl && (
              <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                {(nextLvl.min - totalPts).toLocaleString()} pts to {nextLvl.title} {nextLvl.emoji}
              </div>
            )}
          </div>
        </div>
        {/* Level progress bar */}
        <div style={{ background: theme.progressBg, borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div style={{
            height: 8, width: `${lvlPct}%`, borderRadius: 6,
            background: `linear-gradient(90deg, ${level.color}99, ${level.color})`,
            transition: 'width 0.6s ease',
          }} />
        </div>
        {nextLvl && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ color: theme.textMuted, fontSize: 11 }}>{level.min.toLocaleString()} pts</span>
            <span style={{ color: level.color, fontSize: 11, fontWeight: 600 }}>{lvlPct}%</span>
            <span style={{ color: theme.textMuted, fontSize: 11 }}>{nextLvl.min.toLocaleString()} pts</span>
          </div>
        )}
        {/* Level story */}
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: `${level.color}12`, border: `1px solid ${level.color}28` }}>
          <p style={{ color: theme.textSecondary, fontSize: 13, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
            "{level.story}"
          </p>
        </div>
      </div>

      {/* ── Stat mini-cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {/* Total Points */}
        <div style={{ background: theme.bgCard, borderRadius: 14, border: `1px solid ${theme.bgCardBorder}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 4px 16px ${theme.bgCardShadow}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f59e0b18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={20} color="#f59e0b" />
          </div>
          <div>
            <div style={{ color: theme.textPrimary, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{totalPts.toLocaleString()}</div>
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>Total Points</div>
          </div>
        </div>

        {/* Today's Pts */}
        <div style={{ background: theme.bgCard, borderRadius: 14, border: `1px solid ${theme.bgCardBorder}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 4px 16px ${theme.bgCardShadow}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#10b98118', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={20} color="#10b981" />
          </div>
          <div>
            <div style={{ color: theme.textPrimary, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{todayPts}</div>
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>Today's Pts</div>
          </div>
        </div>

        {/* Day Streak — with grace indicator */}
        <div style={{ background: theme.bgCard, borderRadius: 14, border: `1px solid ${theme.bgCardBorder}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 4px 16px ${theme.bgCardShadow}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Flame size={20} color="#ef4444" />
          </div>
          <div>
            <div style={{ color: theme.textPrimary, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{streak}d</div>
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>Day Streak</div>
            {graceApplied && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <ShieldCheck size={10} color={theme.accent} />
                <span style={{ color: theme.accent, fontSize: 10, fontWeight: 600 }}>Grace day used</span>
              </div>
            )}
          </div>
        </div>

        {/* Focus Needed (missed this month) */}
        <div style={{
          background: missedCount > 0 ? 'rgba(245,158,11,0.06)' : theme.bgCard,
          borderRadius: 14,
          border: `1px solid ${missedCount > 0 ? 'rgba(245,158,11,0.3)' : theme.bgCardBorder}`,
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: `0 4px 16px ${theme.bgCardShadow}`,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: missedCount > 0 ? '#f59e0b18' : theme.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Target size={20} color={missedCount > 0 ? "#f59e0b" : theme.textMuted} />
          </div>
          <div>
            <div style={{ color: missedCount > 0 ? '#f59e0b' : theme.textPrimary, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
              {missedCount > 0 ? missedCount : '🌟'}
            </div>
            <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>
              {missedCount > 0 ? 'Focus Needed' : 'All on track!'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Weekly chart ─────────────────────────────────────────────────────── */}
      {weekData.length > 0 && (
        <div style={{
          background: theme.bgCard, borderRadius: 16,
          border: `1px solid ${theme.bgCardBorder}`,
          padding: '18px 20px', marginBottom: 20,
          boxShadow: `0 4px 16px ${theme.bgCardShadow}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Calendar size={15} color={theme.accent} />
            <span style={{ color: theme.textPrimary, fontWeight: 700, fontSize: 14 }}>Last 7 Days</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {weekData.map(d => {
              const barH   = Math.max(4, Math.round((d.pts / maxWeek) * 72));
              const isToday = d.date === getLocalDateString();
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600 }}>
                    {d.pts > 0 ? d.pts : ''}
                  </div>
                  <div style={{
                    width: '100%', height: barH, borderRadius: 4,
                    background: isToday ? theme.accentGradient : (d.pts > 0 ? theme.accent + '70' : theme.progressBg),
                    transition: 'height 0.4s ease',
                    boxShadow: isToday ? `0 2px 8px ${theme.accent}40` : 'none',
                  }} />
                  <div style={{ fontSize: 11, color: isToday ? theme.accent : theme.textMuted, fontWeight: isToday ? 700 : 400 }}>
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Badges Earned ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ color: theme.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Badges Earned · {BADGES.filter(b => b.check(badgeData)).length}/{BADGES.length}
          </div>
          <button
            onClick={() => { setShowGuide(true); setGuideTab('badges'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.accent, fontSize: 12, fontWeight: 600, padding: 0 }}
          >
            See all →
          </button>
        </div>

        {(() => {
          const earned = BADGES.filter(b => b.check(badgeData));
          if (earned.length === 0) {
            return (
              <div style={{
                background: theme.bgCard, borderRadius: 16,
                border: `1px solid ${theme.bgCardBorder}`,
                padding: '32px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🏔️</div>
                <div style={{ color: theme.textPrimary, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  No badges yet
                </div>
                <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                  Keep journaling, hitting your goals, and building streaks.
                </div>
                <button
                  onClick={() => { setShowGuide(true); setGuideTab('badges'); }}
                  style={{ background: theme.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  📖 See What's Available
                </button>
              </div>
            );
          }
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {earned.map(badge => (
                <div key={badge.id} style={{
                  background: `${badge.color}0d`,
                  border: `1px solid ${badge.color}50`,
                  borderRadius: 14, padding: '16px 10px 12px', textAlign: 'center',
                  boxShadow: `0 4px 18px ${badge.color}22`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <BadgeMedal badge={badge} unlocked={true} size={68} />
                  </div>
                  <div style={{ color: theme.textPrimary, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
                    {badge.title}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Journey Guide Modal ──────────────────────────────────────────────── */}
      {showGuide && (
        <div
          onClick={() => setShowGuide(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '92%', maxWidth: 760,
              maxHeight: '88vh',
              background: theme.bgCard,
              borderRadius: 20,
              border: `1px solid ${theme.accent}40`,
              boxShadow: `0 8px 60px rgba(0,0,0,0.65), 0 0 40px ${theme.accent}12`,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* ── Guide header ── */}
            <div style={{
              padding: '18px 24px',
              borderBottom: `1px solid ${theme.bgCardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>📖</span>
                <div>
                  <div style={{ color: theme.textPrimary, fontWeight: 800, fontSize: 17 }}>Journey Guide</div>
                  <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 1 }}>Your complete reference for levels, points, and badges</div>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                style={{
                  background: theme.bgInput, border: 'none', borderRadius: 8,
                  width: 34, height: 34, cursor: 'pointer', color: theme.textMuted,
                  fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* ── Tab bar ── */}
            <div style={{
              display: 'flex',
              borderBottom: `1px solid ${theme.bgCardBorder}`,
              flexShrink: 0,
              background: theme.bgInput,
            }}>
              {(['levels', 'earn', 'badges'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setGuideTab(tab)}
                  style={{
                    flex: 1, padding: '13px 0',
                    background: guideTab === tab ? theme.bgCard : 'none',
                    border: 'none',
                    borderBottom: guideTab === tab ? `2px solid ${theme.accent}` : '2px solid transparent',
                    cursor: 'pointer',
                    color: guideTab === tab ? theme.accent : theme.textMuted,
                    fontWeight: guideTab === tab ? 700 : 500,
                    fontSize: 13,
                    letterSpacing: '0.02em',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'levels' ? '🏔️  Levels' : tab === 'earn' ? '⭐  How to Earn' : '🏅  All Badges'}
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <div style={{ overflow: 'auto', flex: 1, padding: '22px 24px' }}>

              {/* LEVELS TAB */}
              {guideTab === 'levels' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {LEVELS.map(l => {
                    const isCurrent = totalPts >= l.min && totalPts <= l.max;
                    const isUnlocked = totalPts >= l.min;
                    return (
                      <div key={l.level} style={{
                        background: isCurrent ? `${l.color}14` : (isUnlocked ? `${l.color}07` : theme.bgInput),
                        border: `1px solid ${isCurrent ? l.color + '55' : (isUnlocked ? l.color + '28' : theme.bgCardBorder)}`,
                        borderRadius: 14, padding: '14px 18px',
                        opacity: isUnlocked ? 1 : 0.5,
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                      }}>
                        {/* Emoji circle */}
                        <div style={{
                          width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
                          background: isUnlocked ? l.color + '22' : theme.bgCardBorder,
                          border: `2px solid ${isUnlocked ? l.color : theme.bgCardBorder}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22,
                        }}>
                          {l.emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                            <span style={{ color: theme.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                              Level {l.level}
                            </span>
                            <span style={{ color: isUnlocked ? l.color : theme.textMuted, fontSize: 15, fontWeight: 800 }}>
                              {l.title}
                            </span>
                            <span style={{ color: theme.textMuted, fontSize: 11 }}>
                              {l.max === Infinity ? `${l.min.toLocaleString()}+ pts` : `${l.min.toLocaleString()} – ${l.max.toLocaleString()} pts`}
                            </span>
                            {isCurrent && (
                              <span style={{
                                background: l.color, color: '#fff',
                                fontSize: 10, fontWeight: 700,
                                padding: '2px 9px', borderRadius: 20,
                              }}>
                                YOU ARE HERE
                              </span>
                            )}
                          </div>
                          <p style={{ color: theme.textSecondary, fontSize: 12.5, fontStyle: 'italic', margin: 0, lineHeight: 1.55 }}>
                            "{l.story}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* HOW TO EARN TAB */}
              {guideTab === 'earn' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {HOW_TO_EARN.map(section => (
                    <div key={section.category}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 3, height: 14, borderRadius: 2, background: section.color }} />
                        <span style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                          {section.category}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {section.items.map(item => (
                          <div key={item.label} style={{
                            background: theme.bgInput, borderRadius: 10,
                            padding: '11px 16px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <span style={{ color: theme.textPrimary, fontSize: 13 }}>{item.label}</span>
                            <span style={{ color: section.color, fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 12 }}>
                              {item.pts}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ background: theme.bgInput, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ color: theme.textMuted, fontSize: 12, lineHeight: 1.6 }}>
                      💡 <strong style={{ color: theme.textSecondary }}>Tips:</strong> Goal and milestone point values can be customized when you create them.
                      Streak bonuses are awarded automatically when you hit 7, 30, or 100 consecutive days on a goal.
                    </div>
                  </div>
                </div>
              )}

              {/* ALL BADGES TAB */}
              {guideTab === 'badges' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {(['Journey', 'Streaks', 'Challenges', 'Practice'] as const).map(cat => {
                    const catBadges = BADGES.filter(b => b.category === cat);
                    const catColor: Record<string, string> = {
                      Journey: '#f59e0b', Streaks: '#ef4444', Challenges: '#8b5cf6', Practice: '#10b981',
                    };
                    const colCount = cat === 'Journey' ? 4 : catBadges.length;
                    const unlockedCount = catBadges.filter(b => b.check(badgeData)).length;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 3, height: 14, borderRadius: 2, background: catColor[cat] }} />
                          <span style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                            {cat}
                          </span>
                          <span style={{ color: theme.textMuted, fontSize: 11 }}>
                            · {unlockedCount}/{catBadges.length} unlocked
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: 10 }}>
                          {catBadges.map(badge => {
                            const unlocked = badge.check(badgeData);
                            return (
                              <div key={badge.id} style={{
                                background: unlocked ? `${badge.color}0d` : theme.bgInput,
                                border: `1px solid ${unlocked ? badge.color + '50' : theme.bgCardBorder}`,
                                borderRadius: 14, padding: '14px 10px 12px', textAlign: 'center',
                                boxShadow: unlocked ? `0 4px 18px ${badge.color}22` : 'none',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                                  <BadgeMedal badge={badge} unlocked={unlocked} size={60} />
                                </div>
                                <div style={{ color: unlocked ? theme.textPrimary : theme.textMuted, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
                                  {badge.title}
                                </div>
                                <div style={{ color: theme.textMuted, fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>
                                  {badge.desc}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Recent activity ──────────────────────────────────────────────────── */}
      <div>
        <div style={{ color: theme.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Today &amp; Yesterday
        </div>
        {logs.length === 0 ? (
          <div style={{
            background: theme.bgCard, borderRadius: 12,
            border: `1px solid ${theme.bgCardBorder}`, padding: 32, textAlign: 'center',
          }}>
            <Star size={32} color={theme.textMuted} style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ color: theme.textMuted, margin: 0 }}>
              No points yet — start completing goals, logging gratitudes, and writing in your journal!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map(l => (
              <div key={l.id} style={{
                background: theme.bgCard, borderRadius: 10,
                border: `1px solid ${theme.bgCardBorder}`,
                padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: srcColor(l.source_type) + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {srcEmoji(l.source_type)}
                  </div>
                  <div>
                    <div style={{ color: theme.textPrimary, fontSize: 13, fontWeight: 600 }}>{l.reason}</div>
                    <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }}>
                      {fmtDate(l.entry_date)}
                    </div>
                  </div>
                </div>
                <div style={{
                  background: '#10b98118', color: '#10b981',
                  borderRadius: 8, padding: '4px 12px', fontWeight: 800, fontSize: 14,
                }}>
                  +{l.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
