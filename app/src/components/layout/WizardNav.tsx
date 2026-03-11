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
    glow: "#3b82f6",
    symbol: "⏳",
    accent: "#3b82f6",
    pages: [
      { id: "calendar",  label: "Calendar",   icon: "📅" },
      { id: "tasks",     label: "Tasks",       icon: "✅" },
      { id: "todo",      label: "To-Do List",  icon: "📋" },
    ],
  },
  {
    id: "nimue",
    name: "Nimue",
    label: "Manifestation",
    gradient: "linear-gradient(150deg, #0c3547 0%, #0891b2 60%, #22d3ee 100%)",
    glow: "#06b6d4",
    symbol: "🔮",
    accent: "#06b6d4",
    pages: [
      { id: "vision-board",  label: "Vision Board",  icon: "🌅" },
      { id: "roadmap",       label: "Roadmap",        icon: "🗺️"  },
      { id: "affirmations",  label: "Affirmations",   icon: "✨" },
      { id: "gratitudes",    label: "Gratitudes",     icon: "🙏" },
    ],
  },
  {
    id: "taliesin",
    name: "Taliesin",
    label: "Growth & Journey",
    gradient: "linear-gradient(150deg, #6b2d0a 0%, #d97706 60%, #fbbf24 100%)",
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
    glow: "#8b5cf6",
    symbol: "⚡",
    accent: "#8b5cf6",
    pages: [
      { id: "stats",  label: "Stats",          icon: "📊" },
      { id: "points", label: "Points & Badges", icon: "🏅" },
    ],
  },
] as const;

const WIZARD_WIDTH = 64;
const PANEL_WIDTH  = 220;

// ─── Placeholder avatar ───────────────────────────────────────────────────────
function WizardAvatar({
  wizard, isActive, onClick,
}: {
  wizard: typeof WIZARDS[number];
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {/* Tooltip */}
      {hovered && !isActive && (
        <div style={{
          position: "absolute", left: WIZARD_WIDTH + 8, top: "50%",
          transform: "translateY(-50%)", zIndex: 200,
          background: "rgba(0,0,0,0.85)", color: "#fff",
          borderRadius: 8, padding: "6px 12px", whiteSpace: "nowrap",
          fontSize: 12, fontWeight: 600, pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          border: `1px solid ${wizard.glow}44`,
        }}>
          <div style={{ color: wizard.accent }}>{wizard.name}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{wizard.label}</div>
        </div>
      )}

      {/* Active indicator bar */}
      {isActive && (
        <div style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: 3, height: 36, borderRadius: "0 3px 3px 0",
          background: wizard.glow,
          boxShadow: `0 0 8px ${wizard.glow}`,
        }} />
      )}

      {/* Avatar circle */}
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={`${wizard.name} — ${wizard.label}`}
        style={{
          width: 44, height: 44,
          borderRadius: "50%",
          background: wizard.gradient,
          border: isActive
            ? `2px solid ${wizard.glow}`
            : hovered
              ? `2px solid ${wizard.glow}88`
              : "2px solid transparent",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
          boxShadow: isActive
            ? `0 0 16px ${wizard.glow}66, 0 2px 8px rgba(0,0,0,0.4)`
            : hovered
              ? `0 0 12px ${wizard.glow}44, 0 2px 8px rgba(0,0,0,0.3)`
              : "0 2px 8px rgba(0,0,0,0.3)",
          transform: isActive ? "scale(1.08)" : hovered ? "scale(1.04)" : "scale(1)",
          transition: "all 0.2s ease",
          outline: "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shimmer overlay */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />
        <span style={{ position: "relative", zIndex: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
          {wizard.symbol}
        </span>
      </button>
    </div>
  );
}

// ─── Slide-out panel ──────────────────────────────────────────────────────────
function WizardPanel({
  wizard, isOpen, onNavigate,
}: {
  wizard: typeof WIZARDS[number] | null;
  isOpen: boolean;
  onNavigate: (page: string) => void;
}) {
  const { currentPage } = useAppStore();
  const { theme } = useThemeStore();

  if (!wizard) return null;

  return (
    <div style={{
      position: "fixed",
      top: 44,           // below TopBar
      bottom: 44,        // above BottomBar
      left: WIZARD_WIDTH,
      width: PANEL_WIDTH,
      zIndex: 100,
      transform: isOpen ? "translateX(0)" : `translateX(-${PANEL_WIDTH + 10}px)`,
      transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      pointerEvents: isOpen ? "auto" : "none",
    }}>
      <div style={{
        height: "100%",
        background: theme.bgCard,
        borderRight: `1px solid ${wizard.glow}33`,
        boxShadow: `4px 0 24px rgba(0,0,0,0.3), inset -1px 0 0 ${wizard.glow}22`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Panel header */}
        <div style={{
          padding: "20px 16px 16px",
          borderBottom: `1px solid ${wizard.glow}22`,
          background: `linear-gradient(180deg, ${wizard.glow}15 0%, transparent 100%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: wizard.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
              boxShadow: `0 0 12px ${wizard.glow}44`,
            }}>
              {wizard.symbol}
            </div>
            <div>
              <div style={{ color: wizard.accent, fontWeight: 700, fontSize: 15 }}>{wizard.name}</div>
              <div style={{ color: theme.textMuted, fontSize: 11 }}>{wizard.label}</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {wizard.pages.map(page => {
            const isActive = currentPage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => onNavigate(page.id)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: isActive ? `1px solid ${wizard.glow}55` : "1px solid transparent",
                  background: isActive
                    ? `linear-gradient(135deg, ${wizard.glow}20, ${wizard.glow}0d)`
                    : "transparent",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  transition: "all 0.15s ease",
                  outline: "none",
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = `${wizard.glow}11`;
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{page.icon}</span>
                <span style={{
                  color: isActive ? wizard.accent : theme.textSecondary,
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                }}>
                  {page.label}
                </span>
                {isActive && (
                  <div style={{
                    marginLeft: "auto", width: 6, height: 6, borderRadius: "50%",
                    background: wizard.glow, boxShadow: `0 0 6px ${wizard.glow}`,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Decorative bottom gradient */}
        <div style={{
          height: 40,
          background: `linear-gradient(0deg, ${wizard.glow}0f 0%, transparent 100%)`,
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
  const navRef = useRef<HTMLDivElement>(null);

  // Close panel on click outside
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

  // Close panel on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenWizard(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  function handleWizardClick(wizardId: string) {
    setOpenWizard(prev => (prev === wizardId ? null : wizardId));
  }

  function handleNavigate(page: string) {
    setCurrentPage(page as Parameters<typeof setCurrentPage>[0]);
    setOpenWizard(null);
  }

  const activeWizard = WIZARDS.find(w => w.pages.some(p => p.id === currentPage)) ?? null;
  const openWizardDef = WIZARDS.find(w => w.id === openWizard) ?? null;

  return (
    <div ref={navRef}>
      {/* ── Wizard column ── */}
      <div style={{
        width: WIZARD_WIDTH,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 16,
        paddingBottom: 16,
        gap: 12,
        background: theme.bgCard,
        borderRight: `1px solid ${theme.bgCardBorder}`,
        flexShrink: 0,
        position: "relative",
        zIndex: 110,
      }}>
        {WIZARDS.map(w => (
          <WizardAvatar
            key={w.id}
            wizard={w}
            isActive={openWizard === w.id || activeWizard?.id === w.id}
            onClick={() => handleWizardClick(w.id)}
          />
        ))}
      </div>

      {/* ── Slide-out panel ── */}
      <WizardPanel
        wizard={openWizardDef}
        isOpen={!!openWizard}
        onNavigate={handleNavigate}
      />

      {/* ── Backdrop (subtle) ── */}
      <div
        onClick={() => setOpenWizard(null)}
        style={{
          position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(0,0,0,0.25)",
          opacity: openWizard ? 1 : 0,
          pointerEvents: openWizard ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      />
    </div>
  );
}
