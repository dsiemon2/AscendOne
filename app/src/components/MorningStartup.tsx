import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { getDb } from "../db/database";
import { useAppStore } from "../store/appStore";

interface MorningStartupProps {
  onNavigate: (page: string) => void;
  onClose: () => void;
}

// ── Time-of-day palettes ────────────────────────────────────────────────────
function getTimeOfDayTheme(hour: number) {
  if (hour >= 21 || hour < 5) {
    // 🌙 Night — Galaxy
    return {
      label:        "night",
      emoji:        "🌙",
      overlay:      "rgba(0,0,0,0.75)",
      bg:           "linear-gradient(160deg, #06060e 0%, #080918 50%, #09061a 100%)",
      card:         "rgba(10, 11, 28, 0.98)",
      cardBorder:   "rgba(80, 144, 224, 0.22)",
      cardShadow:   "0 32px 96px rgba(20, 10, 80, 0.7), 0 0 0 1px rgba(80, 144, 224, 0.15), 0 0 60px rgba(40, 60, 200, 0.12)",
      divider:      "rgba(80, 144, 224, 0.12)",
      textPrimary:  "#e8eeff",
      textMuted:    "#5868a0",
      textSub:      "#7888b8",
      textBtn:      "#8898c8",
      affirmBg:     "linear-gradient(135deg, #3a1a8a 0%, #1a2080 50%, #0a1060 100%)",
      affirmShadow: "0 8px 28px rgba(60, 30, 160, 0.45)",
      btnBg:        "rgba(255,255,255,0.04)",
      btnBorder:    "rgba(80, 144, 224, 0.18)",
      btnHoverBg:   "rgba(80, 144, 224, 0.12)",
      btnHoverBorder: "rgba(80, 144, 224, 0.5)",
      btnHoverColor:  "#7ab0f0",
      nebula1:      "radial-gradient(ellipse 80% 60% at 15% 20%, rgba(80,40,180,0.20) 0%, transparent 60%)",
      nebula2:      "radial-gradient(ellipse 70% 50% at 85% 75%, rgba(30,60,200,0.16) 0%, transparent 60%)",
    };
  } else if (hour < 12) {
    // 🌅 Morning — Dawn
    return {
      label:        "morning",
      emoji:        "🌅",
      overlay:      "rgba(20,10,5,0.65)",
      bg:           "linear-gradient(160deg, #1a0a05 0%, #2a1008 50%, #1a0c10 100%)",
      card:         "rgba(28, 14, 8, 0.97)",
      cardBorder:   "rgba(240, 140, 60, 0.25)",
      cardShadow:   "0 32px 96px rgba(200, 80, 20, 0.35), 0 0 0 1px rgba(240, 140, 60, 0.15)",
      divider:      "rgba(240, 140, 60, 0.15)",
      textPrimary:  "#fff0e0",
      textMuted:    "#9a6040",
      textSub:      "#c08060",
      textBtn:      "#d09070",
      affirmBg:     "linear-gradient(135deg, #c04010 0%, #e06020 50%, #f0a030 100%)",
      affirmShadow: "0 8px 28px rgba(200, 80, 20, 0.45)",
      btnBg:        "rgba(255,255,255,0.04)",
      btnBorder:    "rgba(240, 140, 60, 0.20)",
      btnHoverBg:   "rgba(240, 120, 40, 0.12)",
      btnHoverBorder: "rgba(240, 140, 60, 0.55)",
      btnHoverColor:  "#f0a050",
      nebula1:      "radial-gradient(ellipse 80% 60% at 10% 80%, rgba(200,80,20,0.22) 0%, transparent 60%)",
      nebula2:      "radial-gradient(ellipse 60% 50% at 85% 20%, rgba(240,160,40,0.16) 0%, transparent 60%)",
    };
  } else if (hour < 17) {
    // ☀️ Afternoon — Sky
    return {
      label:        "afternoon",
      emoji:        "☀️",
      overlay:      "rgba(0,10,30,0.65)",
      bg:           "linear-gradient(160deg, #04101e 0%, #061428 50%, #080c1e 100%)",
      card:         "rgba(8, 16, 32, 0.97)",
      cardBorder:   "rgba(60, 160, 240, 0.25)",
      cardShadow:   "0 32px 96px rgba(20, 80, 200, 0.35), 0 0 0 1px rgba(60, 160, 240, 0.15)",
      divider:      "rgba(60, 160, 240, 0.15)",
      textPrimary:  "#e0f0ff",
      textMuted:    "#4070a0",
      textSub:      "#6090c0",
      textBtn:      "#80b0d8",
      affirmBg:     "linear-gradient(135deg, #0060c0 0%, #1090e0 50%, #40b8f0 100%)",
      affirmShadow: "0 8px 28px rgba(20, 100, 220, 0.45)",
      btnBg:        "rgba(255,255,255,0.04)",
      btnBorder:    "rgba(60, 160, 240, 0.20)",
      btnHoverBg:   "rgba(40, 140, 240, 0.12)",
      btnHoverBorder: "rgba(60, 160, 240, 0.55)",
      btnHoverColor:  "#60c0f8",
      nebula1:      "radial-gradient(ellipse 80% 60% at 20% 20%, rgba(20,100,220,0.20) 0%, transparent 60%)",
      nebula2:      "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(60,160,240,0.14) 0%, transparent 60%)",
    };
  } else {
    // 🌆 Evening — Sunset
    return {
      label:        "evening",
      emoji:        "🌆",
      overlay:      "rgba(10,5,20,0.70)",
      bg:           "linear-gradient(160deg, #0e0514 0%, #180820 50%, #100614 100%)",
      card:         "rgba(18, 8, 26, 0.97)",
      cardBorder:   "rgba(180, 80, 200, 0.25)",
      cardShadow:   "0 32px 96px rgba(120, 40, 160, 0.40), 0 0 0 1px rgba(180, 80, 200, 0.15)",
      divider:      "rgba(180, 80, 200, 0.15)",
      textPrimary:  "#f0e0ff",
      textMuted:    "#806090",
      textSub:      "#a080b8",
      textBtn:      "#b890d0",
      affirmBg:     "linear-gradient(135deg, #6010a0 0%, #a030c0 50%, #e06080 100%)",
      affirmShadow: "0 8px 28px rgba(120, 40, 160, 0.50)",
      btnBg:        "rgba(255,255,255,0.04)",
      btnBorder:    "rgba(180, 80, 200, 0.20)",
      btnHoverBg:   "rgba(160, 60, 200, 0.12)",
      btnHoverBorder: "rgba(180, 80, 200, 0.55)",
      btnHoverColor:  "#d080f0",
      nebula1:      "radial-gradient(ellipse 80% 60% at 15% 25%, rgba(120,40,180,0.22) 0%, transparent 60%)",
      nebula2:      "radial-gradient(ellipse 60% 50% at 80% 75%, rgba(200,60,100,0.16) 0%, transparent 60%)",
    };
  }
}

export default function MorningStartup({ onNavigate, onClose }: MorningStartupProps) {
  const { profile } = useAppStore();
  const [affirmation, setAffirmation] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  const hour = new Date().getHours();
  const T = getTimeOfDayTheme(hour);

  const greeting =
    hour < 5  ? "Good Night" :
    hour < 12 ? "Good Morning" :
    hour < 17 ? "Good Afternoon" :
    hour < 21 ? "Good Evening" : "Good Night";
  const firstName = profile?.first_name ?? "Friend";

  useEffect(() => {
    loadAffirmation();
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  async function loadAffirmation() {
    try {
      const db = await getDb();
      const [result] = await db.select<[{ text: string }]>(
        "SELECT text FROM affirmations WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1"
      );
      setAffirmation(result?.text ?? "Today is full of possibility. You have everything you need.");
    } catch {
      setAffirmation("Today is full of possibility. You have everything you need.");
    } finally {
      setLoaded(true);
    }
  }

  function handleNavigate(page: string) {
    onNavigate(page);
    onClose();
  }

  const actions = [
    { label: "Log Gratitudes", page: "gratitudes", emoji: "🙏" },
    { label: "View Calendar",  page: "calendar",   emoji: "📅" },
    { label: "View Tasks",     page: "tasks",       emoji: "✅" },
    { label: "Dashboard",      page: "dashboard",   emoji: "🏠" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: T.overlay,
        backdropFilter: "blur(12px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      {/* Modal card */}
      <div
        className="relative w-full"
        style={{
          maxWidth: 420,
          margin: "0 20px",
          background: T.card,
          borderRadius: 24,
          border: `1px solid ${T.cardBorder}`,
          boxShadow: T.cardShadow,
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
          transition: "transform 0.35s ease, opacity 0.35s ease",
          overflow: "hidden",
        }}
      >
        {/* Nebula overlays */}
        <div style={{ position: "absolute", inset: 0, background: T.nebula1, pointerEvents: "none", borderRadius: 24 }} />
        <div style={{ position: "absolute", inset: 0, background: T.nebula2, pointerEvents: "none", borderRadius: 24 }} />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            padding: "6px",
            borderRadius: "50%",
            color: T.textMuted,
            background: T.btnBg,
            border: `1px solid ${T.btnBorder}`,
            lineHeight: 0,
            cursor: "pointer",
            zIndex: 10,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = T.textPrimary)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = T.textMuted)}
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div style={{ padding: "32px 28px 22px", textAlign: "center", position: "relative" }}>
          <div style={{ fontSize: "2.8rem", lineHeight: 1, marginBottom: 12 }}>{T.emoji}</div>
          <h2 style={{
            color: T.textPrimary,
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.2,
          }}>
            {greeting}, {firstName}!
          </h2>
          <p style={{
            color: T.textMuted,
            fontSize: "0.8rem",
            marginTop: 6,
            marginBottom: 0,
          }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            })}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.divider, margin: "0 28px" }} />

        {/* Affirmation */}
        <div style={{ padding: "20px 28px", position: "relative" }}>
          <div style={{
            background: T.affirmBg,
            borderRadius: 14,
            padding: "16px 18px",
            textAlign: "center",
            boxShadow: T.affirmShadow,
          }}>
            <Sparkles size={15} color="rgba(255,255,255,0.85)" style={{ display: "block", margin: "0 auto 8px" }} />
            <p style={{
              color: "#fff",
              fontSize: "0.92rem",
              fontStyle: "italic",
              fontWeight: 500,
              lineHeight: 1.55,
              margin: 0,
            }}>
              {loaded ? `"${affirmation}"` : "Loading your affirmation..."}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.divider, margin: "0 28px" }} />

        {/* Navigation */}
        <div style={{ padding: "20px 28px 28px", position: "relative" }}>
          <p style={{
            color: T.textMuted,
            fontSize: "0.72rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            textAlign: "center",
            marginBottom: 14,
          }}>
            Where would you like to begin?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {actions.map(({ label, page, emoji }) => (
              <button
                key={page}
                onClick={() => handleNavigate(page)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "14px 8px",
                  borderRadius: 12,
                  background: T.btnBg,
                  border: `1px solid ${T.btnBorder}`,
                  color: T.textBtn,
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = T.btnHoverBg;
                  btn.style.borderColor = T.btnHoverBorder;
                  btn.style.color = T.btnHoverColor;
                  btn.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = T.btnBg;
                  btn.style.borderColor = T.btnBorder;
                  btn.style.color = T.textBtn;
                  btn.style.transform = "translateY(0)";
                }}
              >
                <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
