import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../../store/appStore";
import { useThemeStore } from "../../store/themeStore";

// ─── Wizard definitions ───────────────────────────────────────────────────────
const WIZARDS = [
  {
    id: "merlin",
    name: "Merlin",
    label: "Time & Planning",
    gradient: "linear-gradient(150deg, #1a3a6b 0%, #2563eb 60%, #60a5fa 100%)",
    panelGradient: "linear-gradient(135deg, #1a3a6b18 0%, #2563eb10 100%)",
    glow: "#3b82f6",
    symbol: "⏳",
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
    accent: "#8b5cf6",
    pages: [
      { id: "stats",  label: "Stats",          icon: "📊" },
      { id: "points", label: "Points & Badges", icon: "🏅" },
    ],
  },
] as const;

const COL_WIDTH   = 72;   // wizard column width
const AVATAR_SIZE = 56;   // avatar circle size
const PANEL_W     = 190;  // slide-out panel width (links + avatar right-side)
const AVT_COL     = 64;   // right section of panel reserved for the avatar
const TOP_OFFSET  = 80;   // px from top before first wizard

// ─── Placeholder avatar circle ────────────────────────────────────────────────
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
      background: wizard.gradient,
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
      {/* Shimmer */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 55%)",
        pointerEvents: "none",
      }} />
      <span style={{ position: "relative", zIndex: 1, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
        {wizard.symbol}
      </span>
    </div>
  );
}

// ─── Slide-out panel ──────────────────────────────────────────────────────────
function SlidePanel({
  wizard, isOpen, topPx, onNavigate,
}: {
  wizard: typeof WIZARDS[number];
  isOpen: boolean;
  topPx: number;       // vertical center of the selected wizard in the column
  onNavigate: (page: string) => void;
}) {
  const { currentPage } = useAppStore();
  const { theme } = useThemeStore();

  return (
    <div style={{
      position: "fixed",
      top: 44,                        // below TopBar
      bottom: 44,                     // above BottomBar
      left: COL_WIDTH,
      width: PANEL_W,
      zIndex: 100,
      transform: isOpen ? "translateX(0)" : `translateX(-${PANEL_W + 4}px)`,
      transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
      pointerEvents: isOpen ? "auto" : "none",
    }}>
      <div style={{
        height: "100%",
        background: theme.bgCard,
        backgroundImage: wizard.panelGradient,
        borderRight: `1px solid ${wizard.glow}30`,
        boxShadow: `3px 0 20px rgba(0,0,0,0.28)`,
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}>

        {/* ── LEFT: nav links ── */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 8px 0 10px",
          gap: 4,
        }}>
          {/* Wizard name strip */}
          <div style={{
            color: wizard.accent,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 8,
            paddingLeft: 6,
          }}>
            {wizard.name}
          </div>

          {wizard.pages.map(page => {
            const isActive = currentPage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => onNavigate(page.id)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "9px 10px",
                  borderRadius: 9,
                  border: isActive ? `1px solid ${wizard.glow}50` : "1px solid transparent",
                  background: isActive
                    ? `linear-gradient(135deg, ${wizard.glow}22, ${wizard.glow}0a)`
                    : "transparent",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 9,
                  transition: "all 0.13s ease",
                  outline: "none",
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = `${wizard.glow}14`;
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{page.icon}</span>
                <span style={{
                  color: isActive ? wizard.accent : theme.textSecondary,
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  whiteSpace: "nowrap",
                }}>
                  {page.label}
                </span>
                {isActive && (
                  <div style={{
                    marginLeft: "auto", width: 5, height: 5, borderRadius: "50%",
                    background: wizard.glow, boxShadow: `0 0 5px ${wizard.glow}`,
                    flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── RIGHT: avatar column — appears to have "slid out" of the wizard strip ── */}
        <div style={{
          width: AVT_COL,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: Math.max(12, topPx - 44 - AVATAR_SIZE / 2), // align with wizard's row
          borderLeft: `1px solid ${wizard.glow}18`,
          background: `linear-gradient(180deg, ${wizard.glow}12 0%, transparent 60%)`,
          flexShrink: 0,
        }}>
          <AvatarCircle wizard={wizard} size={AVATAR_SIZE} glow />
          <div style={{
            color: wizard.accent,
            fontSize: 9,
            fontWeight: 700,
            marginTop: 5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            {wizard.name}
          </div>
        </div>

        {/* Decorative glow edge on right */}
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 1,
          background: `linear-gradient(180deg, transparent, ${wizard.glow}55, transparent)`,
          pointerEvents: "none",
        }} />
      </div>
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
        gap: 18,
        background: theme.bgCard,
        borderRight: `1px solid ${theme.bgCardBorder}`,
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
              style={{ position: "relative", display: "flex", alignItems: "center" }}
            >
              {/* Active page indicator bar */}
              {isActive && (
                <div style={{
                  position: "absolute", left: -(COL_WIDTH / 2 - AVATAR_SIZE / 2 + 2),
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
                  cursor: "pointer", outline: "none",
                  transform: isOpen ? "translateX(6px)" : "translateX(0)",
                  transition: "transform 0.22s ease",
                }}
              >
                <AvatarCircle
                  wizard={w}
                  size={AVATAR_SIZE}
                  glow={isOpen || isActive || hov}
                  dimmed={!!openWizard && !isOpen}
                />
              </button>

              {/* Tooltip (only when no panel open) */}
              {hov && !openWizard && (
                <div style={{
                  position: "absolute", left: COL_WIDTH + 6, top: "50%",
                  transform: "translateY(-50%)", zIndex: 200,
                  background: "rgba(0,0,0,0.88)", color: "#fff",
                  borderRadius: 8, padding: "5px 10px", whiteSpace: "nowrap",
                  fontSize: 12, fontWeight: 600, pointerEvents: "none",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                  border: `1px solid ${w.glow}44`,
                }}>
                  <div style={{ color: w.accent }}>{w.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>{w.label}</div>
                </div>
              )}
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
