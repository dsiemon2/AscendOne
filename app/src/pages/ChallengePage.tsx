import { useState, useEffect, useCallback } from "react";
import {
  Trophy, Flame, Lock, BookOpen, Star, CheckCircle2,
  ChevronRight, RotateCcw, Send, Eye, Clock, Plus,
  Sparkles, Target, Zap,
} from "lucide-react";
import { useThemeStore } from "../store/themeStore";
import { useAppStore } from "../store/appStore";
import { getDb } from "../db/database";
import { getLocalDateString } from "../utils/dateUtils";

// ─── Challenge Days ───────────────────────────────────────────────────────────
const CHALLENGE_DAYS: { day: number; title: string; prompt: string | string[]; tag: string }[] = [
  { day: 1,  tag: "Vision",        title: "Define Your Life Vision",
    prompt: "Paint a vivid picture of the life you want to create. What does your ideal life look like? Describe it in detail — where you live, what you do every day, how you feel, who surrounds you, what you've achieved. The clearer your vision, the more powerfully it will guide you." },
  { day: 2,  tag: "Goals",         title: "Your Top 5 One-Year Goals",
    prompt: "What are the 5 most important goals you want to achieve in the next 12 months? Write each one clearly and specifically. For each goal, explain WHY it matters to you and what achieving it will mean for your life." },
  { day: 3,  tag: "Freedom",       title: "No Limits",
    prompt: "If time and money were not an issue, what would you want to experience in life? Dream without boundaries. Where would you go? What would you do? What would you create? Who would you become? Write freely — no limits allowed." },
  { day: 4,  tag: "Pride",         title: "Your Greatest Accomplishment",
    prompt: "Looking back at your life to this point, what is your biggest accomplishment? What are you most proud of? Why does this mean so much to you? Describe it fully and let yourself feel the pride you deserve." },
  { day: 5,  tag: "Goals",         title: "Your 60-Day Goals",
    prompt: "What are two specific, meaningful goals you want to achieve in the next 60 days? Make them concrete and actionable — not vague wishes. What exactly will you do? How will you know when you've achieved them? What will it mean when you do?" },
  { day: 6,  tag: "Affirmations",  title: "Write Your Own Affirmations",
    prompt: "Write 5–10 powerful affirmations that are personal to YOU — your goals, your identity, your desires. Affirmations are positive, present-tense statements written as if they are already true.\n\nExamples to inspire you:\n• \"I am confident, capable, and worthy of everything I desire.\"\n• \"I attract abundance, opportunity, and the right people into my life.\"\n• \"I am becoming the best version of myself every single day.\"\n\nNow write yours — make them specific to your life and say them like you mean them." },
  { day: 7,  tag: "Happiness",     title: "What Makes You Happy?",
    prompt: "What are you happy about in your life right now? List as many things as you can — big and small. Then, for each one, dig deeper: What specifically about it makes you happy? How does it make you feel? Why does it matter to you?" },
  { day: 8,  tag: "Gratitude",     title: "Gratitude Deep Dive",
    prompt: "What are you most grateful for in your life right now? Go beyond the surface — don't just list things, really feel them. For each one you write about, describe what it means to you and how your life would be different without it." },
  { day: 9,  tag: "Passion",       title: "What Are You Most Passionate About?",
    prompt: "What are you most passionate about right now? What lights you up inside? What could you talk about for hours? How is this passion showing up — or NOT showing up — in your daily life? What would change if you gave it more space?" },
  { day: 10, tag: "Success",       title: "What Does a Successful Life Look Like?",
    prompt: "What does a successful life look like for YOU? Not society's definition, not your parents' version — YOURS. Be specific. What does success mean across all areas: career, relationships, health, finances, personal growth, and happiness?" },
  { day: 11, tag: "Vision",        title: "Where Do You See Yourself in 5 Years?",
    prompt: "Describe your life in vivid detail exactly 5 years from today. Where are you living? What are you doing for work? What do your relationships look like? What have you achieved? Who have you become? Write it as if it's already real." },
  { day: 12, tag: "Wisdom",        title: "Create Your Own Original Quote",
    prompt: "If you were to be quoted for saying something inspirational or positive, what would you say? Create your own original quote — something that reflects YOUR philosophy, your values, and the wisdom you've gained from your life. Make it something worth putting on a wall." },
  { day: 13, tag: "Strengths",     title: "What Is Your Best Quality?",
    prompt: "What is your best quality? What makes you uniquely YOU? Describe it honestly and fully — give real examples of how it shows up in your life, how it has helped you and the people around you, and how you want to use it even more going forward." },
  { day: 14, tag: "Favorites",     title: "Your Favorite Quote & Affirmation",
    prompt: "What is your all-time favorite quote? What is your favorite affirmation? Write both of them down, then go deeper: What does each one mean to you personally? Why does it resonate so strongly? How has it influenced the way you think or live?" },
  { day: 15, tag: "Purpose",       title: "🎉 Day 15 — Mission & Vision Statements",
    prompt: ["Write your personal MISSION STATEMENT — your purpose, what you stand for, and how you commit to showing up in the world every day. Keep it clear and powerful. (2–4 sentences)\n\nExample: \"My mission is to live with intention, inspire the people around me, and continuously grow into the best version of myself while creating a life full of meaning, love, and abundance.\"",
             "Write your personal VISION STATEMENT — the future you are actively building. Write it in vivid, inspiring language as if it has already come true. (3–5 sentences)\n\nExample: \"I am living a life of complete freedom and fulfillment. I wake up every morning energized and purposeful, surrounded by people I love and work that lights me up. I have built financial abundance while making a real difference in the world.\""] },
  { day: 16, tag: "Mindset",       title: "What Limiting Beliefs Hold You Back?",
    prompt: "What limiting beliefs have been holding you back from what you truly want? Name them honestly — the stories you tell yourself about why you can't, shouldn't, or won't. Where did each one come from? And what powerful, empowering belief could you choose to replace it with?" },
  { day: 17, tag: "Courage",       title: "What Would You Attempt If You Could Not Fail?",
    prompt: "What would you attempt if you knew — with absolute certainty — that you could NOT fail? What would you pursue with everything you have? Write about it fully. Then ask yourself: what's actually stopping you from going after it right now?" },
  { day: 18, tag: "Growth",        title: "Skills & Talents You Want to Develop",
    prompt: "What skills or talents do you want to develop in the next year? Why do these matter to you? What doors would they open? What would your life look like if you committed to mastering them? Write a vision for who you become through this growth." },
  { day: 19, tag: "Lifestyle",     title: "Your Ideal Daily Routine",
    prompt: "Describe your ideal daily routine from the moment you wake up to the moment you fall asleep. What does a perfect, productive, fulfilling day look like for you? What habits, rituals, and practices does it include? How does it make you feel?" },
  { day: 20, tag: "Relationships", title: "Relationships You're Grateful For",
    prompt: "What relationships in your life are you most grateful for, and why? Who has made the biggest impact on who you are? What makes each relationship special and irreplaceable? What do you want to nurture, strengthen, or create in your relationships going forward?" },
  { day: 21, tag: "Courage",       title: "Fears — Overcome & Still to Conquer",
    prompt: "What fear have you already overcome that you're proud of? How did you do it and what did it teach you? Now — what fear do you still want to conquer? What would your life look, feel, and be like on the other side of that fear?" },
  { day: 22, tag: "Reflection",    title: "A Letter to Your Younger Self",
    prompt: "Write a heartfelt letter to your younger self. What wisdom, encouragement, or truth would you share? What do you wish you had known sooner? What would you tell them about the hard times ahead — and the good ones? Write it with love." },
  { day: 23, tag: "Abundance",     title: "What Does Financial Freedom Mean to You?",
    prompt: "What does financial freedom look like for YOU specifically? Not a number — describe the feeling, the lifestyle, the choices it gives you. How would your life be different? What would you do, give, experience, and become with that freedom?" },
  { day: 24, tag: "Dreams",        title: "Your Biggest Dream",
    prompt: "What is your biggest dream — the one that excites you and maybe even scares you a little? Write about it in full. Then identify ONE concrete step you could take today — right now — to start moving toward it. What's that first step?" },
  { day: 25, tag: "Legacy",        title: "What Do You Want Your Legacy to Be?",
    prompt: "What do you want your legacy to be? How do you want to be remembered — by your family, your friends, your community, the world? When you're gone, what do you want people to say about the life you lived and the person you were?" },
  { day: 26, tag: "Habits",        title: "Habits to Break & Habits to Build",
    prompt: "What bad habits do you want to break? What good habits do you want to build? For each habit you want to build, paint a picture of what your life looks, feels, and IS like once that habit is fully part of who you are." },
  { day: 27, tag: "Perspective",   title: "If You Had 90 Days Left to Live",
    prompt: "If you had 90 days left to live, what would you do? Who would you spend your time with? What would you say to the people you love? What would you finally stop worrying about? Let this reflection strip away everything that doesn't truly matter — and reveal what does." },
  { day: 28, tag: "Self-Love",     title: "10 Things You Love About Yourself",
    prompt: "Write 10 things you genuinely love about yourself. Not things you wish were true — things that actually ARE true about you right now. Be honest. Be specific. Be kind to yourself. You deserve to see how remarkable you truly are." },
  { day: 29, tag: "Happiness",     title: "Your Personal Definition of Happiness",
    prompt: "What is your personal definition of happiness? Not what it looks like to others — what it genuinely means to YOU. Are you living it right now? If yes, what is creating it? If not, what would need to change for you to truly live a happy life?" },
  { day: 30, tag: "Celebration",   title: "🎉 30-Day Reflection",
    prompt: "You did it — 30 days of showing up for yourself! How has this challenge changed the way you see yourself and your future? What insights have you gained? What truths have you uncovered? What commitments are you making going forward? Write your final reflection — this is your graduation." },
];

// ─── Tag colors ───────────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  Vision: "#6366f1", Goals: "#10b981", Freedom: "#ec4899", Pride: "#f59e0b",
  Affirmations: "#8b5cf6", Happiness: "#f59e0b", Gratitude: "#10b981", Passion: "#ef4444",
  Success: "#3b82f6", Wisdom: "#8b5cf6", Strengths: "#3b82f6", Favorites: "#a78bfa",
  Purpose: "#6366f1", Mindset: "#f59e0b", Courage: "#ef4444", Growth: "#10b981",
  Lifestyle: "#3b82f6", Relationships: "#ec4899", Reflection: "#6366f1", Abundance: "#10b981",
  Dreams: "#8b5cf6", Legacy: "#6366f1", Habits: "#f59e0b", Perspective: "#ef4444",
  "Self-Love": "#ec4899", Celebration: "#f59e0b",
};

// ─── DB types ─────────────────────────────────────────────────────────────────
interface Enrollment {
  id: number;
  challenge_id: string;
  started_at: string;
  deadline_date: string;
  completed_at: string | null;
  failed_at: string | null;
  points_awarded: number;
}

interface ChallengeResponse {
  id: number;
  enrollment_id: number;
  day_number: number;
  response_text: string;
  completed_at: string;
}

interface FutureLetter {
  id: number;
  content: string;
  written_at: string;
  unlock_date: string;
  opened_at: string | null;
  points_awarded: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChallengePage() {
  const { theme } = useThemeStore();
  const { addTodayPoints } = useAppStore();

  // ── Challenge state ──
  const [enrollment, setEnrollment]     = useState<Enrollment | null>(null);
  const [responses, setResponses]       = useState<ChallengeResponse[]>([]);
  const [activeDay, setActiveDay]       = useState<number | null>(null);
  const [draftText, setDraftText]       = useState("");
  const [draftText2, setDraftText2]     = useState(""); // Day 15 second textarea
  const [saving, setSaving]             = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<"none" | "active" | "completed" | "failed">("none");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Letter state ──
  const [letters, setLetters]           = useState<FutureLetter[]>([]);
  const [activeLetter, setActiveLetter] = useState<FutureLetter | null>(null);
  const [showWriteLetter, setShowWriteLetter] = useState(false);
  const [letterDraft, setLetterDraft]   = useState("");
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockLetter, setUnlockLetter] = useState<FutureLetter | null>(null);
  const [savingLetter, setSavingLetter] = useState(false);

  // ─── Load data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const db = await getDb();
    const today = getLocalDateString();

    // Load latest enrollment
    const enrRows = await db.select<Enrollment[]>(
      `SELECT * FROM challenge_enrollments WHERE challenge_id='30day_ascend' ORDER BY id DESC LIMIT 1`
    );
    const enr = enrRows[0] ?? null;
    setEnrollment(enr);

    if (enr) {
      // Determine status
      if (enr.completed_at) {
        setChallengeStatus("completed");
      } else if (enr.failed_at || today > enr.deadline_date) {
        setChallengeStatus("failed");
        if (!enr.failed_at) {
          // Mark as failed now
          await db.execute(`UPDATE challenge_enrollments SET failed_at=? WHERE id=?`, [today, enr.id]);
        }
      } else {
        setChallengeStatus("active");
      }

      // Load responses
      const respRows = await db.select<ChallengeResponse[]>(
        `SELECT * FROM challenge_responses WHERE enrollment_id=? ORDER BY day_number`,
        [enr.id]
      );
      setResponses(respRows);
    } else {
      setChallengeStatus("none");
      setResponses([]);
    }

    // Load letters
    const letterRows = await db.select<FutureLetter[]>(
      `SELECT * FROM future_letters ORDER BY id DESC`
    );
    setLetters(letterRows);

    // Check for newly unlocked letters (unlock_date <= today and not opened yet)
    const unread = letterRows.find(l => !l.opened_at && l.unlock_date <= today);
    if (unread) {
      setUnlockLetter(unread);
      setShowUnlockModal(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Challenge helpers ────────────────────────────────────────────────────────
  function getDaysCompleted(): number[] {
    return responses.map(r => r.day_number);
  }

  function getNextDay(): number {
    const done = getDaysCompleted();
    for (let d = 1; d <= 30; d++) {
      if (!done.includes(d)) return d;
    }
    return 31; // all done
  }

  function isDayUnlocked(dayNum: number): boolean {
    if (challengeStatus !== "active" || !enrollment) return false;
    const start = new Date(enrollment.started_at.slice(0, 10) + "T00:00:00");
    const todayDate = new Date(getLocalDateString() + "T00:00:00");
    const daysSinceStart = Math.floor((todayDate.getTime() - start.getTime()) / 86400000);
    // Day N unlocks after N-1 days have elapsed (day 1 = day 0, day 2 = day 1, …)
    return daysSinceStart >= dayNum - 1;
  }

  function getDayUnlockDate(dayNum: number): string {
    if (!enrollment) return "";
    const start = new Date(enrollment.started_at.slice(0, 10) + "T00:00:00");
    start.setDate(start.getDate() + dayNum - 1);
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function isDayDone(dayNum: number): boolean {
    return getDaysCompleted().includes(dayNum);
  }

  function getDaysRemaining(): number {
    if (!enrollment) return 0;
    const today = getLocalDateString();
    const deadline = new Date(enrollment.deadline_date + "T23:59:59");
    const now = new Date(today + "T00:00:00");
    return Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 86400000));
  }

  // ─── Start challenge ─────────────────────────────────────────────────────────
  async function startChallenge() {
    const db = await getDb();
    const today = getLocalDateString();
    const deadline = new Date(today + "T00:00:00");
    deadline.setDate(deadline.getDate() + 33); // 34-day window: day 30 unlocks on day 29, +4 buffer days
    const deadlineStr = deadline.toISOString().slice(0, 10);

    await db.execute(
      `INSERT INTO challenge_enrollments (challenge_id, started_at, deadline_date) VALUES ('30day_ascend', ?, ?)`,
      [today, deadlineStr]
    );
    await loadData();
  }

  // ─── Open day for writing or reading ─────────────────────────────────────────
  function openDay(dayNum: number) {
    if (!isDayUnlocked(dayNum) && !isDayDone(dayNum)) return;
    const existing = responses.find(r => r.day_number === dayNum);
    if (dayNum === 15 && existing) {
      const parts = existing.response_text.split("\n\n<<VISION>>\n\n");
      setDraftText(parts[0] ?? "");
      setDraftText2(parts[1] ?? "");
    } else {
      setDraftText(existing?.response_text ?? "");
      setDraftText2("");
    }
    setActiveDay(dayNum);
  }

  // ─── Save response ────────────────────────────────────────────────────────────
  async function saveResponse() {
    if (!enrollment || activeDay === null) return;
    const text = activeDay === 15
      ? `${draftText.trim()}\n\n<<VISION>>\n\n${draftText2.trim()}`
      : draftText.trim();
    if (!text || text.replace(/\n\n<<VISION>>\n\n/, "").trim().length < 10) return;

    setSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const existing = responses.find(r => r.day_number === activeDay);
      if (existing) {
        await db.execute(
          `UPDATE challenge_responses SET response_text=?, completed_at=? WHERE id=?`,
          [text, now, existing.id]
        );
      } else {
        await db.execute(
          `INSERT INTO challenge_responses (enrollment_id, day_number, response_text, completed_at) VALUES (?,?,?,?)`,
          [enrollment.id, activeDay, text, now]
        );
      }

      // Check if all 30 days done now
      const allDone = await db.select<[{ c: number }]>(
        `SELECT COUNT(*) as c FROM challenge_responses WHERE enrollment_id=?`,
        [enrollment.id]
      );
      const totalDone = allDone[0].c;

      if (totalDone >= 30) {
        // Complete the challenge!
        const today = getLocalDateString();
        await db.execute(
          `UPDATE challenge_enrollments SET completed_at=?, points_awarded=500 WHERE id=?`,
          [today, enrollment.id]
        );
        await db.execute(
          `INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (500, '🏆 Completed the 30-Day Ascend Challenge!', 'challenge', ?, ?)`,
          [enrollment.id, today]
        );
        addTodayPoints(500);
      }

      setActiveDay(null);
      setDraftText("");
      setDraftText2("");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  // ─── Reset / retry challenge ──────────────────────────────────────────────────
  async function retryChallenge() {
    // Delete current enrollment + all its responses for a true clean reset
    const db = await getDb();
    if (enrollment) {
      await db.execute(`DELETE FROM challenge_responses WHERE enrollment_id=?`, [enrollment.id]);
      await db.execute(`DELETE FROM challenge_enrollments WHERE id=?`, [enrollment.id]);
    }
    setShowResetConfirm(false);
    await startChallenge();
  }

  // ─── Letter helpers ───────────────────────────────────────────────────────────
  function getActiveLetter(): FutureLetter | null {
    // The most recent letter that hasn't been opened yet
    return letters.find(l => !l.opened_at) ?? null;
  }

  async function saveLetter() {
    if (!letterDraft.trim() || letterDraft.trim().length < 20) return;
    setSavingLetter(true);
    try {
      const db = await getDb();
      const today = getLocalDateString();
      const writtenAt = new Date().toISOString();
      // Unlock date: exactly 365 days from today
      const unlockDate = new Date(today + "T00:00:00");
      unlockDate.setFullYear(unlockDate.getFullYear() + 1);
      const unlockDateStr = unlockDate.toISOString().slice(0, 10);

      await db.execute(
        `INSERT INTO future_letters (content, written_at, unlock_date, points_awarded) VALUES (?,?,?,75)`,
        [letterDraft.trim(), writtenAt, unlockDateStr]
      );

      // Award 75 points for writing
      await db.execute(
        `INSERT INTO points_log (points, reason, source_type, entry_date) VALUES (75, '✉️ Wrote a Letter to My Future Self', 'future_letter', ?)`,
        [today]
      );
      addTodayPoints(75);

      setLetterDraft("");
      setShowWriteLetter(false);
      await loadData();
    } finally {
      setSavingLetter(false);
    }
  }

  async function readLetter(letter: FutureLetter) {
    setActiveLetter(letter);
    if (!letter.opened_at) {
      const db = await getDb();
      const today = getLocalDateString();
      const now = new Date().toISOString();
      await db.execute(`UPDATE future_letters SET opened_at=? WHERE id=?`, [now, letter.id]);
      // Award 75 points for reading
      await db.execute(
        `INSERT INTO points_log (points, reason, source_type, source_id, entry_date) VALUES (75, '📬 Read my Letter to Future Self', 'future_letter', ?, ?)`,
        [letter.id, today]
      );
      addTodayPoints(75);
      await loadData();
    }
  }

  async function closeUnlockModal() {
    if (unlockLetter) {
      await readLetter(unlockLetter);
    }
    setShowUnlockModal(false);
    setUnlockLetter(null);
  }

  // ─── Computed ─────────────────────────────────────────────────────────────────
  const completedDays = getDaysCompleted();
  const nextDay = getNextDay();
  const daysRemaining = getDaysRemaining();
  const pendingLetter = getActiveLetter();
  const today = getLocalDateString();
  const hasBanner = pendingLetter && pendingLetter.unlock_date <= today && !pendingLetter.opened_at;

  // ─── Section: Active day prompt ───────────────────────────────────────────────
  if (activeDay !== null) {
    const dayInfo = CHALLENGE_DAYS[activeDay - 1];
    const tagColor = TAG_COLORS[dayInfo.tag] ?? "#6366f1";
    const isDay15 = activeDay === 15;
    const prompts = Array.isArray(dayInfo.prompt) ? dayInfo.prompt : [dayInfo.prompt];
    const isReadOnly = isDayDone(activeDay);

    return (
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Back breadcrumb */}
        <button
          onClick={() => { setActiveDay(null); setDraftText(""); setDraftText2(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: theme.textMuted, fontSize: "0.82rem", marginBottom: 24, padding: 0,
          }}
        >
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
          Back to Challenge
        </button>

        {/* Day header */}
        <div style={{
          background: theme.bgCard, borderRadius: 16, padding: "28px 32px",
          border: `1px solid ${theme.bgCardBorder}`, marginBottom: 20,
          borderTop: `4px solid ${tagColor}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              background: tagColor + "22", color: tagColor, borderRadius: 8,
              padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
            }}>
              DAY {activeDay} · {dayInfo.tag.toUpperCase()}
            </div>
          </div>
          <h2 style={{ color: theme.textPrimary, fontSize: "1.4rem", fontWeight: 800, margin: "0 0 20px" }}>
            {dayInfo.title}
          </h2>

          {prompts.map((p, i) => (
            <div key={i} style={{
              background: tagColor + "11", borderRadius: 12, padding: "16px 20px",
              marginBottom: i < prompts.length - 1 ? 12 : 0,
            }}>
              {isDay15 && (
                <div style={{ color: tagColor, fontWeight: 700, fontSize: "0.78rem", marginBottom: 6 }}>
                  {i === 0 ? "✍️ MISSION STATEMENT" : "🌅 VISION STATEMENT"}
                </div>
              )}
              <p style={{ color: theme.textSecondary, fontSize: "0.92rem", lineHeight: 1.65, margin: 0 }}>
                {p}
              </p>
            </div>
          ))}
        </div>

        {/* Response area */}
        {isReadOnly ? (
          // ── Read-only view for completed days ──
          <div style={{
            background: theme.bgCard, borderRadius: 12, padding: "20px 22px",
            border: `1px solid ${tagColor}33`, marginBottom: 12,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
              color: tagColor, fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em",
            }}>
              <CheckCircle2 size={14} /> YOUR RESPONSE
            </div>
            {isDay15 ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: theme.textMuted, fontSize: "0.74rem", fontWeight: 700, marginBottom: 6, letterSpacing: "0.04em" }}>✍️ MISSION STATEMENT</div>
                  <p style={{ color: theme.textPrimary, fontSize: "0.92rem", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{draftText}</p>
                </div>
                <div>
                  <div style={{ color: theme.textMuted, fontSize: "0.74rem", fontWeight: 700, marginBottom: 6, letterSpacing: "0.04em" }}>🌅 VISION STATEMENT</div>
                  <p style={{ color: theme.textPrimary, fontSize: "0.92rem", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{draftText2}</p>
                </div>
              </>
            ) : (
              <p style={{ color: theme.textPrimary, fontSize: "0.92rem", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{draftText}</p>
            )}
          </div>
        ) : isDay15 ? (
          // ── Editable Day 15 ──
          <>
            <textarea
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              placeholder="Your Mission Statement..."
              style={{
                width: "100%", minHeight: 140, borderRadius: 12, padding: "16px 18px",
                background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`,
                color: theme.textPrimary, fontSize: "0.9rem", lineHeight: 1.6,
                resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 12,
                fontFamily: "inherit",
              }}
            />
            <textarea
              value={draftText2}
              onChange={e => setDraftText2(e.target.value)}
              placeholder="Your Vision Statement..."
              style={{
                width: "100%", minHeight: 140, borderRadius: 12, padding: "16px 18px",
                background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`,
                color: theme.textPrimary, fontSize: "0.9rem", lineHeight: 1.6,
                resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 12,
                fontFamily: "inherit",
              }}
            />
          </>
        ) : (
          // ── Editable standard day ──
          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            placeholder="Write your response here — be honest, be bold, be you..."
            style={{
              width: "100%", minHeight: 260, borderRadius: 12, padding: "16px 18px",
              background: theme.bgCard, border: `1px solid ${theme.bgCardBorder}`,
              color: theme.textPrimary, fontSize: "0.9rem", lineHeight: 1.6,
              resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 12,
              fontFamily: "inherit",
            }}
          />
        )}

        {isReadOnly ? (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => { setActiveDay(null); setDraftText(""); setDraftText2(""); }}
              style={{
                padding: "10px 24px", borderRadius: 10, border: `1px solid ${theme.bgCardBorder}`,
                background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: "0.85rem",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => { setActiveDay(null); setDraftText(""); setDraftText2(""); }}
              style={{
                padding: "10px 20px", borderRadius: 10, border: `1px solid ${theme.bgCardBorder}`,
                background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: "0.85rem",
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveResponse}
              disabled={saving || (!draftText.trim() && !draftText2.trim())}
              style={{
                padding: "10px 24px", borderRadius: 10, border: "none",
                background: tagColor, color: "#fff", cursor: "pointer",
                fontSize: "0.85rem", fontWeight: 700,
                display: "flex", alignItems: "center", gap: 8,
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Send size={15} />
              {saving ? "Saving…" : nextDay === 30 && activeDay === 30 ? "Complete Challenge 🏆" : "Save Response"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Section: Read active letter ──────────────────────────────────────────────
  if (activeLetter) {
    const daysLeft = Math.round((new Date(activeLetter.unlock_date + "T00:00:00").getTime() - Date.now()) / 86400000);
    const isLocked = activeLetter.unlock_date > today;

    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button
          onClick={() => setActiveLetter(null)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: theme.textMuted, fontSize: "0.82rem", marginBottom: 24, padding: 0,
          }}
        >
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
          Back
        </button>

        {isLocked ? (
          <div style={{
            background: theme.bgCard, borderRadius: 16, padding: "60px 32px",
            border: `1px solid ${theme.bgCardBorder}`, textAlign: "center",
          }}>
            <Lock size={48} style={{ color: theme.textMuted, marginBottom: 20 }} />
            <h2 style={{ color: theme.textPrimary, fontSize: "1.3rem", fontWeight: 800, margin: "0 0 10px" }}>
              Future Letter To Myself
            </h2>
            <p style={{ color: theme.textMuted, margin: "0 0 8px" }}>
              Written on {new Date(activeLetter.written_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p style={{ color: theme.accent, fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>
              Unlocks in {daysLeft} days · {new Date(activeLetter.unlock_date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        ) : (
          <div style={{
            background: theme.bgCard, borderRadius: 16, padding: "32px",
            border: `1px solid ${theme.bgCardBorder}`, borderTop: `4px solid ${theme.accent}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <BookOpen size={20} style={{ color: theme.accent }} />
              <span style={{ color: theme.accent, fontWeight: 700 }}>Letter to My Future Self</span>
              {!activeLetter.opened_at && (
                <span style={{ background: "#10b98122", color: "#10b981", borderRadius: 6, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
                  +50 pts for reading!
                </span>
              )}
            </div>
            <p style={{ color: theme.textMuted, fontSize: "0.8rem", marginBottom: 24 }}>
              Written on {new Date(activeLetter.written_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <div style={{
              whiteSpace: "pre-wrap", color: theme.textPrimary, fontSize: "0.95rem",
              lineHeight: 1.75, fontFamily: "Georgia, serif",
            }}>
              {activeLetter.content}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Main page ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: theme.textPrimary, fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px" }}>
          Challenges
        </h1>
        <p style={{ color: theme.textMuted, margin: 0, fontSize: "0.9rem" }}>
          Push your limits. Discover yourself. Ascend.
        </p>
      </div>

      {/* ── Unlock banner ── */}
      {hasBanner && !showUnlockModal && (
        <div
          onClick={() => { setUnlockLetter(pendingLetter); setShowUnlockModal(true); }}
          style={{
            background: "linear-gradient(135deg, #f59e0b22, #8b5cf622)",
            border: "1px solid #f59e0b55", borderRadius: 14, padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
            cursor: "pointer", transition: "opacity 0.15s",
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>📬</span>
          <div>
            <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: "0.9rem" }}>
              Your Letter to Future Self has unlocked!
            </div>
            <div style={{ color: theme.textMuted, fontSize: "0.8rem" }}>
              Click to open and read what you wrote a year ago.
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "#f59e0b", marginLeft: "auto" }} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  30-DAY ASCEND CHALLENGE                                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div style={{
        background: theme.bgCard, borderRadius: 20, border: `1px solid ${theme.bgCardBorder}`,
        overflow: "hidden", marginBottom: 28,
      }}>
        {/* Challenge header band */}
        <div style={{
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          padding: "24px 28px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Trophy size={24} style={{ color: "#fff" }} />
                <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.25rem" }}>
                  30-Day Ascend Challenge
                </span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: 0, fontSize: "0.88rem", maxWidth: 440 }}>
                30 days. 30 powerful reflection prompts. Complete all before the deadline for a badge and 100 points.
              </p>
            </div>
            {challengeStatus === "active" && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.6rem", lineHeight: 1 }}>
                  {completedDays.length}/30
                </div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem" }}>days done</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", marginTop: 4 }}>
                  {daysRemaining} days left
                </div>
              </div>
            )}
            {challengeStatus === "completed" && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "2rem" }}>🏆</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>Completed!</div>
              </div>
            )}
          </div>

          {challengeStatus === "active" && (
            <div style={{ marginTop: 16 }}>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 99, height: 6, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  background: "#fff",
                  width: `${Math.round((completedDays.length / 30) * 100)}%`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Challenge body */}
        <div style={{ padding: "24px 28px" }}>

          {/* ── Status: None (landing) ── */}
          {challengeStatus === "none" && (
            <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🚀</div>
              <h3 style={{ color: theme.textPrimary, fontWeight: 800, fontSize: "1.15rem", margin: "0 0 8px" }}>
                Ready to Ascend?
              </h3>
              <p style={{ color: theme.textMuted, margin: "0 0 24px", maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                Commit to 30 days of deep reflection. You can catch up — but you must finish all 30 within 30 calendar days of starting.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 28 }}>
                {[
                  { icon: <Flame size={18} />, label: "30 Prompts", color: "#ef4444" },
                  { icon: <Target size={18} />, label: "30 Calendar Days", color: "#6366f1" },
                  { icon: <Star size={18} />, label: "100 Points + Badge", color: "#f59e0b" },
                ].map(({ icon, label, color }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ color, background: color + "22", borderRadius: 10, padding: 10 }}>{icon}</div>
                    <span style={{ color: theme.textSecondary, fontSize: "0.8rem", fontWeight: 600 }}>{label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={startChallenge}
                style={{
                  padding: "12px 36px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer",
                }}
              >
                Start the Challenge
              </button>
            </div>
          )}

          {/* ── Status: Failed ── */}
          {challengeStatus === "failed" && (
            <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏱️</div>
              <h3 style={{ color: theme.textPrimary, fontWeight: 800, fontSize: "1.1rem", margin: "0 0 8px" }}>
                The 30 Days Have Passed
              </h3>
              <p style={{ color: theme.textMuted, margin: "0 0 8px" }}>
                You completed {completedDays.length}/30 days — a solid effort! Your responses are saved below.
              </p>
              <p style={{ color: theme.textMuted, margin: "0 0 24px", fontSize: "0.85rem" }}>
                Ready to try again? A fresh enrollment starts your 30-day clock over.
              </p>
              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  style={{
                    padding: "10px 28px", borderRadius: 10, border: "none",
                    background: "#6366f1", color: "#fff", fontWeight: 700,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  <RotateCcw size={15} /> Start Fresh
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button onClick={() => setShowResetConfirm(false)} style={{
                    padding: "9px 20px", borderRadius: 10,
                    border: `1px solid ${theme.bgCardBorder}`, background: "transparent",
                    color: theme.textMuted, cursor: "pointer",
                  }}>Cancel</button>
                  <button onClick={retryChallenge} style={{
                    padding: "9px 20px", borderRadius: 10,
                    border: "none", background: "#6366f1",
                    color: "#fff", fontWeight: 700, cursor: "pointer",
                  }}>Yes, Start Fresh</button>
                </div>
              )}
            </div>
          )}

          {/* ── Status: Completed ── */}
          {challengeStatus === "completed" && (
            <div style={{ textAlign: "center", padding: "16px 0 10px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏆</div>
              <h3 style={{ color: theme.textPrimary, fontWeight: 800, fontSize: "1.25rem", margin: "0 0 8px" }}>
                You Completed the 30-Day Ascend Challenge!
              </h3>
              <p style={{ color: theme.textMuted, margin: "0 0 16px" }}>
                All 30 reflections. You did the work. You ascended.
              </p>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#f59e0b22", color: "#f59e0b", borderRadius: 10,
                padding: "8px 18px", fontWeight: 700, fontSize: "0.9rem",
              }}>
                <Star size={15} /> +100 points awarded
              </div>
            </div>
          )}

          {/* ── Day grid (active or failed with past responses visible) ── */}
          {(challengeStatus === "active" || challengeStatus === "failed") && (
            <div style={{ marginTop: challengeStatus === "active" ? 0 : 24 }}>
              {challengeStatus === "active" && (
                <h3 style={{ color: theme.textSecondary, fontWeight: 700, fontSize: "0.82rem",
                  letterSpacing: "0.06em", margin: "0 0 14px" }}>YOUR DAYS</h3>
              )}
              {challengeStatus === "failed" && (
                <h3 style={{ color: theme.textSecondary, fontWeight: 700, fontSize: "0.82rem",
                  letterSpacing: "0.06em", margin: "24px 0 14px" }}>YOUR RESPONSES</h3>
              )}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10,
              }}>
                {CHALLENGE_DAYS.map(({ day, title, tag }) => {
                  const done = isDayDone(day);
                  const unlocked = isDayUnlocked(day);
                  const tagColor = TAG_COLORS[tag] ?? "#6366f1";
                  const canOpen = unlocked && !done && challengeStatus === "active";
                  const canView = done;
                  const unlockDate = !unlocked ? getDayUnlockDate(day) : null;

                  return (
                    <button
                      key={day}
                      onClick={() => (canOpen || canView) ? openDay(day) : undefined}
                      disabled={!canOpen && !canView}
                      style={{
                        background: done ? tagColor + "18" : unlocked ? theme.bgCard : "transparent",
                        border: done
                          ? `1px solid ${tagColor}44`
                          : unlocked
                            ? `1px solid ${theme.bgCardBorder}`
                            : `1px dashed ${theme.bgCardBorder}`,
                        borderRadius: 12, padding: "12px 14px",
                        textAlign: "left", cursor: (canOpen || canView) ? "pointer" : "default",
                        transition: "all 0.15s",
                        opacity: !unlocked && challengeStatus === "active" ? 0.45 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          background: done ? tagColor + "33" : tagColor + "22",
                          color: tagColor, borderRadius: 6, padding: "2px 7px",
                          fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.04em",
                        }}>
                          DAY {day}
                        </span>
                        {done && <CheckCircle2 size={13} style={{ color: tagColor }} />}
                        {!done && !unlocked && challengeStatus === "active" && <Lock size={11} style={{ color: theme.textMuted }} />}
                        {!done && unlocked && challengeStatus === "active" && (
                          <span style={{ fontSize: "0.65rem", color: theme.accent, fontWeight: 700 }}>OPEN</span>
                        )}
                      </div>
                      <div style={{
                        color: done ? theme.textPrimary : unlocked ? theme.textSecondary : theme.textMuted,
                        fontSize: "0.8rem", fontWeight: done ? 600 : 400, lineHeight: 1.3,
                        marginBottom: unlockDate ? 4 : 0,
                      }}>
                        {title}
                      </div>
                      {unlockDate && challengeStatus === "active" && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 4,
                          color: theme.textMuted, fontSize: "0.68rem", marginTop: 4,
                        }}>
                          <Clock size={10} />
                          {unlockDate}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* View completed day responses */}
          {challengeStatus === "completed" && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ color: theme.textSecondary, fontWeight: 700, fontSize: "0.82rem",
                letterSpacing: "0.06em", margin: "0 0 14px" }}>YOUR 30 REFLECTIONS</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CHALLENGE_DAYS.map(({ day, title, tag }) => {
                  const resp = responses.find(r => r.day_number === day);
                  const tagColor = TAG_COLORS[tag] ?? "#6366f1";
                  return (
                    <div key={day} style={{
                      background: tagColor + "0f", border: `1px solid ${tagColor}33`,
                      borderRadius: 12, padding: "12px 16px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: resp ? 8 : 0 }}>
                        <span style={{ background: tagColor + "22", color: tagColor, borderRadius: 6,
                          padding: "2px 7px", fontSize: "0.67rem", fontWeight: 700 }}>
                          DAY {day}
                        </span>
                        <span style={{ color: theme.textPrimary, fontWeight: 600, fontSize: "0.85rem" }}>{title}</span>
                      </div>
                      {resp && (
                        <p style={{
                          color: theme.textSecondary, fontSize: "0.83rem", margin: 0,
                          lineHeight: 1.5, whiteSpace: "pre-wrap",
                          maxHeight: 80, overflow: "hidden",
                          maskImage: "linear-gradient(to bottom, black 60%, transparent)",
                          WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent)",
                        }}>
                          {resp.response_text.replace("\n\n<<VISION>>\n\n", "\n\n")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  LETTER TO FUTURE SELF                                         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div style={{
        background: theme.bgCard, borderRadius: 20, border: `1px solid ${theme.bgCardBorder}`,
        overflow: "hidden",
      }}>
        {/* Header band */}
        <div style={{
          background: "linear-gradient(135deg, #f59e0b, #ef4444)",
          padding: "24px 28px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <BookOpen size={22} style={{ color: "#fff" }} />
                <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.2rem" }}>
                  Letter to Future Self
                </span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.85)", margin: 0, fontSize: "0.88rem", maxWidth: 440 }}>
                Write a letter to yourself — locked for 365 days. When it unlocks, rediscover who you were, celebrate how far you've come.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Sparkles size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>+50 write · +50 read</span>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* ── Write new letter ── */}
          {showWriteLetter ? (
            <div>
              <p style={{ color: theme.textMuted, fontSize: "0.85rem", margin: "0 0 14px" }}>
                Write from your heart. You won't be able to read this for 365 days. Be honest, be hopeful, be you.
              </p>
              <textarea
                value={letterDraft}
                onChange={e => setLetterDraft(e.target.value)}
                placeholder="Dear Future Me,&#10;&#10;It's [date today]...&#10;&#10;I want you to know..."
                style={{
                  width: "100%", minHeight: 300, borderRadius: 12, padding: "16px 18px",
                  background: theme.bgPrimary ?? "rgba(0,0,0,0.2)", border: `1px solid ${theme.bgCardBorder}`,
                  color: theme.textPrimary, fontSize: "0.92rem", lineHeight: 1.7,
                  resize: "vertical", outline: "none", boxSizing: "border-box",
                  marginBottom: 14, fontFamily: "Georgia, serif",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={() => { setShowWriteLetter(false); setLetterDraft(""); }}
                  style={{
                    padding: "10px 20px", borderRadius: 10,
                    border: `1px solid ${theme.bgCardBorder}`, background: "transparent",
                    color: theme.textMuted, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveLetter}
                  disabled={savingLetter || letterDraft.trim().length < 20}
                  style={{
                    padding: "10px 24px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                    color: "#fff", fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    opacity: savingLetter || letterDraft.trim().length < 20 ? 0.6 : 1,
                  }}
                >
                  <Send size={15} />
                  {savingLetter ? "Sealing…" : "Seal & Lock for 365 Days"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Current active letter (locked or unlocked) */}
              {letters.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 12 }}>✉️</div>
                  <h3 style={{ color: theme.textPrimary, fontWeight: 800, fontSize: "1.05rem", margin: "0 0 8px" }}>
                    No letter yet
                  </h3>
                  <p style={{ color: theme.textMuted, margin: "0 0 24px", maxWidth: 380, marginLeft: "auto", marginRight: "auto", fontSize: "0.88rem" }}>
                    Write your first letter. It will be sealed and hidden until one year from today.
                  </p>
                  <button
                    onClick={() => setShowWriteLetter(true)}
                    style={{
                      padding: "11px 28px", borderRadius: 11, border: "none",
                      background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                      color: "#fff", fontWeight: 700, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <Plus size={15} /> Write My First Letter
                  </button>
                </div>
              )}

              {letters.length > 0 && (
                <div>
                  {/* Active (unread/locked) letter */}
                  {(() => {
                    const active = letters.find(l => !l.opened_at);
                    if (!active) return null;
                    const locked = active.unlock_date > today;
                    const daysUntil = Math.ceil((new Date(active.unlock_date + "T00:00:00").getTime() - Date.now()) / 86400000);
                    return (
                      <div style={{
                        background: locked
                          ? "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.1))"
                          : "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))",
                        border: `1px solid ${locked ? "#f59e0b44" : "#10b98155"}`,
                        borderRadius: 14, padding: "20px 22px",
                        display: "flex", alignItems: "center", gap: 16, marginBottom: 16,
                        cursor: locked ? "default" : "pointer",
                      }}
                      onClick={locked ? undefined : () => readLetter(active)}
                      >
                        <div style={{ fontSize: "2rem", flexShrink: 0 }}>
                          {locked ? "🔒" : "📬"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: theme.textPrimary, fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                            Future Letter To Myself
                          </div>
                          <div style={{ color: theme.textMuted, fontSize: "0.8rem" }}>
                            Written {new Date(active.written_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                          </div>
                          {locked ? (
                            <div style={{ color: "#f59e0b", fontSize: "0.8rem", marginTop: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                              <Clock size={12} /> Unlocks in {daysUntil} day{daysUntil !== 1 ? "s" : ""} · {new Date(active.unlock_date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                            </div>
                          ) : (
                            <div style={{ color: "#10b981", fontSize: "0.8rem", marginTop: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                              <Eye size={12} /> Unlocked! Click to read · +50 pts
                            </div>
                          )}
                        </div>
                        {!locked && <ChevronRight size={18} style={{ color: "#10b981" }} />}
                      </div>
                    );
                  })()}

                  {/* Write new letter (only if no active unread letter) */}
                  {!letters.find(l => !l.opened_at) && (
                    <div style={{ marginBottom: 16 }}>
                      <button
                        onClick={() => setShowWriteLetter(true)}
                        style={{
                          padding: "11px 24px", borderRadius: 11, border: "none",
                          background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                          color: "#fff", fontWeight: 700, cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 8,
                        }}
                      >
                        <Plus size={15} /> Write New Letter
                      </button>
                    </div>
                  )}

                  {/* Past (read) letters */}
                  {letters.filter(l => l.opened_at).length > 0 && (
                    <div>
                      <h3 style={{ color: theme.textSecondary, fontWeight: 700, fontSize: "0.8rem",
                        letterSpacing: "0.06em", margin: "20px 0 12px" }}>PAST LETTERS</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {letters.filter(l => l.opened_at).map(letter => (
                          <button
                            key={letter.id}
                            onClick={() => setActiveLetter(letter)}
                            style={{
                              background: "transparent", border: `1px solid ${theme.bgCardBorder}`,
                              borderRadius: 12, padding: "12px 16px",
                              display: "flex", alignItems: "center", gap: 12,
                              cursor: "pointer", textAlign: "left",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <BookOpen size={16} style={{ color: theme.textMuted, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ color: theme.textSecondary, fontSize: "0.82rem" }}>
                                Written {new Date(letter.written_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                              </div>
                              <div style={{ color: theme.textMuted, fontSize: "0.75rem" }}>
                                Read {new Date(letter.opened_at!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Eye size={13} style={{ color: theme.textMuted }} />
                              <span style={{ color: theme.textMuted, fontSize: "0.75rem" }}>Read</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Unlock Modal ── */}
      {showUnlockModal && unlockLetter && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9000, padding: 24,
        }}>
          <div style={{
            background: theme.bgCard, borderRadius: 20, padding: "36px 32px",
            maxWidth: 520, width: "100%", border: `1px solid ${theme.bgCardBorder}`,
            textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>📬</div>
            <h2 style={{ color: theme.textPrimary, fontWeight: 800, fontSize: "1.4rem", margin: "0 0 10px" }}>
              Your Letter Has Arrived!
            </h2>
            <p style={{ color: theme.textMuted, margin: "0 0 6px" }}>
              You wrote this letter on{" "}
              <strong style={{ color: theme.textPrimary }}>
                {new Date(unlockLetter.written_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </strong>
              .
            </p>
            <p style={{ color: theme.textMuted, margin: "0 0 28px" }}>
              365 days have passed. It's time to rediscover who you were — and celebrate who you've become.
            </p>
            <div style={{
              background: "#10b98122", border: "1px solid #10b98133",
              borderRadius: 10, padding: "10px 18px", marginBottom: 24,
              display: "inline-flex", alignItems: "center", gap: 8,
              color: "#10b981", fontWeight: 700,
            }}>
              <Zap size={15} /> +50 points for reading!
            </div>
            <div>
              <button
                onClick={closeUnlockModal}
                style={{
                  padding: "12px 36px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                  color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                <BookOpen size={17} /> Open & Read My Letter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
