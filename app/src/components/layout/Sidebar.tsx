import { useEffect } from "react";
import {
  LayoutDashboard, Calendar, Target, CheckSquare, Heart,
  Sparkles, BookOpen, Map, Star, Image, Settings,
  ChevronLeft, ChevronRight, Lock, BarChart2, ClipboardList, Trophy,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useThemeStore, ThemePeriod } from "../../store/themeStore";
import LogoImage from "../LogoImage";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "todo", label: "To-Do List", icon: ClipboardList },
  { id: "calendar", label: "Time Management", icon: Calendar },
  { id: "goals", label: "Goals", icon: Target },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "gratitudes", label: "Gratitudes", icon: Heart },
  { id: "affirmations", label: "Quotes & Affirmations", icon: Sparkles },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "roadmap", label: "Roadmap", icon: Map },
  { id: "points", label: "Points & Rewards", icon: Star },
  { id: "stats", label: "Stats & Insights", icon: BarChart2 },
  { id: "vision-board", label: "Vision Board", icon: Image },
  { id: "challenges", label: "Challenges", icon: Trophy },
  { id: "settings", label: "Settings", icon: Settings },
];

const periodOrder: ThemePeriod[] = ["dawn", "day", "dusk", "night"];

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar, profile, lockApp } = useAppStore();
  const { theme, manualOverride, setManualOverride, updateTheme } = useThemeStore();

  useEffect(() => {
    const interval = setInterval(() => {
      if (!manualOverride) updateTheme();
    }, 60000);
    return () => clearInterval(interval);
  }, [manualOverride, updateTheme]);

  function cycleTheme() {
    const currentPeriod = manualOverride ?? theme.period;
    const idx = periodOrder.indexOf(currentPeriod);
    const next = periodOrder[(idx + 1) % periodOrder.length];
    const h = new Date().getHours();
    const auto: ThemePeriod = h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 18 ? "day" : h >= 18 && h < 21 ? "dusk" : "night";
    setManualOverride(next === auto ? null : next);
  }

  return (
    <aside
      className="flex flex-col h-full select-none flex-shrink-0"
      style={{
        width: sidebarCollapsed ? 64 : 240,
        background: theme.sidebarBg,
        borderRight: `1px solid ${theme.sidebarBorder}`,
        transition: "width 0.25s ease",
      }}
    >
      {/* Brand */}
      <div
        className="flex flex-col items-center flex-shrink-0"
        style={{
          borderBottom: `1px solid ${theme.sidebarBorder}`,
          padding: sidebarCollapsed ? "12px 0" : "20px 0 16px",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {/* Logo — big and prominent */}
        <LogoImage size={sidebarCollapsed ? 48 : 170} style={{ flexShrink: 0 }} />
        {/* App name shown below logo only when expanded */}
        {!sidebarCollapsed && (
          <div style={{ textAlign: "center" }}>
            <div style={{ color: theme.sidebarBrandText, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em" }}>
              LAW OF ATTRACTION
            </div>
          </div>
        )}
      </div>

      {/* Nav — extra top padding creates breathing room after logo */}
      <nav className="flex-1 overflow-y-auto pt-3 pb-2 px-3">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              title={sidebarCollapsed ? label : undefined}
              className="flex items-center gap-3 w-full rounded-xl mb-0.5 cursor-pointer"
              style={{
                padding: sidebarCollapsed ? "10px 0" : "10px 14px",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                background: active ? theme.sidebarActiveBg : "transparent",
                borderLeft: active ? `3px solid ${theme.sidebarActiveBar}` : "3px solid transparent",
                color: active ? theme.sidebarTextActive : theme.sidebarText,
                transition: "all 0.15s ease",
                border: `3px solid ${active ? theme.sidebarActiveBar : "transparent"}`,
                borderRight: "none",
                borderTop: "none",
                borderBottom: "none",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLButtonElement).style.color = theme.sidebarTextActive;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = theme.sidebarText;
                }
              }}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!sidebarCollapsed && (
                <span style={{ fontSize: "0.84rem", fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: `1px solid ${theme.sidebarBorder}` }} className="px-4 py-3 flex-shrink-0">
        {profile && (
          sidebarCollapsed ? (
            /* Collapsed: just the avatar bubble, centered */
            <div
              className="flex justify-center mb-2 cursor-pointer"
              onClick={() => setCurrentPage("profile")}
              title={`${profile.first_name ?? "Profile"} — View Profile`}
            >
              <div
                className="rounded-full flex items-center justify-center font-bold"
                style={{
                  width: 32, height: 32,
                  background: theme.accentGradient,
                  fontSize: "0.82rem", color: "#fff",
                  boxShadow: `0 0 0 2px ${theme.sidebarBorder}`,
                  transition: "box-shadow 0.15s",
                  overflow: "hidden",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 2px ${theme.accent}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 2px ${theme.sidebarBorder}`; }}
              >
                {profile.avatar_path
                  ? <img src={profile.avatar_path} alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : profile.first_name?.charAt(0)?.toUpperCase() ?? "A"
                }
              </div>
            </div>
          ) : (
            /* Expanded: avatar + name */
            <div
              className="flex items-center gap-2 mb-2 rounded-lg cursor-pointer"
              style={{ padding: "6px 4px", transition: "background 0.15s" }}
              onClick={() => setCurrentPage("profile")}
              title="View Profile"
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                style={{ width: 28, height: 28, background: theme.accentGradient, fontSize: "0.78rem", color: "#fff", overflow: "hidden" }}
              >
                {profile.avatar_path
                  ? <img src={profile.avatar_path} alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : profile.first_name?.charAt(0)?.toUpperCase() ?? "A"
                }
              </div>
              <span style={{ color: theme.sidebarBrandText, fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile.first_name} {profile.last_name ?? ""}
              </span>
            </div>
          )
        )}
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme.label}${manualOverride ? " (manual)" : " (auto)"}`}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg flex-1"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${theme.sidebarBorder}`,
              color: theme.sidebarText,
              fontSize: "0.72rem",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)")}
          >
            <span style={{ fontSize: "0.9rem" }}>{theme.emoji}</span>
            {!sidebarCollapsed && <span>{theme.label}</span>}
          </button>

          {/* Lock button — only shown when a PIN is configured */}
          {profile?.pin && (
            <button
              onClick={lockApp}
              title="Lock app"
              className="flex items-center justify-center rounded-lg p-1.5"
              style={{ color: theme.sidebarText, transition: "color 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = theme.sidebarTextActive)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = theme.sidebarText)}
            >
              <Lock size={15} />
            </button>
          )}

          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center rounded-lg p-1.5"
            style={{ color: theme.sidebarText, transition: "color 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = theme.sidebarTextActive)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = theme.sidebarText)}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
        {!sidebarCollapsed && (
          <div className="text-center mt-1" style={{ color: theme.sidebarBrandSub, fontSize: "0.6rem", letterSpacing: "0.05em" }}>
            {manualOverride ? "MANUAL · CLICK TO CYCLE" : "AUTO THEME"}
          </div>
        )}
      </div>
    </aside>
  );
}
