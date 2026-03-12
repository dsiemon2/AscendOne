import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../../store/appStore";
import { useThemeStore } from "../../store/themeStore";

// ─── Wizard definitions ───────────────────────────────────────────────────────
const WIZARDS = [
  {
    id: "merlin",
    name: "Merlyn",
    label: "Time & Planning",
    gradient: "linear-gradient(150deg, #1a3a6b 0%, #2563eb 60%, #60a5fa 100%)",
    panelGradient: "linear-gradient(135deg, #1a3a6b18 0%, #2563eb10 100%)",
    glow: "#3b82f6",
    symbol: "⏳",
    image: "/wizards/merlyn.png",
    accent: "#3b82f6",
    pages: [
      { id: "calendar", label: "Calendar",  icon: "📅" },
      { id: "tasks",    label: "Tasks",      icon: "✅" },
      { id: "todo",     label: "To-Do List", icon: "📋" },
    ],
  },
  {
    id: "nimue",
    name: "Nimue",
    label: "Manifestation",
    gradient: "linear-gradient(150deg, #0c3547 0%, #0891b2 60%, #22d3ee 100%)",
    panelGradient: "linear-gradient(135deg, #0c354718 0%, #0891b210 100%)",
    glow: "#06b6d4",
    symbol: "🔮",
    image: "/wizards/nimue.png",
    accent: "#06b6d4",
    pages: [
      { id: "vision-board", label: "Vision Board", icon: "🌅" },
      { id: "roadmap",      label: "Roadmap",       icon: "🗺️"  },
      { id: "affirmations", label: "Affirmations",  icon: "✨" },
      { id: "gratitudes",   label: "Gratitudes",    icon: "🙏" },
    ],
  },
  {
    id: "taliesin",
    name: "Taliesin",
    label: "Growth & Journey",
    gradient: "linear-gradient(150deg, #6b2d0a 0%, #d97706 60%, #fbbf24 100%)",
    panelGradient: "linear-gradient(135deg, #6b2d0a18 0%, #d9770610 100%)",
    glow: "#f59e0b",
    symbol: "📜",
    image: "/wizards/taliesin.png",
    accent: "#f59e0b",
    pages: [
      { id: "journal",    label: "Journal",    icon: "📖" },
      { id: "challenges", label: "Challenges", icon: "🏆" },
    ],
  },
  {
    id: "blaise",
    name: "Blaise",
    label: "Insight & Progress",
    gradient: "linear-gradient(150deg, #2d1b6b 0%, #7c3aed 60%, #a78bfa 100%)",
    panelGradient: "linear-gradient(135deg, #2d1b6b18 0%, #7c3aed10 100%)",
    glow: "#8b5cf6",
    symbol: "⚡",
    image: "/wizards/blaise.png",
    accent: "#8b5cf6",
    pages: [
      { id: "stats",  label: "Stats",          icon: "📊" },
      { id: "points", label: "Points & Badges", icon: "🏅" },
    ],
  },
] as const;

const COL_WIDTH   = 88;   // wizard column width
const AVATAR_SIZE = 66;   // avatar circle size
const TOP_OFFSET  = 60;   // px from top before first wizard

// ─── Avatar circle — uses photo if available, emoji gradient otherwise ────────
function AvatarCircle({
  wizard, size = AVATAR_SIZE, glow = false, dimmed = false,
}: {
  wizard: typeof WIZARDS[number];
  size?: number;
  glow?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "transparent",
      border: glow ? `2.5px solid ${wizard.glow}` : "2.5px solid transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42,
      boxShadow: glow
        ? `0 0 18px ${wizard.glow}66, 0 2px 10px rgba(0,0,0,0.5)`
        : "0 2px 8px rgba(0,0,0,0.35)",
      opacity: dimmed ? 0.35 : 1,
      transition: "all 0.2s ease",
      flexShrink: 0,
      position: "relative" as const,
      overflow: "hidden",
    }}>
      <img
        src={wizard.image}
        alt={wizard.name}
        style={{
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          borderRadius: "50%",
          display: "block",
        }}
      />

      {/* Glow ring overlay for both types */}
      {glow && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          boxShadow: `inset 0 0 8px ${wizard.glow}44`,
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

// ─── Slide-out panel ──────────────────────────────────────────────────────────
const LINK_H         = 44;   // height per nav link row
const HEADER_H       = 38;   // wizard name header height
const PAD_V          = 14;   // top + bottom inner padding
const LINKS_W        = 290;  // width of the nav links section (wider = more rectangular)
const PANEL_AVT_SIZE = 74;   // avatar size on the right side of the panel
const PANEL_AVT_GAP  = 12;   // gap between links card and avatar

function SlidePanel({
  wizard, isOpen, topPx, onNavigate, onClose,
}: {
  wizard: typeof WIZARDS[number];
  isOpen: boolean;
  topPx: number;
  onNavigate: (page: string) => void;
  onClose: () => void;
}) {
  const { currentPage } = useAppStore();

  // Auto-calculated panel height
  const panelH = HEADER_H + wizard.pages.length * LINK_H + PAD_V * 2 + 8;

  // Total width: links card + gap + avatar
  const panelTotalW = LINKS_W + PANEL_AVT_GAP + PANEL_AVT_SIZE;

  // Center on the wizard, clamped to viewport
  const TOP_BAR_H = 44;
  const BOT_BAR_H = 44;
  const minTop    = TOP_BAR_H + 10;
  const maxTop    = window.innerHeight - BOT_BAR_H - panelH - 10;
  const rawTop    = topPx - panelH / 2;
  const finalTop  = Math.max(minTop, Math.min(maxTop, rawTop));

  return (
    <div style={{
      position: "fixed",
      top: finalTop,
      left: COL_WIDTH,
      width: panelTotalW,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      gap: PANEL_AVT_GAP,
      transform: isOpen ? "translateX(0)" : `translateX(-${panelTotalW + COL_WIDTH + 10}px)`,
      opacity: isOpen ? 1 : 0,
      transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease, top 0.15s ease",
      pointerEvents: isOpen ? "auto" : "none",
    }}>

      {/* ── LINKS CARD (left) ── */}
      <div style={{ position: "relative", flexShrink: 0 }}>

        {/* Glow halo around links card */}
        <div style={{
          position: "absolute", inset: -1,
          borderRadius: 16,
          boxShadow: `0 0 28px ${wizard.glow}44, 0 8px 32px rgba(0,0,0,0.45)`,
          pointerEvents: "none",
        }} />

        <div style={{
          width: LINKS_W,
          height: panelH,
          borderRadius: 14,
          background: "rgba(6,6,18,0.85)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          border: `1px solid ${wizard.glow}45`,
          overflow: "hidden",
          position: "relative",
        }}>

          {/* Top gradient bar */}
          <div style={{
            height: 4,
            background: `linear-gradient(90deg, ${wizard.glow}, ${wizard.accent}88)`,
          }} />

          {/* Dot mesh overlay */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `radial-gradient(${wizard.glow}18 1px, transparent 1px)`,
            backgroundSize: "18px 18px",
            pointerEvents: "none",
          }} />

          {/* Gradient tint */}
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(135deg, ${wizard.glow}12 0%, transparent 55%, ${wizard.glow}08 100%)`,
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1, padding: `10px 14px ${PAD_V}px` }}>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              marginBottom: 8, paddingLeft: 2,
            }}>
              <div style={{
                width: 4, height: 18, borderRadius: 2,
                background: `linear-gradient(180deg, ${wizard.glow}, ${wizard.accent}88)`,
                flexShrink: 0,
              }} />
              <span style={{
                color: wizard.accent,
                fontSize: 13, fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>
                {wizard.name}
              </span>
              <span style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 11, fontStyle: "italic",
                marginLeft: 2,
              }}>
                — {wizard.label}
              </span>
            </div>

            {/* Nav links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {wizard.pages.map(page => {
                const isActive = currentPage === page.id;
                return (
                  <button
                    key={page.id}
                    onClick={() => onNavigate(page.id)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: isActive ? `1px solid ${wizard.glow}55` : "1px solid transparent",
                      background: isActive
                        ? `linear-gradient(90deg, ${wizard.glow}28, ${wizard.glow}0f)`
                        : "transparent",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10,
                      transition: "all 0.12s ease",
                      outline: "none",
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = `${wizard.glow}28`;
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: 17, flexShrink: 0 }}>{page.icon}</span>
                    <span style={{
                      color: isActive ? wizard.accent : "rgba(255,255,255,0.82)",
                      fontSize: 14, fontWeight: isActive ? 700 : 500,
                      whiteSpace: "nowrap", flex: 1,
                    }}>
                      {page.label}
                    </span>
                    {isActive && (
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: wizard.glow,
                        boxShadow: `0 0 8px ${wizard.glow}`,
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

          </div>

          {/* Bottom glow fade */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 24,
            background: `linear-gradient(0deg, ${wizard.glow}0f, transparent)`,
            pointerEvents: "none",
          }} />
        </div>
      </div>

      {/* ── AVATAR (right) — click to close ── */}
      <button
        onClick={onClose}
        title={`Close ${wizard.name}`}
        style={{
          background: "none", border: "none", padding: 0,
          cursor: "pointer", outline: "none", flexShrink: 0,
        }}
      >
        <div style={{
          width: PANEL_AVT_SIZE + 10,
          height: PANEL_AVT_SIZE + 10,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${wizard.glow}38 0%, transparent 70%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 28px ${wizard.glow}60, 0 4px 16px rgba(0,0,0,0.4)`,
        }}>
          <AvatarCircle wizard={wizard} size={PANEL_AVT_SIZE} glow />
        </div>
      </button>

    </div>
  );
}

// ─── Main WizardNav ───────────────────────────────────────────────────────────
export default function WizardNav() {
  const { theme } = useThemeStore();
  const { setCurrentPage, currentPage } = useAppStore();
  const [openWizard, setOpenWizard] = useState<string | null>(null);
  const [wizardTops, setWizardTops] = useState<Record<string, number>>({});
  const navRef   = useRef<HTMLDivElement>(null);
  const avatarRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Measure each wizard's vertical center for panel alignment
  useEffect(() => {
    const tops: Record<string, number> = {};
    for (const w of WIZARDS) {
      const el = avatarRefs.current[w.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        tops[w.id] = rect.top + rect.height / 2;
      }
    }
    setWizardTops(tops);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenWizard(null);
      }
    }
    if (openWizard) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [openWizard]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenWizard(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  function handleWizardClick(wizardId: string) {
    setOpenWizard(prev => (prev === wizardId ? null : wizardId));
    // Re-measure positions on each open
    setTimeout(() => {
      const tops: Record<string, number> = {};
      for (const w of WIZARDS) {
        const el = avatarRefs.current[w.id];
        if (el) {
          const rect = el.getBoundingClientRect();
          tops[w.id] = rect.top + rect.height / 2;
        }
      }
      setWizardTops(tops);
    }, 0);
  }

  function handleNavigate(page: string) {
    setCurrentPage(page as Parameters<typeof setCurrentPage>[0]);
    setOpenWizard(null);
  }

  const activeWizard = WIZARDS.find(w => w.pages.some(p => p.id === currentPage)) ?? null;

  return (
    <div ref={navRef}>
      {/* ── Wizard column ── */}
      <div style={{
        width: COL_WIDTH,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: TOP_OFFSET,
        gap: 14,
        background: "transparent",
        flexShrink: 0,
        position: "relative",
        zIndex: 110,
      }}>
        {WIZARDS.map(w => {
          const isOpen   = openWizard === w.id;
          const isActive = !isOpen && activeWizard?.id === w.id;
          const [hov, setHov] = [useState(false)[0], useState(false)[1]];

          return (
            <div
              key={w.id}
              ref={el => { avatarRefs.current[w.id] = el; }}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              {/* Active page indicator — left edge glow bar */}
              {isActive && (
                <div style={{
                  position: "absolute",
                  left: -(COL_WIDTH / 2 - AVATAR_SIZE / 2 + 2),
                  top: "50%", transform: "translateY(-50%)",
                  width: 3, height: AVATAR_SIZE * 0.65, borderRadius: "0 3px 3px 0",
                  background: w.glow,
                  boxShadow: `0 0 8px ${w.glow}`,
                }} />
              )}

              <button
                onClick={() => handleWizardClick(w.id)}
                onMouseEnter={() => setHov(true)}
                onMouseLeave={() => setHov(false)}
                title={`${w.name} — ${w.label}`}
                style={{
                  background: "none", border: "none", padding: 0,
                  cursor: isOpen ? "default" : "pointer",
                  outline: "none",
                  opacity: isOpen ? 0 : 1,
                  pointerEvents: isOpen ? "none" : "auto",
                  transform: "translateX(0) scale(1)",
                  transition: "opacity 0.18s ease",
                }}
              >
                <AvatarCircle
                  wizard={w}
                  size={AVATAR_SIZE}
                  glow={isOpen || isActive || hov}
                  dimmed={!!openWizard && !isOpen}
                />
              </button>

              {/* Name label below avatar — always visible */}
              <span style={{
                color: isOpen || isActive ? w.accent : theme.textMuted,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                textAlign: "center",
                userSelect: "none",
                pointerEvents: "none",
                transition: "color 0.2s ease",
              }}>
                {w.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Slide-out panels (one per wizard, only open one shows) ── */}
      {WIZARDS.map(w => (
        <SlidePanel
          key={w.id}
          wizard={w}
          isOpen={openWizard === w.id}
          topPx={wizardTops[w.id] ?? 200}
          onNavigate={handleNavigate}
          onClose={() => setOpenWizard(null)}
        />
      ))}

      {/* ── Backdrop ── */}
      <div
        onClick={() => setOpenWizard(null)}
        style={{
          position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(0,0,0,0.2)",
          opacity: openWizard ? 1 : 0,
          pointerEvents: openWizard ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      />
    </div>
  );
}
