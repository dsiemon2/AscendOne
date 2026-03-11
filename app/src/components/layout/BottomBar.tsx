import { useEffect, useState } from "react";
import { Star, Flame, Trophy, Mail, Award } from "lucide-react";
import { getDb } from "../../db/database";
import { useThemeStore } from "../../store/themeStore";
import { useAppStore } from "../../store/appStore";
import { getLocalDateString } from "../../utils/dateUtils";

interface CompletedChallenge {
  id: number;
  challenge_id: string;
  completed_at: string;
}

interface FutureLetter {
  id: number;
  unlock_date: string;
  opened_at: string | null;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default function BottomBar() {
  const { theme } = useThemeStore();
  const { todayPoints, setCurrentPage } = useAppStore();
  const [streak, setStreak] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [futureLetter, setFutureLetter] = useState<FutureLetter | null>(null);
  const [expanded, setExpanded] = useState<"challenges" | "badges" | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const db = await getDb();

      // Streak — count consecutive days with journal entries
      const entries = await db.select<{ entry_date: string }[]>(
        `SELECT DISTINCT entry_date FROM journal_entries ORDER BY entry_date DESC LIMIT 365`
      );
      let s = 0;
      const today = getLocalDateString();
      for (let i = 0; i < entries.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const exp = expected.toISOString().split("T")[0];
        if (entries[i]?.entry_date === exp) s++;
        else break;
      }
      setStreak(s);

      // Completed challenges
      const challenges = await db.select<CompletedChallenge[]>(
        `SELECT id, challenge_id, completed_at FROM challenge_enrollments WHERE completed_at IS NOT NULL ORDER BY completed_at DESC`
      );
      setCompletedChallenges(challenges);

      // Future letter
      const letters = await db.select<FutureLetter[]>(
        `SELECT id, unlock_date, opened_at FROM future_letters ORDER BY id DESC LIMIT 1`
      );
      setFutureLetter(letters[0] ?? null);
    } catch { /* silent */ }
  }

  const letterDays   = futureLetter ? daysUntil(futureLetter.unlock_date) : null;
  const letterReady  = letterDays === 0 && futureLetter && !futureLetter.opened_at;

  const pill = (bg: string, border: string) => ({
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 5,
    padding: "4px 10px",
    borderRadius: 20,
    background: bg,
    border: `1px solid ${border}`,
    cursor: "default" as const,
    flexShrink: 0 as const,
  });

  return (
    <>
      {/* ── Pop-up panels ── */}
      {expanded && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setExpanded(null)}
            style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.3)" }}
          />
          <div style={{
            position: "fixed", bottom: 52, left: "50%", transform: "translateX(-50%)",
            zIndex: 96,
            background: theme.bgCard,
            border: `1px solid ${theme.bgCardBorder}`,
            borderRadius: 14,
            padding: 16,
            minWidth: 280,
            maxWidth: 420,
            boxShadow: "0 -4px 32px rgba(0,0,0,0.4)",
          }}>
            {expanded === "challenges" && (
              <>
                <p style={{ color: theme.textSecondary, fontWeight: 700, fontSize: 13, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  🏆 Completed Challenges
                </p>
                {completedChallenges.length === 0 ? (
                  <p style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                    No completed challenges yet.<br />Start your first one!
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {completedChallenges.map(c => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: theme.bgInput }}>
                        <Trophy size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: theme.textPrimary, fontSize: 13, fontWeight: 600 }}>
                            {c.challenge_id === "30day_ascend" ? "30-Day Ascend Challenge" : c.challenge_id}
                          </div>
                          <div style={{ color: theme.textMuted, fontSize: 11 }}>
                            Completed {new Date(c.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                        <span style={{ fontSize: 18 }}>🏅</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {expanded === "badges" && (
              <>
                <p style={{ color: theme.textSecondary, fontWeight: 700, fontSize: 13, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  🎖️ Badges
                </p>
                <p style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                  Visit Points & Badges to see all your achievements.
                </p>
                <button
                  onClick={() => { setCurrentPage("points"); setExpanded(null); }}
                  style={{ width: "100%", padding: "8px 0", background: theme.accentGradient, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                >
                  View All Badges →
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Bottom bar ── */}
      <div style={{
        height: 44,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px",
        background: theme.bgCard,
        borderTop: `1px solid ${theme.bgCardBorder}`,
        flexShrink: 0,
        zIndex: 50,
        overflowX: "auto",
      }}>

        {/* Streak */}
        <div style={pill(`${streak > 0 ? "#ef444420" : theme.bgInput}`, streak > 0 ? "#ef4444" : theme.bgCardBorder)}>
          <Flame size={13} style={{ color: streak > 0 ? "#ef4444" : theme.textMuted }} />
          <span style={{ color: streak > 0 ? "#ef4444" : theme.textMuted, fontSize: 12, fontWeight: 700 }}>
            {streak} day{streak !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Today's points */}
        <div style={pill(`${theme.accentLight}`, theme.bgCardBorder)}>
          <Star size={12} style={{ color: theme.accent }} fill={theme.accent} />
          <span style={{ color: theme.textPrimary, fontSize: 12, fontWeight: 700 }}>
            {todayPoints} pts today
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Future letter */}
        {futureLetter && (
          <button
            onClick={() => setCurrentPage("challenges")}
            style={{
              ...pill(
                letterReady ? "#10b98120" : theme.bgInput,
                letterReady ? "#10b981" : theme.bgCardBorder
              ),
              cursor: "pointer",
              border: `1px solid ${letterReady ? "#10b981" : theme.bgCardBorder}`,
            }}
            title={letterReady ? "Your letter to the future is ready to open!" : `Letter to Future Self unlocks in ${letterDays} days`}
          >
            <Mail size={13} style={{ color: letterReady ? "#10b981" : theme.textMuted }} />
            <span style={{ color: letterReady ? "#10b981" : theme.textMuted, fontSize: 12, fontWeight: 600 }}>
              {letterReady ? "✨ Open your letter!" : `${letterDays}d`}
            </span>
          </button>
        )}

        {/* Completed challenges */}
        <button
          onClick={() => setExpanded(prev => prev === "challenges" ? null : "challenges")}
          style={{
            ...pill(expanded === "challenges" ? theme.accentLight : theme.bgInput, expanded === "challenges" ? theme.accent : theme.bgCardBorder),
            cursor: "pointer",
          }}
          title="Completed challenges"
        >
          <Trophy size={13} style={{ color: completedChallenges.length > 0 ? "#f59e0b" : theme.textMuted }} />
          <span style={{ color: completedChallenges.length > 0 ? theme.textPrimary : theme.textMuted, fontSize: 12, fontWeight: 600 }}>
            {completedChallenges.length}
          </span>
        </button>

        {/* Badges shortcut */}
        <button
          onClick={() => setExpanded(prev => prev === "badges" ? null : "badges")}
          style={{
            ...pill(expanded === "badges" ? theme.accentLight : theme.bgInput, expanded === "badges" ? theme.accent : theme.bgCardBorder),
            cursor: "pointer",
          }}
          title="Badges"
        >
          <Award size={13} style={{ color: theme.textMuted }} />
        </button>

      </div>
    </>
  );
}
